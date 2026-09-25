"use client"

import { useEffect, useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, ArrowLeft, Copy, Save, Webhook, RefreshCw, Smartphone } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface CaptureWebhook {
    id: string
    name: string
    token: string
    active: boolean
    is_testing: boolean
    available_fields: string[]
    mapped_phone_key: string | null
    mapped_name_key: string | null
    message_template: string
    create_paused: boolean
    auto_labels?: string[]
}

export default function AutomacaoConfigPage() {
    const params = useParams()
    const router = useRouter()
    const [webhook, setWebhook] = useState<CaptureWebhook | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [availableLabels, setAvailableLabels] = useState<any[]>([])
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // Poll interval ref
    const pollInterval = useRef<NodeJS.Timeout | null>(null)

    const fetchWebhook = async () => {
        try {
            const { data, error } = await supabase
                .from('capture_webhooks')
                .select('*')
                .eq('id', params.id)
                .single()

            if (error) throw error
            setWebhook(data)
        } catch (error) {
            console.error(error)
            toast.error("Erro ao carregar configurações do Webhook")
            router.push("/automacoes")
        } finally {
            if (loading) setLoading(false)
        }
    }

    const fetchLabels = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) return
        const { data } = await supabase.from('labels').select('*').eq('user_id', session.user.id)
        if (data) setAvailableLabels(data)
    }

    useEffect(() => {
        fetchWebhook()
        fetchLabels()
        // Stop polling on unmount
        return () => {
            if (pollInterval.current) clearInterval(pollInterval.current)
        }
    }, [params.id])

    const fetchAvailableFields = async () => {
        try {
            const { data, error } = await supabase.from('capture_webhooks').select('available_fields').eq('id', params.id).single()
            if (data && data.available_fields) {
                setWebhook(prev => prev ? { ...prev, available_fields: data.available_fields } : prev)
            }
        } catch (e) {}
    }

    // Se estiver em modo de teste, fica dando poll para atualizar a lista de variáveis
    useEffect(() => {
        if (webhook?.is_testing) {
            if (!pollInterval.current) {
                pollInterval.current = setInterval(() => {
                    fetchAvailableFields()
                }, 4000)
            }
        } else {
            if (pollInterval.current) {
                clearInterval(pollInterval.current)
                pollInterval.current = null
            }
        }
    }, [webhook?.is_testing])

    const handleSave = async () => {
        if (!webhook) return
        setSaving(true)
        try {
            const { error } = await supabase
                .from('capture_webhooks')
                .update({
                    name: webhook.name,
                    active: webhook.active,
                    is_testing: webhook.is_testing,
                    mapped_phone_key: webhook.mapped_phone_key,
                    mapped_name_key: webhook.mapped_name_key,
                    message_template: webhook.message_template,
                    create_paused: webhook.create_paused,
                    auto_labels: webhook.auto_labels || []
                })
                .eq('id', webhook.id)

            if (error) throw error
            toast.success("Configurações salvas com sucesso!")
        } catch (error) {
            console.error(error)
            toast.error("Erro ao salvar")
        } finally {
            setSaving(false)
        }
    }

    const insertVariable = (variable: string) => {
        if (!webhook) return
        const textToInsert = `{{${variable}}}`
        const cursorPosition = textareaRef.current?.selectionStart || webhook.message_template.length
        const currentText = webhook.message_template || ""
        
        const newText = currentText.slice(0, cursorPosition) + textToInsert + currentText.slice(cursorPosition)
        setWebhook({ ...webhook, message_template: newText })
        
        // Timeout needed to allow React state to update before setting focus again
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus()
                const newPos = cursorPosition + textToInsert.length
                textareaRef.current.setSelectionRange(newPos, newPos)
            }
        }, 0)
    }

    const copyUrl = () => {
        if (!webhook) return
        const url = `${window.location.origin}/api/capture/${webhook.token}`
        
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url)
                .then(() => toast.success("URL do Webhook copiada!"))
                .catch(() => toast.error("Erro ao copiar URL"))
        } else {
            // Fallback for non-https local contexts
            try {
                const textArea = document.createElement("textarea")
                textArea.value = url
                document.body.appendChild(textArea)
                textArea.focus()
                textArea.select()
                document.execCommand('copy')
                document.body.removeChild(textArea)
                toast.success("URL do Webhook copiada!")
            } catch (err) {
                toast.error("Erro ao copiar, tente selecionar o texto.")
            }
        }
    }


    if (loading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!webhook) return null

    // For preview parse ({{var}} -> bold var block)
    const renderPreview = (text: string) => {
        if (!text) return <span className="text-gray-500 italic">Sua mensagem aparecerá aqui...</span>
        
        // split text by {{anything}} and render as special blocks
        const parts = text.split(/(\{\{[^}]+\}\})/g);
        return parts.map((part, i) => {
            if (part.startsWith('{{') && part.endsWith('}}')) {
                const varName = part.slice(2, -2);
                return <span key={i} className="bg-yellow-400/30 px-1 py-0.5 rounded text-yellow-600 font-bold font-mono text-[10px]">{varName}</span>
            }
            return <span key={i} className="whitespace-pre-wrap">{part}</span>
        });
    }

    return (
        <div className="space-y-6 pb-20 max-w-7xl mx-auto h-full overflow-y-auto custom-scrollbar px-1">
            {/* Nav */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.push("/automacoes")}>
                    <ArrowLeft className="h-5 w-5 hover:text-white text-gray-400 object-contain" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        Configuração de Integração
                    </h1>
                </div>
                <div className="ml-auto">
                    <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                        Salvar Configurações
                    </Button>
                </div>
            </div>

            {/* Header / URL Bar style Leylim */}
            <Card className="border-blue-500/20 bg-blue-500/5">
                <CardContent className="p-4 flex flex-col md:flex-row items-center gap-4">
                    <div className="flex items-center gap-3 bg-accent/50 border border-border p-2 px-4 rounded-full w-full md:w-auto flex-1">
                        <div className="flex items-center gap-2 mr-2">
                            <span className="text-sm font-semibold">Modo Teste</span>
                            <Switch 
                                checked={webhook.is_testing}
                                onCheckedChange={(checked) => setWebhook({ ...webhook, is_testing: checked })}
                                className="data-[state=checked]:bg-purple-600"
                            />
                        </div>
                        <div className="h-4 w-[1px] bg-white/20 mx-2" />
                        <span className="text-xs text-gray-400 font-mono truncate flex-1 md:flex-initial selection:bg-purple-500/30">
                            {typeof window !== 'undefined' ? `${window.location.origin}/api/capture/${webhook.token}` : 'URL...'}
                        </span>
                        <Button variant="ghost" size="icon" onClick={copyUrl} className="h-7 w-7 rounded-full bg-white/10 hover:bg-white/20 ml-auto flex-shrink-0">
                            <Copy className="h-3 w-3" />
                        </Button>
                    </div>

                    <div className="flex items-center gap-6">
                         <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">Automação Ativa</span>
                            <Switch 
                                checked={webhook.active}
                                onCheckedChange={(checked) => setWebhook({ ...webhook, active: checked })}
                                className="data-[state=checked]:bg-green-500"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">Pausar IA no Novo Lead</span>
                            <Switch 
                                checked={webhook.create_paused !== false}
                                onCheckedChange={(checked) => setWebhook({ ...webhook, create_paused: checked })}
                                className="data-[state=checked]:bg-yellow-500"
                            />
                        </div>
                    </div>
                </CardContent>
                {webhook.is_testing && (
                    <div className="bg-purple-500/10 border-t border-purple-500/20 p-2 flex items-center justify-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin text-purple-400" />
                        <p className="text-xs text-purple-400 font-medium tracking-widest uppercase">
                            Ouvindo por eventos (Aguardando JSON Externo)...
                        </p>
                    </div>
                )}
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Lado Esquerdo: Configurações */}
                <div className="lg:col-span-7 space-y-6">
                    <Card className="border-border bg-card backdrop-blur-sm">
                        <CardHeader className="pb-3 border-b border-white/5">
                            <CardTitle className="text-base text-gray-200">Mapeamento de Dados OBRIGATÓRIOS</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-gray-400 text-xs uppercase tracking-wider">Campo do Telefone</Label>
                                    <Select 
                                        value={webhook.mapped_phone_key || "none"}
                                        onValueChange={(val) => setWebhook({ ...webhook, mapped_phone_key: val === "none" ? null : val })}
                                    >
                                        <SelectTrigger className="bg-white/5 border-white/10">
                                            <SelectValue placeholder="Selecione o campo JSON..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none" className="text-muted-foreground italic">Nenhum mapeado</SelectItem>
                                            {webhook.available_fields ? (Array.isArray(webhook.available_fields) ? webhook.available_fields : Object.keys(webhook.available_fields))
                                                .filter(field => field && String(field).trim() !== "")
                                                .map(field => (
                                                <SelectItem key={field} value={field}>{field}</SelectItem>
                                            )) : null}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-gray-400 text-xs uppercase tracking-wider">Campo do Nome</Label>
                                    <Select 
                                        value={webhook.mapped_name_key || "none"}
                                        onValueChange={(val) => setWebhook({ ...webhook, mapped_name_key: val === "none" ? null : val })}
                                    >
                                        <SelectTrigger className="bg-white/5 border-white/10">
                                            <SelectValue placeholder="Selecione o campo JSON..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none" className="text-muted-foreground italic">Nenhum mapeado</SelectItem>
                                            {webhook.available_fields ? (Array.isArray(webhook.available_fields) ? webhook.available_fields : Object.keys(webhook.available_fields))
                                                .filter(field => field && String(field).trim() !== "")
                                                .map(field => (
                                                <SelectItem key={field} value={field}>{field}</SelectItem>
                                            )) : null}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <p className="text-[11px] text-gray-500">
                                O sistema usará o campo de Telefone (formato internacional com ou sem '+') para procurar ou criar o Lead, e usará o Nome para batizá-lo caso não exista.
                            </p>

                            <div className="space-y-3 pt-4 border-t border-white/5 mt-4">
                                <Label className="text-gray-400 text-xs uppercase tracking-wider block">Etiquetas Automáticas (Opcional)</Label>
                                <p className="text-[11px] text-gray-500 mb-2">
                                    Selecione etiquetas para adicionar aos leads recebidos. A automação do Kanban os moverá para as colunas vinculadas.
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {availableLabels.map(label => {
                                        const isSelected = webhook.auto_labels?.includes(label.id)
                                        return (
                                            <button
                                                key={label.id}
                                                onClick={() => {
                                                    const current = webhook.auto_labels || []
                                                    const next = isSelected ? current.filter(id => id !== label.id) : [...current, label.id]
                                                    setWebhook({ ...webhook, auto_labels: next })
                                                }}
                                                className={cn(
                                                    "px-3 py-1 rounded-full text-[11px] font-medium border transition-colors",
                                                    isSelected ? "bg-white/10" : "bg-transparent hover:bg-white/5 border-white/10 text-gray-400"
                                                )}
                                                style={isSelected ? { backgroundColor: `${label.color}20`, color: label.color, borderColor: `${label.color}50` } : {}}
                                            >
                                                {label.title}
                                            </button>
                                        )
                                    })}
                                    {availableLabels.length === 0 && <span className="text-xs text-gray-500 italic">Nenhuma etiqueta criada no CRM.</span>}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border bg-card backdrop-blur-sm">
                        <CardHeader className="pb-3 border-b border-white/5">
                            <CardTitle className="text-base text-gray-200">Mensagem Personalizada</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="space-y-2 relative">
                                <Label className="text-gray-400 text-xs uppercase tracking-wider">Texto de Disparo</Label>
                                <textarea
                                    ref={textareaRef}
                                    value={webhook.message_template || ""}
                                    onChange={(e) => setWebhook({ ...webhook, message_template: e.target.value })}
                                    className="w-full min-h-[160px] resize-y rounded-md bg-white/5 border border-white/10 p-3 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500 custom-scrollbar whitespace-pre-wrap"
                                    placeholder="Escreva sua mensagem aqui..."
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Lado Direito: Preview de Celular e Variáveis */}
                <div className="lg:col-span-5 relative">
                    <div className="sticky top-6 flex flex-col gap-6">
                        
                        {/* Variáveis Dinâmicas Drawer */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-200 mb-3 bg-white/5 p-2 rounded-md">
                                Variáveis Disponíveis
                            </h3>
                            {(!webhook.available_fields || (Array.isArray(webhook.available_fields) && webhook.available_fields.length === 0) || (typeof webhook.available_fields === 'object' && Object.keys(webhook.available_fields).length === 0)) ? (
                                <p className="text-xs text-gray-500">Nenhuma variável capturada ainda. Dispare um JSON em <strong className="text-purple-400">Modo Teste</strong> para preencher esta lista.</p>
                            ) : (
                                <div className="flex flex-col gap-2 max-h-[350px] overflow-y-auto custom-scrollbar p-1 pb-4 pr-3">
                                    {(Array.isArray(webhook.available_fields) ? webhook.available_fields : Object.keys(webhook.available_fields))
                                        .filter(field => field && String(field).trim() !== "")
                                        .map((field) => {
                                        const sampleValue = !Array.isArray(webhook.available_fields) && webhook.available_fields[field] 
                                                            ? String(webhook.available_fields[field]) 
                                                            : null;
                                        return (
                                        <button
                                            key={field}
                                            onClick={() => insertVariable(field)}
                                            draggable={true}
                                            onDragStart={(e) => e.dataTransfer.setData("text/plain", `{{${field}}}`)}
                                            className="px-3 py-2 bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/30 text-purple-300 text-xs text-left rounded transition-colors cursor-grab active:cursor-grabbing hover:border-purple-500 group relative"
                                            title="Clique ou arraste para adicionar na mensagem"
                                        >
                                            <span className="font-mono block truncate break-words whitespace-normal text-[11px] mb-1 opacity-80" style={{wordBreak: "break-all"}}>{field}</span>
                                            {sampleValue && (
                                                <div className="font-sans text-white/90 bg-black/20 p-1.5 rounded flex items-center justify-between">
                                                    <span className="truncate">{sampleValue.length > 40 ? sampleValue.slice(0, 40) + "..." : sampleValue}</span>
                                                    <span className="text-[10px] bg-purple-500 text-white px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap ml-2">Usar var</span>
                                                </div>
                                            )}
                                            {!sampleValue && (
                                                <div className="text-[10px] bg-purple-500 text-white px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-1/2 -translate-y-1/2">Copiar</div>
                                            )}
                                        </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* WhatsApp Mock Mobile */}
                        <div className="mt-4 flex justify-center lg:justify-start">
                            <div className="relative w-[280px] h-[550px] bg-black rounded-[40px] border-8 border-[#1A1A1A] overflow-hidden shadow-2xl flex flex-col">
                                {/* Top Bar WA */}
                                <div className="bg-[#008069] text-white p-3 pt-6 flex items-center justify-center relative shadow-sm z-10">
                                    <Smartphone className="absolute left-3 h-5 w-5 opacity-60" />
                                    <span className="font-semibold text-sm">WhatsApp Preview</span>
                                </div>
                                {/* Header Contato */}
                                <div className="bg-[#f0f2f5] p-2 flex items-center justify-center border-b border-gray-300 z-10">
                                    <span className="text-[#111b21] font-medium text-xs">
                                        Número do Lead
                                    </span>
                                </div>
                                {/* Background Image WA */}
                                <div className="flex-1 relative bg-[#EFEAE2] p-4 flex flex-col">
                                    <div className="absolute inset-0 opacity-40 pointer-events-none" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundSize: '70%', backgroundRepeat: 'repeat' }} />
                                    
                                    {/* MOCK MESSAGE */}
                                    <div className="relative max-w-[85%] self-end bg-[#d9fdd3] text-[#111b21] p-2 px-3 rounded-xl rounded-tr-none shadow-sm text-sm break-words leading-relaxed">
                                        {renderPreview(webhook.message_template)}
                                        <span className="text-[9px] text-[#667781] float-right mt-2 ml-2 -mb-1">Agora</span>
                                    </div>

                                </div>
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </div>
    )
}
