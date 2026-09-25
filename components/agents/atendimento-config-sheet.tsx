"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form" // Assuming react-hook-form is available, or use controlled inputs
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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import { Loader2, Save } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import type { AgentConfig } from "@/types/agent"

interface AtendimentoConfigSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function AtendimentoConfigSheet({ open, onOpenChange }: AtendimentoConfigSheetProps) {
    const [loading, setLoading] = useState(false)
    const [fetching, setFetching] = useState(true)

    // Local state for form - simple controlled inputs
    const [config, setConfig] = useState<AgentConfig>({
        agent_type: 'atendimento',
        is_active: false,
        agent_name: '',
        personality: '',
        response_interval: 5,
        target_audience: 'all',
        pauser_permanente: false,
        destino_encaminhamento: '',
        notification_phones: '',
        notify_new_messages: false,
        notify_new_leads: false
    })

    // Load data when sheet opens
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
                .from('agents_configs')
                .select('*')
                .eq('user_id', user.id)
                .eq('agent_type', 'atendimento')
                .single()

            if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows found", which is fine, we use default
                console.error(error)
                toast.error("Erro ao carregar configurações")
            }

            if (data) {
                setConfig(data)
            } else {
                // Reset to defaults if no config exists yet (or keep initial state)
                setConfig({
                    agent_type: 'atendimento',
                    is_active: false,
                    agent_name: '',
                    personality: '',
                    response_interval: 5,
                    target_audience: 'all',
                    pauser_permanente: false,
                    destino_encaminhamento: '',
                    notification_phones: '',
                    notify_new_messages: false,
                    notify_new_leads: false
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
                agent_type: 'atendimento',
                is_active: config.is_active,
                agent_name: config.agent_name,
                personality: config.personality,
                response_interval: config.response_interval,
                target_audience: config.target_audience,
                pauser_permanente: config.pauser_permanente,
                destino_encaminhamento: config.destino_encaminhamento,
                notification_phones: config.notification_phones,
                notify_new_messages: config.notify_new_messages,
                notify_new_leads: config.notify_new_leads,
                updated_at: new Date().toISOString()
            }

            const { error } = await supabase
                .from('agents_configs')
                .upsert(payload, { onConflict: 'user_id, agent_type' })

            if (error) throw error

            toast.success("Configurações salvas com sucesso!")
            onOpenChange(false) // Optional: close on save
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
                style={{ marginLeft: '16rem' }} // Ensure it doesn't overlap sidebar visually if position isn't perfect, though fixed right 0 usually covers. Wait, right-0 covers right side. To stop at sidebar (left side 16rem), we need width calc.
            >
                <div className="h-full overflow-y-auto p-6">
                    <SheetHeader className="mb-8">
                        <SheetTitle className="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Agente de Atendimento</SheetTitle>
                        <SheetDescription className="text-lg">
                            Configure como sua IA interage com os clientes no WhatsApp.
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
                                        Habilita a resposta automática para novos atendimentos.
                                    </p>
                                </div>
                                <Switch
                                    checked={config.is_active}
                                    onCheckedChange={(checked) => setConfig({ ...config, is_active: checked })}
                                    className="scale-125"
                                />
                            </div>

                            <div className="grid gap-8 md:grid-cols-2">
                                {/* Left Column: Identity */}
                                <div className="space-y-6">
                                    <h3 className="text-lg font-semibold text-white/80 border-b border-white/5 pb-2">Identidade</h3>

                                    <div className="space-y-3">
                                        <Label className="text-base">Nome do Agente</Label>
                                        <Input
                                            placeholder="Ex: Assistente Virtual"
                                            value={config.agent_name}
                                            onChange={(e) => setConfig({ ...config, agent_name: e.target.value })}
                                            className="h-12 bg-black/20 border-white/10 focus:border-indigo-500/50"
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <Label className="text-base">Personalidade & Instruções (Prompt)</Label>
                                        <Textarea
                                            className="min-h-[300px] resize-none font-mono text-sm bg-black/20 border-white/10 focus:border-indigo-500/50 p-4 leading-relaxed"
                                            placeholder="Descreva como o agente deve se comportar..."
                                            value={config.personality}
                                            onChange={(e) => setConfig({ ...config, personality: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {/* Right Column: Rules */}
                                <div className="space-y-6">
                                    <h3 className="text-lg font-semibold text-white/80 border-b border-white/5 pb-2">Regras de Negócio</h3>

                                    <div className="rounded-xl border border-white/5 bg-black/20 p-6 space-y-6">
                                        <div className="flex items-center justify-between p-3 rounded-lg border border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 transition-colors">
                                            <div className="space-y-0.5">
                                                <Label className="text-base font-medium text-indigo-300">Pausar Permanente</Label>
                                                <p className="text-xs text-indigo-200/60 leading-tight">
                                                    Ignora o intervalo de minutos e mantém a pausa até liberação manual.
                                                </p>
                                            </div>
                                            <Switch
                                                checked={config.pauser_permanente}
                                                onCheckedChange={(checked) => setConfig({ ...config, pauser_permanente: checked })}
                                                className="data-[state=checked]:bg-indigo-500"
                                            />
                                        </div>

                                        <div className={`space-y-3 transition-all duration-300 ${config.pauser_permanente ? 'opacity-40 grayscale pointer-events-none' : 'opacity-100'}`}>
                                            <Label className="text-base">Intervalo de Resposta (Minutos)</Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                value={config.response_interval}
                                                onChange={(e) => setConfig({ ...config, response_interval: parseInt(e.target.value) || 0 })}
                                                className="h-12 bg-black/40 border-white/10"
                                                disabled={config.pauser_permanente}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Tempo de espera após intervenção humana.
                                            </p>
                                        </div>

                                        <div className="space-y-3">
                                            <Label className="text-base">Público Alvo</Label>
                                            <Select
                                                value={config.target_audience}
                                                onValueChange={(val: any) => setConfig({ ...config, target_audience: val })}
                                            >
                                                <SelectTrigger className="h-12 bg-black/40 border-white/10">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">Atender todos os leads</SelectItem>
                                                    <SelectItem value="clients_only">Apenas leads da base de clientes</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-3">
                                            <Label className="text-base">Fusão de encaminhamento com IA</Label>
                                            <Input
                                                placeholder="Ex: 5591985353657 ou 120363012345678901@g.us"
                                                value={config.destino_encaminhamento || ''}
                                                onChange={(e) => setConfig({ ...config, destino_encaminhamento: e.target.value })}
                                                className="h-12 bg-black/40 border-white/10"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Adicione o destino que a IA vai encaminha o Lead - Cel : 5591985353657  ou ID de grupo : 120363012345678901@g.us
                                            </p>
                                        </div>
                                    </div>

                                    {/* Notificações */}
                                    <div className="rounded-xl border border-white/5 bg-black/20 p-6 space-y-6">
                                        <h3 className="text-lg font-semibold text-white/80 border-b border-white/5 pb-2">Notificações Externas</h3>
                                        
                                        <div className="space-y-3">
                                            <Label className="text-base">Telefones para Notificação</Label>
                                            <Input
                                                placeholder="Ex: 5591985353657, 551199999999"
                                                value={config.notification_phones || ''}
                                                onChange={(e) => setConfig({ ...config, notification_phones: e.target.value })}
                                                className="h-12 bg-black/40 border-white/10"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Separe os números por vírgula. Lembre-se de adicionar o DDI (Ex: 55).
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/5">
                                            <div className="space-y-0.5">
                                                <Label className="text-sm font-medium">Notificar Novas Mensagens</Label>
                                                <p className="text-xs text-muted-foreground leading-tight">
                                                    Disparar alerta a cada nova mensagem recebida.
                                                </p>
                                            </div>
                                            <Switch
                                                checked={config.notify_new_messages}
                                                onCheckedChange={(checked) => setConfig({ ...config, notify_new_messages: checked })}
                                            />
                                        </div>

                                        <div className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/5">
                                            <div className="space-y-0.5">
                                                <Label className="text-sm font-medium">Notificar Novos Leads</Label>
                                                <p className="text-xs text-muted-foreground leading-tight">
                                                    Disparar alerta apenas para contatos novos/desconhecidos.
                                                </p>
                                            </div>
                                            <Switch
                                                checked={config.notify_new_leads}
                                                onCheckedChange={(checked) => setConfig({ ...config, notify_new_leads: checked })}
                                            />
                                        </div>
                                    </div>

                                    <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-6">
                                        <div className="flex items-start gap-4">
                                            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                                                <Save className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <h4 className="font-medium text-indigo-300">Dica Pro</h4>
                                                <p className="text-sm text-indigo-200/70 mt-1">
                                                    Quanto mais detalhado o prompt de personalidade, mais natural será a conversa. Use exemplos de conversas ideais.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    )}

                    <SheetFooter className="mt-8 gap-4 border-t border-white/5 pt-6">
                        <SheetClose asChild>
                            <Button variant="ghost" size="lg" disabled={loading} className="text-muted-foreground hover:text-white">Cancelar</Button>
                        </SheetClose>
                        <Button onClick={handleSave} disabled={loading || fetching} size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[200px] shadow-lg shadow-indigo-500/20">
                            {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                            Salvar Configurações
                        </Button>
                    </SheetFooter>
                </div>
            </SheetContent>
        </Sheet>
    )
}
