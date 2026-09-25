"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Webhook, Loader2, Edit, Trash2, CheckCircle2, XCircle } from "lucide-react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"

interface CaptureWebhook {
    id: string
    name: string
    token: string
    active: boolean
    is_testing: boolean
    created_at: string
}

export default function AutomacoesPage() {
    const [webhooks, setWebhooks] = useState<CaptureWebhook[]>([])
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const router = useRouter()

    const fetchWebhooks = async () => {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data, error } = await supabase
                .from('capture_webhooks')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })

            if (error) throw error
            setWebhooks(data || [])
        } catch (error) {
            console.error("Error fetching webhooks:", error)
            toast.error("Erro ao carregar webhooks")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchWebhooks()
    }, [])

    const handleCreate = async () => {
        setCreating(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const name = prompt("Nome da Automação (ex: Facebook Ads, Hotmart):")
            if (!name) return

            // Generate UUID dynamically for the token (fallback for localhost)
            const token = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });

            const { data, error } = await supabase
                .from('capture_webhooks')
                .insert({
                    user_id: user.id,
                    name: name,
                    token: token,
                    active: false,
                    is_testing: true
                })
                .select()
                .single()

            if (error) throw error

            toast.success("Webhook criado com sucesso!")
            fetchWebhooks()
            router.push(`/automacoes/${data.id}`)
        } catch (error) {
            console.error("Error creating webhook:", error)
            toast.error("Erro ao criar webhook")
        } finally {
            setCreating(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir esta automação? Os envios futuros falharão.")) return
        try {
            const { error } = await supabase
                .from('capture_webhooks')
                .delete()
                .eq('id', id)
            
            if (error) throw error
            toast.success("Webhook excluído")
            setWebhooks(prev => prev.filter(w => w.id !== id))
        } catch (error) {
            console.error(error)
            toast.error("Erro ao excluir")
        }
    }

    return (
        <div className="space-y-6 pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent flex items-center gap-2">
                        <Webhook className="h-8 w-8 text-blue-400" />
                        Automações e Captura
                    </h1>
                    <p className="mt-1 text-muted-foreground">Converta leads de outras plataformas em mensagens de WhatsApp via Webhook</p>
                </div>
                <Button onClick={handleCreate} disabled={creating} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                    {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    Novo Webhook
                </Button>
            </div>

            <Card className="border-white/10 bg-white/5 backdrop-blur-sm">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-white/10 hover:bg-white/5">
                                <TableHead>Nome da Automação</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Ambiente</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                    </TableCell>
                                </TableRow>
                            ) : webhooks.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                        Nenhuma automação configurada. Clique em "Novo Webhook" para começar.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                webhooks.map((webhook) => (
                                    <TableRow key={webhook.id} className="border-white/10 hover:bg-white/5">
                                        <TableCell className="font-medium text-white">{webhook.name}</TableCell>
                                        <TableCell>
                                            {webhook.active ? (
                                                <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Ativo</Badge>
                                            ) : (
                                                <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Inativo</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {webhook.is_testing ? (
                                                <span className="text-xs font-semibold text-purple-400 flex items-center gap-1">
                                                    <Loader2 className="h-3 w-3 animate-spin" /> Modo Teste
                                                </span>
                                            ) : (
                                                <span className="text-xs text-gray-500">Produção</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10"
                                                    onClick={() => router.push(`/automacoes/${webhook.id}`)}
                                                    title="Configurar Webhook"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-400/10"
                                                    onClick={() => handleDelete(webhook.id)}
                                                    title="Excluir Webhook"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
