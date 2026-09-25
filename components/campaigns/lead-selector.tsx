"use client"

import { useEffect, useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Folder, ChevronLeft, ChevronRight, Loader2, Tag, CheckSquare } from "lucide-react"
import { getLeadsForSelector, getAllLeadIdsForSelector } from "@/lib/actions/campaigns"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

interface LeadSelectorProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: (selectedIds: string[], folderNameForMeta: string) => void
    initialFolder?: string
    initialSelectedIds?: string[]
    lockedIds?: Set<string>
}

interface FolderStat {
    name: string
    count: number
}

interface LabelStat {
    id: string
    title: string
    color: string
}

export function LeadSelector({ open, onOpenChange, onConfirm, initialFolder, initialSelectedIds, lockedIds }: LeadSelectorProps) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [currentFolder, setCurrentFolder] = useState(initialFolder || "Todas")

    const [leads, setLeads] = useState<any[]>([])
    const [totalLeads, setTotalLeads] = useState(0)
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(false)
    const [folders, setFolders] = useState<FolderStat[]>([])
    const [labels, setLabels] = useState<LabelStat[]>([])
    const [currentLabelId, setCurrentLabelId] = useState<string | null>(null)

    const pageSize = 10

    // Initialize defaults when open
    useEffect(() => {
        if (open) {
            if (initialSelectedIds) {
                // If initial IDs provided, start with them
                setSelectedIds(new Set(initialSelectedIds))
            } else {
                // If pure create mode, empty
                setSelectedIds(new Set())
            }
        }
    }, [open, initialSelectedIds])

    // Fetch Folders for Tabs
    useEffect(() => {
        if (open) {
            const fetchFolders = async () => {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return

                const { data: folderList } = await supabase
                    .from('folders')
                    .select('name')
                    .eq('user_id', user.id)

                const stats: FolderStat[] = [{ name: "Todas", count: 0 }, { name: "Sem pasta", count: 0 }]

                if (folderList) {
                    folderList.forEach(f => stats.push({ name: f.name, count: 0 }))
                }

                setFolders(stats)

                const { data: labelsList } = await supabase
                    .from('labels')
                    .select('id, title, color')
                    .eq('user_id', user.id)

                if (labelsList) {
                    setLabels(labelsList)
                }
            }
            fetchFolders()
        }
    }, [open])

    useEffect(() => {
        if (open) {
            fetchLeads()
        }
    }, [open, page, currentFolder, currentLabelId])

    const fetchLeads = async () => {
        setLoading(true)
        try {
            const { leads, total } = await getLeadsForSelector(page, pageSize, currentFolder, currentLabelId || undefined)
            setLeads(leads)
            setTotalLeads(total)
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleSelectAllPage = (checked: boolean) => {
        const newSelected = new Set(selectedIds)
        leads.forEach(lead => {
            // Cannot modify locked leads
            if (lockedIds?.has(lead.id)) {
                // Ensure it stays in the set if it was there (which it should be if initialSelectedIds worked)
                // Actually, if it's locked, it MUST be selected.
                newSelected.add(lead.id)
                return
            }

            if (checked) newSelected.add(lead.id)
            else newSelected.delete(lead.id)
        })
        setSelectedIds(newSelected)
    }

    const handleSelectOne = (id: string, checked: boolean) => {
        if (lockedIds?.has(id)) return // Should be disabled in UI, but safety check

        const newSelected = new Set(selectedIds)
        if (checked) newSelected.add(id)
        else newSelected.delete(id)
        setSelectedIds(newSelected)
    }

    const handleSelectAllFiltered = async () => {
        setLoading(true)
        try {
            const allIds = await getAllLeadIdsForSelector(currentFolder, currentLabelId || undefined)
            const newSelected = new Set(selectedIds)
            allIds.forEach(id => {
                newSelected.add(id)
            })
            setSelectedIds(newSelected)
            toast.success(`${allIds.length} leads selecionados com sucesso!`)
        } catch (error) {
            console.error(error)
            toast.error("Erro ao selecionar todos os leads.")
        } finally {
            setLoading(false)
        }
    }

    const handleConfirm = () => {
        onConfirm(Array.from(selectedIds), currentFolder)
        onOpenChange(false)
    }

    const totalPages = Math.ceil(totalLeads / pageSize)

    // Check if valid page items are selected
    // For "Select All" checkbox logic:
    // If all leads on page are in selectedIds -> checked.
    const allPageSelected = leads.length > 0 && leads.every(l => selectedIds.has(l.id))

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[90vw] max-w-[90vw] sm:max-w-[90vw] h-[90vh] flex flex-col p-0 bg-[#0A0A0C] border-white/10">
                <DialogHeader className="px-6 py-3 border-b border-white/10 bg-[#0A0A0C]">
                    <DialogTitle className="text-xl">Selecionar Leads</DialogTitle>
                    <DialogDescription className="text-sm">Escolha os leads que participarão desta campanha.</DialogDescription>
                </DialogHeader>

                <div className="flex flex-col flex-1 overflow-hidden bg-black/20">
                    {/* Folder Tabs (Restored Size) */}
                    <div className="px-6 py-3 border-b border-white/5 bg-white/5">
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-white/10">
                            {folders.map(folder => (
                                <button
                                    key={folder.name}
                                    onClick={() => { setCurrentFolder(folder.name); setPage(1); }}
                                    className={cn(
                                        "flex flex-col items-start p-3 rounded-xl border min-w-[140px] transition-all",
                                        currentFolder === folder.name
                                            ? "bg-blue-500/20 border-blue-500/50 text-blue-200"
                                            : "bg-white/5 border-white/5 text-muted-foreground hover:bg-white/10"
                                    )}
                                >
                                    <Folder className={cn("h-5 w-5 mb-2", currentFolder === folder.name ? "text-blue-400" : "text-gray-500")} />
                                    <span className="font-medium text-sm truncate w-full text-left">{folder.name}</span>
                                </button>
                            ))}
                        </div>

                         {/* Etiquetas */}
                         {labels.length > 0 && (
                             <div className="mt-4 pt-4 border-t border-white/5">
                                 <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5"><Tag className="w-3.5 h-3.5"/> Filtrar por Etiqueta</h4>
                                 <div className="flex flex-wrap gap-2">
                                    <button
                                         onClick={() => { setCurrentLabelId(null); setPage(1); }}
                                         className={cn(
                                             "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                                             currentLabelId === null
                                                 ? "bg-white/10 text-white border-white/20"
                                                 : "bg-transparent text-gray-500 border-white/5 hover:bg-white/5"
                                         )}
                                     >
                                         Limpar Filtro
                                     </button>
                                     {labels.map(label => (
                                         <button
                                             key={label.id}
                                             onClick={() => { setCurrentLabelId(label.id); setPage(1); }}
                                             style={{ backgroundColor: currentLabelId === label.id ? label.color : undefined, borderColor: label.color, color: currentLabelId === label.id ? '#FFF' : label.color }}
                                             className={cn(
                                                 "px-3 py-1.5 rounded-md text-xs font-bold border transition-colors",
                                                 currentLabelId !== label.id && "bg-transparent hover:bg-white/5"
                                             )}
                                         >
                                             {label.title}
                                         </button>
                                     ))}
                                 </div>
                             </div>
                         )}
                    </div>

                    {/* Table (Expanded) */}
                    <div className="flex-1 overflow-auto p-0 min-h-0">
                        <Table>
                            <TableHeader className="sticky top-0 bg-[#0A0A0C] z-10 shadow-sm">
                                <TableRow className="border-white/5 hover:bg-transparent">
                                    <TableHead className="w-[50px] py-2">
                                        <Checkbox
                                            checked={allPageSelected}
                                            onCheckedChange={(checked) => handleSelectAllPage(!!checked)}
                                        />
                                    </TableHead>
                                    <TableHead className="py-2">Nome / Empresa</TableHead>
                                    <TableHead className="py-2">WhatsApp</TableHead>
                                    <TableHead className="py-2">Criado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-40 text-center">
                                            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                                        </TableCell>
                                    </TableRow>
                                ) : leads.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-40 text-center text-muted-foreground">
                                            Nenhum lead encontrado nesta pasta.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    leads.map(lead => {
                                        const isLocked = lockedIds?.has(lead.id)
                                        const isSelected = selectedIds.has(lead.id)

                                        return (
                                            <TableRow key={lead.id} className="border-white/5 hover:bg-white/5">
                                                <TableCell className="py-2">
                                                    <Checkbox
                                                        checked={isSelected}
                                                        onCheckedChange={(checked) => handleSelectOne(lead.id, !!checked)}
                                                        disabled={isLocked}
                                                        className={isLocked ? "opacity-50 cursor-not-allowed data-[state=checked]:bg-gray-600 border-gray-600" : ""}
                                                    />
                                                </TableCell>
                                                <TableCell className="font-medium py-2 text-sm">
                                                    <div className="flex flex-col">
                                                        <span>{lead.company_name || lead.full_name || "Sem nome"}</span>
                                                        {isLocked && <span className="text-[10px] text-yellow-500 uppercase font-bold tracking-wider">Já Processado</span>}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-2 text-sm">{lead.whatsapp || lead.phone || "-"}</TableCell>
                                                <TableCell className="text-muted-foreground text-xs py-2">
                                                    {format(new Date(lead.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    <div className="p-2 px-6 border-t border-white/10 flex items-center justify-between bg-[#0A0A0C]">
                        <span className="text-xs text-muted-foreground">
                            Página {page} de {totalPages || 1}
                        </span>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                disabled={page <= 1 || loading}
                                onClick={() => setPage(page - 1)}
                            >
                                <ChevronLeft className="h-3 w-3 mr-1" /> Anterior
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                disabled={page >= totalPages || loading}
                                onClick={() => setPage(page + 1)}
                            >
                                Próxima <ChevronRight className="h-3 w-3 ml-1" />
                            </Button>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-3 px-6 border-t border-white/10 bg-[#0A0A0C]">
                    <div className="flex items-center justify-between w-full">
                        <div className="text-sm text-muted-foreground">
                            <span className="text-white font-bold">{selectedIds.size}</span> selecionados
                        </div>
                        <div className="flex gap-2">
                            {totalLeads > 0 && (
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={handleSelectAllFiltered} 
                                    className="text-blue-400 border-blue-500/20 hover:bg-blue-500/10 gap-1.5"
                                    disabled={loading}
                                >
                                    <CheckSquare className="h-4 w-4" />
                                    Selecionar Todos ({totalLeads})
                                </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Limpar</Button>
                            <Button size="sm" onClick={handleConfirm} className="bg-blue-600 hover:bg-blue-700 text-white">
                                Usar Selecionados
                            </Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
