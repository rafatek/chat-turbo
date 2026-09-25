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
import { Loader2, Save, Sparkles, Wand2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import type { AssistenteConfig } from "@/types/agent"

interface AssistenteConfigSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function AssistenteConfigSheet({ open, onOpenChange }: AssistenteConfigSheetProps) {
    const [loading, setLoading] = useState(false)
    const [fetching, setFetching] = useState(true)

    const [config, setConfig] = useState<AssistenteConfig>({
        is_active: false,
        prompt: ''
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
                .from('agents_assist')
                .select('is_active, prompt')
                .eq('user_id', user.id)
                .single()

            if (error && error.code !== 'PGRST116') {
                console.error(error)
                toast.error("Erro ao carregar configurações do assistente")
            }

            if (data) {
                setConfig({
                    is_active: data.is_active || false,
                    prompt: data.prompt || ''
                })
            } else {
                setConfig({
                    is_active: false,
                    prompt: ''
                })
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
                prompt: config.prompt,
                updated_at: new Date().toISOString()
            }

            const { error } = await supabase
                .from('agents_assist')
                .upsert(payload, { onConflict: 'user_id' })

            if (error) throw error

            toast.success("Configurações do Assistente salvas com sucesso!")
            onOpenChange(false)
        } catch (error) {
            console.error(error)
            toast.error("Erro ao salvar configurações")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="w-[calc(100%-16rem)] max-w-none sm:max-w-none border-l border-white/10 bg-[#0A0A0C]/90 backdrop-blur-xl p-0 shadow-2xl transition-all duration-500 ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right"
                style={{ marginLeft: '16rem' }}
            >
                <div className="h-full overflow-y-auto p-6">
                    <SheetHeader className="mb-8">
                        <SheetTitle className="text-3xl font-bold bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent flex items-center gap-3">
                            <Sparkles className="h-8 w-8 text-emerald-400" />
                            Assistente de Mensagem
                        </SheetTitle>
                        <SheetDescription className="text-lg text-muted-foreground">
                            Configure seu assistente para sugestão, reformulação e auxílio inteligente na redação de mensagens.
                        </SheetDescription>
                    </SheetHeader>

                    {fetching ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="h-12 w-12 animate-spin text-emerald-400" />
                        </div>
                    ) : (
                        <div className="grid gap-8 py-4 max-w-4xl mx-auto">
                            {/* Status Switch */}
                            <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-6 shadow-inner backdrop-blur-sm">
                                <div className="space-y-1">
                                    <Label className="text-xl font-semibold text-white">Assistente Ativo</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Habilite o assistente de IA para suporte na composição de mensagens.
                                    </p>
                                </div>
                                <Switch
                                    checked={config.is_active}
                                    onCheckedChange={(checked) => setConfig({ ...config, is_active: checked })}
                                    className="scale-125 data-[state=checked]:bg-emerald-600"
                                />
                            </div>

                            {/* Prompt Input Section */}
                            <div className="space-y-4 rounded-xl border border-white/5 bg-black/20 p-6">
                                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                                    <div className="flex items-center gap-2">
                                        <Wand2 className="h-5 w-5 text-emerald-400" />
                                        <h3 className="text-lg font-semibold text-white/90">Instruções do Assistente (Prompt)</h3>
                                    </div>
                                    <span className="text-xs text-muted-foreground bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
                                        Personalização
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-sm text-muted-foreground">
                                        Descreva como o assistente deve auxiliar e estruturar as respostas:
                                    </Label>
                                    <Textarea
                                        className="min-h-[280px] resize-none font-mono text-sm bg-black/30 border-white/10 focus:border-emerald-500/50 focus:ring-emerald-500/20 p-4 leading-relaxed rounded-lg placeholder:text-muted-foreground/40"
                                        placeholder="Ex: Você é um assistente de mensagens especialista em vendas e atendimento. Suas respostas devem ser cordiais, persuasivas e objetivas..."
                                        value={config.prompt || ''}
                                        onChange={(e) => setConfig({ ...config, prompt: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <SheetFooter className="mt-8 gap-4 border-t border-white/5 pt-6">
                        <SheetClose asChild>
                            <Button variant="ghost" size="lg" disabled={loading} className="text-muted-foreground hover:text-white">
                                Cancelar
                            </Button>
                        </SheetClose>
                        <Button
                            onClick={handleSave}
                            disabled={loading || fetching}
                            size="lg"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[200px] shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                        >
                            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                            Salvar Configurações
                        </Button>
                    </SheetFooter>
                </div>
            </SheetContent>
        </Sheet>
    )
}
