"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Megaphone, Clock, Loader2, Play, Pause, Edit, Trash2, MoreHorizontal, Rocket, CheckCircle2 } from "lucide-react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { CampaignSheet } from "@/components/campaigns/campaign-sheet"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { getCampaignsWithStats, toggleCampaignStatus, deleteCampaign } from "@/lib/actions/campaigns"
import { toast } from "sonner"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface CampaignWithStats {
    id: string
    name: string
    text_campanha?: string
    schedule_days: number[]
    start_time: string
    end_time: string
    created_at: string
    status: 'active' | 'paused' | 'completed'
    folder_name: string
    stats: {
        total: number
        sent: number
        failed: number
    }
}

export default function CampaignsPage() {
    const [campaigns, setCampaigns] = useState<CampaignWithStats[]>([])
    const [loading, setLoading] = useState(true)
    const [isSheetOpen, setIsSheetOpen] = useState(false)
    const [campaignToEdit, setCampaignToEdit] = useState<CampaignWithStats | null>(null)

    const [activatingId, setActivatingId] = useState<string | null>(null)

    const fetchCampaigns = async () => {
        setLoading(true)
        try {
            const data = await getCampaignsWithStats()
            setCampaigns(data as CampaignWithStats[])
        } catch (error) {
            console.error("Error fetching campaigns:", error)
            toast.error("Erro ao carregar campanhas")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchCampaigns()
    }, [])

    const handleCreate = () => {
        setCampaignToEdit(null)
        setIsSheetOpen(true)
    }

    const handleEdit = (campaign: CampaignWithStats) => {
        setCampaignToEdit(campaign)
        setIsSheetOpen(true)
    }

    const handleToggleStatus = async (campaign: CampaignWithStats) => {
        if (campaign.status === 'paused') {
            // Start Row Animation
            setActivatingId(campaign.id)
            setTimeout(async () => {
                await toggleCampaignStatus(campaign.id, 'active')
                setActivatingId(null)
                fetchCampaigns()
                toast.success("Missão Iniciada! 🚀")
            }, 2000) // Animation duration matching CSS
        } else {
            await toggleCampaignStatus(campaign.id, 'paused')
            fetchCampaigns()
            toast.info("Campanha pausada.")
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir esta campanha?")) return
        const res = await deleteCampaign(id)
        if (res.success) {
            toast.success("Campanha excluída")
            fetchCampaigns()
        } else {
            toast.error("Erro ao excluir")
        }
    }

    return (
        <div className="space-y-6 pb-20 relative">
            <style jsx global>{`
                @keyframes progress-bar-fill {
                    0% { background-size: 0% 100%; }
                    100% { background-size: 100% 100%; }
                }
            `}</style>

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                        Disparos
                    </h1>
                    <p className="mt-1 text-muted-foreground">Gerencie suas campanhas de prospecção agendadas</p>
                </div>
                <Button onClick={handleCreate} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                    <Plus className="mr-2 h-4 w-4" /> Nova Campanha
                </Button>
            </div>

            <Card className="border-border bg-card backdrop-blur-sm">
                <CardContent className="p-0">
                    <Table>
                        {/* ... Table Header ... */}
                        <TableHeader>
                            <TableRow className="border-border hover:bg-accent">
                                <TableHead>Nome</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-center">Total</TableHead>
                                <TableHead className="text-center">Enviados</TableHead>
                                <TableHead className="text-center">Erros</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                                    </TableCell>
                                </TableRow>
                            ) : campaigns.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                        Nenhuma campanha encontrada.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                campaigns.map((campaign) => (
                                    <TableRow
                                        key={campaign.id}
                                        className="border-border hover:bg-accent relative transition-colors"
                                        style={activatingId === campaign.id ? {
                                            backgroundImage: 'linear-gradient(90deg, rgba(16, 185, 129, 0.15), transparent)',
                                            backgroundRepeat: 'no-repeat',
                                            backgroundSize: '0% 100%',
                                            animation: 'progress-bar-fill 2s ease-out forwards',
                                            borderLeft: '2px solid #10b981'
                                        } : {}}
                                    >
                                        <TableCell className="font-medium">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <Megaphone className="h-4 w-4 text-purple-400" />
                                                    {campaign.name}
                                                </div>
                                                <span className="text-xs text-muted-foreground ml-6">
                                                    Pasta: {campaign.folder_name}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "border-0 uppercase text-[10px] tracking-wider font-bold",
                                                        campaign.status === 'active'
                                                            ? "bg-emerald-500/10 text-emerald-400"
                                                            : campaign.status === 'completed'
                                                                ? "bg-blue-500/10 text-blue-400"
                                                                : "bg-yellow-500/10 text-yellow-500"
                                                    )}
                                                >
                                                    {campaign.status === 'active' ? 'Ativo' : campaign.status === 'completed' ? 'Concluído' : 'Pausado'}
                                                </Badge>

                                                {activatingId === campaign.id && (
                                                    <span className="text-[10px] font-mono font-bold text-emerald-400 animate-pulse tracking-widest whitespace-nowrap">
                                                        INICIANDO...
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center font-mono text-muted-foreground">
                                            {campaign.stats.total}
                                        </TableCell>
                                        <TableCell className="text-center font-mono text-emerald-400">
                                            {campaign.stats.sent}
                                        </TableCell>
                                        <TableCell className="text-center font-mono text-red-400">
                                            {campaign.stats.failed}
                                        </TableCell>

                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {campaign.status === 'completed' ? (
                                                    <span className="flex items-center text-blue-400 text-xs font-bold uppercase tracking-wider px-3 py-1.5 bg-blue-500/5 rounded-md border border-blue-500/10 shadow-[0_0_10px_rgba(59,130,246,0.1)]">
                                                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                                                        Missão Concluída
                                                    </span>
                                                ) : campaign.status === 'paused' ? (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleToggleStatus(campaign)}
                                                        disabled={activatingId === campaign.id}
                                                        className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-80"
                                                    >
                                                        {activatingId === campaign.id ? (
                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        ) : (
                                                            <>
                                                                <Play className="h-3.5 w-3.5 mr-1" /> Iniciar
                                                            </>
                                                        )}
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleToggleStatus(campaign)}
                                                        className="h-8 text-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-400"
                                                    >
                                                        <Pause className="h-3.5 w-3.5 mr-1" /> Pausar
                                                    </Button>
                                                )}

                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="bg-popover border-border">
                                                        {campaign.status !== 'completed' && (
                                                            <DropdownMenuItem
                                                                onClick={() => handleEdit(campaign)}
                                                                className="focus:bg-accent cursor-pointer"
                                                            >
                                                                <Edit className="mr-2 h-4 w-4 text-blue-400" />
                                                                Editar
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuItem
                                                            onClick={() => handleDelete(campaign.id)}
                                                            className="focus:bg-red-900/10 cursor-pointer text-red-400 focus:text-red-400"
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            Excluir
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <CampaignSheet
                open={isSheetOpen}
                onOpenChange={setIsSheetOpen}
                onSuccess={fetchCampaigns}
                campaignToEdit={campaignToEdit}
            />
        </div>
    )
}
