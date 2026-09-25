"use client"

import { useEffect, useState } from "react"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetFooter,
    SheetClose
} from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Loader2, Save, Calendar, CheckCircle2, AlertCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import type { AgendamentoConfig } from "@/types/agent"
import { useRouter } from "next/navigation"

interface AgendamentoConfigSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function AgendamentoConfigSheet({ open, onOpenChange }: AgendamentoConfigSheetProps) {
    const [loading, setLoading] = useState(false)
    const [fetching, setFetching] = useState(true)
    const [isGoogleConnected, setIsGoogleConnected] = useState(false)
    const router = useRouter()

    const [config, setConfig] = useState<AgendamentoConfig>({
        is_active: false,
        prompt_agendamento: ''
    })

    useEffect(() => {
        if (open) {
            fetchConfig()
        }
    }, [open])

    const fetchConfig = async () => {
        setFetching(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data, error } = await supabase
                .from('agents_agendamento_config')
                .select('is_active, prompt_agendamento, google_token_expiry, google_refresh_token')
                .eq('user_id', user.id)
                .single()

            if (error && error.code !== 'PGRST116') {
                console.error(error)
                toast.error("Erro ao carregar configurações")
            }

            if (data) {
                setConfig({
                    is_active: data.is_active || false,
                    prompt_agendamento: data.prompt_agendamento || ''
                })
                setIsGoogleConnected(Boolean(data.google_refresh_token || data.google_token_expiry))
            } else {
                setConfig({
                    is_active: false,
                    prompt_agendamento: ''
                })
                setIsGoogleConnected(false)
            }
        } catch (err) {
            console.error(err)
        } finally {
            setFetching(false)
        }
    }

    const handleSave = async () => {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                toast.error("Usuário não autenticado")
                return
            }

            const payload = {
                user_id: user.id,
                is_active: config.is_active,
                prompt_agendamento: config.prompt_agendamento,
                updated_at: new Date().toISOString()
            }

            const { error } = await supabase
                .from('agents_agendamento_config')
                .upsert(payload, { onConflict: 'user_id' })

            if (error) throw error

            toast.success("Configurações salvas com sucesso!")
            onOpenChange(false)
        } catch (error) {
            console.error(error)
            toast.error("Erro ao salvar configurações")
        } finally {
            setLoading(false)
        }
    }

    const handleConnectGoogle = () => {
        // Redireciona para nossa rota de API que inicia o fluxo OAuth
        window.location.href = '/api/auth/google'
    }

    const isConnected = isGoogleConnected

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="w-[calc(100%-16rem)] max-w-none sm:max-w-none border-l border-white/10 bg-[#0A0A0C]/90 backdrop-blur-xl p-0 shadow-2xl transition-all duration-500 ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right"
                style={{ marginLeft: '16rem' }}
            >
                <div className="h-full overflow-y-auto p-6">
                    <SheetHeader className="mb-8">
                        <SheetTitle className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent flex items-center gap-3">
                            <Calendar className="h-8 w-8 text-blue-400" />
                            Agente de Agendamento
                        </SheetTitle>
                        <SheetDescription className="text-lg">
                            Conecte seu Google Agenda e instrua a IA sobre como marcar compromissos.
                        </SheetDescription>
                    </SheetHeader>

                    {fetching ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="grid gap-8 py-4 max-w-5xl mx-auto">

                            {/* Status Switch - Hero Section */}
                            <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-6 shadow-inner backdrop-blur-sm">
                                <div className="space-y-1">
                                    <Label className="text-xl font-semibold">Agente Ativo</Label>
                                    <p className="text-muted-foreground">
                                        Habilita o agente para gerenciar a agenda.
                                    </p>
                                </div>
                                <Switch
                                    checked={config.is_active}
                                    onCheckedChange={(checked) => setConfig({ ...config, is_active: checked })}
                                    className="scale-125"
                                />
                            </div>

                            <div className="grid gap-8 md:grid-cols-2">
                                {/* Left Column: Identity & Prompt */}
                                <div className="space-y-6">
                                    <h3 className="text-lg font-semibold text-white/80 border-b border-white/5 pb-2">Instruções de Agendamento</h3>

                                    <div className="space-y-3">
                                        <Label className="text-base">Prompt do Agendamento</Label>
                                        <Textarea
                                            className="min-h-[300px] resize-none font-mono text-sm bg-black/20 border-white/10 focus:border-blue-500/50 p-4 leading-relaxed"
                                            placeholder="Ex: Você é um assistente de agendamento. Verifique a disponibilidade..."
                                            value={config.prompt_agendamento || ''}
                                            onChange={(e) => setConfig({ ...config, prompt_agendamento: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {/* Right Column: Google Integration */}
                                <div className="space-y-6">
                                    <h3 className="text-lg font-semibold text-white/80 border-b border-white/5 pb-2">Integração Google Agenda</h3>

                                    <div className="rounded-xl border border-white/5 bg-black/20 p-6 space-y-6">
                                        
                                        {isConnected ? (
                                            <div className="flex flex-col items-center justify-center p-6 bg-green-500/10 border border-green-500/20 rounded-lg space-y-4">
                                                <CheckCircle2 className="h-12 w-12 text-green-400" />
                                                <div className="text-center">
                                                    <h4 className="text-lg font-medium text-green-400">Conectado ao Google</h4>
                                                    <p className="text-sm text-green-300/70 mt-1">Seu calendário está sincronizado.</p>
                                                </div>
                                                <Button 
                                                    variant="outline" 
                                                    className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                                                    onClick={() => {
                                                        // Disconnect logic could go here
                                                        toast.info("Para desconectar, remova o acesso na sua conta Google.")
                                                    }}
                                                >
                                                    Desconectar
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center p-6 bg-blue-500/5 border border-blue-500/20 rounded-lg space-y-4">
                                                <AlertCircle className="h-12 w-12 text-blue-400" />
                                                <div className="text-center">
                                                    <h4 className="text-lg font-medium text-blue-300">Não Conectado</h4>
                                                    <p className="text-sm text-blue-200/70 mt-1">Conecte sua conta para permitir agendamentos.</p>
                                                </div>
                                                <Button 
                                                    onClick={handleConnectGoogle}
                                                    className="w-full bg-white text-black hover:bg-gray-200 mt-2 font-medium"
                                                >
                                                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                                    </svg>
                                                    Conectar ao Google Agenda
                                                </Button>
                                            </div>
                                        )}
                                        
                                    </div>
                                </div>
                            </div>

                        </div>
                    )}

                    <SheetFooter className="mt-8 gap-4 border-t border-white/5 pt-6">
                        <SheetClose asChild>
                            <Button variant="ghost" size="lg" disabled={loading} className="text-muted-foreground hover:text-white">Cancelar</Button>
                        </SheetClose>
                        <Button onClick={handleSave} disabled={loading || fetching} size="lg" className="bg-blue-600 hover:bg-blue-700 text-white min-w-[200px] shadow-lg shadow-blue-500/20">
                            {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                            Salvar Configurações
                        </Button>
                    </SheetFooter>
                </div>
            </SheetContent>
        </Sheet>
    )
}
