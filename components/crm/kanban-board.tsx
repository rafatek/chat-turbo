"use client"

import { useState, useEffect, useRef } from "react"
import { DragDropContext, DropResult, Droppable, Draggable } from "@hello-pangea/dnd"
import { KanbanColumn } from "./kanban-column"
import { Column, Label as KanbanLabel } from "@/types/kanban"
import { Button } from "@/components/ui/button"
import { Plus, Loader2, UserPlus, FileText } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { LabelManager } from "./label-manager"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface KanbanBoardProps {
    initialColumns: Column[]
    availableLabels?: KanbanLabel[]
}


export function KanbanBoard({ initialColumns, availableLabels = [] }: KanbanBoardProps) {
    const router = useRouter()
    
    // Board State
    const [columns, setColumns] = useState<Column[]>(initialColumns)

    useEffect(() => {
        setColumns(initialColumns)
    }, [initialColumns])
    const [isDeleting, setIsDeleting] = useState(false)
    const [columnToDelete, setColumnToDelete] = useState<Column | null>(null)

    // Add Column State
    const [isAddColumnOpen, setIsAddColumnOpen] = useState(false)
    const [newColumnTitle, setNewColumnTitle] = useState("")
    const [newColumnLabelId, setNewColumnLabelId] = useState<string>("none")
    const [isCreatingColumn, setIsCreatingColumn] = useState(false)

    // New Lead State
    const [isNewLeadOpen, setIsNewLeadOpen] = useState(false)
    const [isCreatingLead, setIsCreatingLead] = useState(false)
    const [newLeadData, setNewLeadData] = useState({
        full_name: "",
        whatsapp: ""
    })
    const [selectedNewLeadLabelIds, setSelectedNewLeadLabelIds] = useState<string[]>([])

    // Spreadsheet Import State
    const [isImportOpen, setIsImportOpen] = useState(false)
    const [pasteData, setPasteData] = useState("")
    const [isImporting, setIsImporting] = useState(false)

    const [isDraggingLead, setIsDraggingLead] = useState(false)
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const mousePos = useRef({ x: 0, y: 0 })

    // Track mouse position globally
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            mousePos.current = { x: e.clientX, y: e.clientY }
        }
        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length > 0) {
                mousePos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
            }
        }
        
        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('touchmove', handleTouchMove, { passive: true })
        
        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('touchmove', handleTouchMove)
        }
    }, [])

    // Smooth auto-scroll loop
    useEffect(() => {
        if (!isDraggingLead) return;

        let animationFrameId: number;
        
        const scrollLoop = () => {
            if (scrollContainerRef.current) {
                const container = scrollContainerRef.current;
                const rect = container.getBoundingClientRect();
                const edgeSize = 150; // Increased edge size for easier triggering
                const x = mousePos.current.x;

                let speed = 0;
                // Only scroll if we have a valid mouse position (x > 0)
                if (x > 0 && x < rect.left + edgeSize) {
                    speed = -15; // Scroll left
                } else if (x > 0 && x > rect.right - edgeSize) {
                    speed = 15;  // Scroll right
                }

                if (speed !== 0) {
                    container.scrollLeft += speed;
                }
            }
            animationFrameId = requestAnimationFrame(scrollLoop);
        };

        scrollLoop();

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [isDraggingLead]);



    // Supabase client imported from @/lib/supabase

    // --- Helpers ---

    const formatPhone = (value: string) => {
        const numbers = value.replace(/\D/g, "")
        if (numbers.length <= 11) {
            return numbers.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")
                .replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3")
        }
        return value
    }

    const cleanPhoneForDb = (phone: string) => {
        let clean = phone.replace(/\D/g, "")
        if (clean.startsWith("55") && clean.length >= 12) {
            clean = clean.slice(2)
        }
        if (clean.startsWith("0")) {
            clean = clean.slice(1)
        }
        return clean
    }

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatPhone(e.target.value)
        setNewLeadData({ ...newLeadData, whatsapp: formatted })
    }

    // --- Handlers ---

    const onDragStart = (start: any) => {
        if (start.type === 'lead') {
            setIsDraggingLead(true)
        }
    }

    const onDragEnd = async (result: DropResult) => {
        setIsDraggingLead(false)
        console.log("DND Result (Original):", result)
        let { destination, source, draggableId, type } = result

        // --- HACK / WORKAROUND ---
        // react-beautiful-dnd explicitly ignores horizontal scroll events when dragging a vertical item.
        // Therefore, when the container scrolls, the library thinks columns are still in their original positions.
        // We override the destination by querying the DOM directly at the mouse coordinates!
        if (type === 'lead' && mousePos.current.x > 0) {
            const elements = document.elementsFromPoint(mousePos.current.x, mousePos.current.y);
            const columnEl = elements.find(el => el.hasAttribute('data-column-id'));
            
            if (columnEl) {
                const realColumnId = columnEl.getAttribute('data-column-id');
                if (realColumnId) {
                    const cardEl = elements.find(el => el.hasAttribute('data-card-index'));
                    let realIndex = 0;
                    
                    if (cardEl) {
                        realIndex = parseInt(cardEl.getAttribute('data-card-index') || '0', 10);
                        const rect = cardEl.getBoundingClientRect();
                        // If mouse is in the bottom half of the card, insert AFTER it
                        if (mousePos.current.y > rect.top + rect.height / 2) {
                            realIndex += 1;
                        }
                    } else {
                        // Mouse is in the column but not over any specific card. Place at the end.
                        const colIndex = columns.findIndex(c => c.id === realColumnId);
                        if (colIndex !== -1) {
                            realIndex = columns[colIndex].leads.length;
                        }
                    }

                    destination = { droppableId: realColumnId, index: realIndex };
                    console.log("DND Result (Overridden by DOM query):", destination);
                }
            }
        }
        // --- FIM DO WORKAROUND ---

        if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) {
            return
        }

        // TRAVA DE SEGURANÇA (DND): Abortar se for COLUNA (index 0 protegido)
        if (type === 'column' && (source.index === 0 || destination.index === 0)) {
            return
        }

        // Handle Column Reordering
        if (type === 'column') {
            const newColumns = Array.from(columns)
            const [movedColumn] = newColumns.splice(source.index, 1)
            newColumns.splice(destination.index, 0, movedColumn)

            const updatedColumns = newColumns.map((col, index) => ({
                ...col,
                position: index
            }))

            setColumns(updatedColumns)

            try {
                const { data: { session }, error: sessionError } = await supabase.auth.getSession()

                if (sessionError || !session?.user) throw new Error("Usuário não autenticado")

                const updates = updatedColumns.map((col, index) => ({
                    id: col.id,
                    user_id: session.user.id,
                    title: col.title,
                    position: index
                }))

                const { error } = await supabase.from('kanban_columns').upsert(updates, { onConflict: 'id' })
                if (error) throw error

            } catch (error: any) {
                console.error("Erro Supabase:", error)
                toast.error("Erro ao salvar ordem das colunas")
                setColumns(columns)
            }
            return
        }

        // Handle Lead Reordering
        if (type === 'lead') {
            const sourceColIndex = columns.findIndex(col => col.id === source.droppableId)
            const destColIndex = columns.findIndex(col => col.id === destination.droppableId)

            if (sourceColIndex === -1 || destColIndex === -1) return

            const newColumns = [...columns]
            const sourceCol = newColumns[sourceColIndex]
            const destCol = newColumns[destColIndex]

            // Moving within same column
            if (source.droppableId === destination.droppableId) {
                const newLeads = Array.from(sourceCol.leads)
                const [movedLead] = newLeads.splice(source.index, 1)
                newLeads.splice(destination.index, 0, movedLead)

                newColumns[sourceColIndex] = { ...sourceCol, leads: newLeads }
                setColumns(newColumns)
                return
            }

            // Moving to different column
            const sourceLeads = Array.from(sourceCol.leads)
            const destLeads = Array.from(destCol.leads)
            const [movedLead] = sourceLeads.splice(source.index, 1)

            const updatedLead = { ...movedLead, column_id: destination.droppableId }
            destLeads.splice(destination.index, 0, updatedLead)

            newColumns[sourceColIndex] = { ...sourceCol, leads: sourceLeads }
            newColumns[destColIndex] = { ...destCol, leads: destLeads }

            setColumns(newColumns)

            try {
                const { error } = await supabase
                    .from('leads')
                    .update({ column_id: destination.droppableId })
                    .eq('id', draggableId)

                if (error) throw error
            } catch (error) {
                setColumns(columns)
                toast.error("Erro ao mover lead")
                console.error("Move lead error:", error)
            }
        }

    }

    const handleAddColumn = async () => {
        if (!newColumnTitle.trim()) return

        setIsCreatingColumn(true)
        const title = newColumnTitle
        const newPosition = columns.length > 0 ? Math.max(...columns.map(c => c.position)) + 1 : 0

        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession()
            if (sessionError || !session?.user) throw new Error("Sessão inválida")

            const { data, error } = await supabase
                .from('kanban_columns')
                .insert({
                    title: title,
                    position: newPosition,
                    user_id: session.user.id,
                    linked_label_id: newColumnLabelId === "none" ? null : newColumnLabelId
                })
                .select()
                .single()

            if (error) throw error

            if (data) {
                setColumns([...columns, { ...data, leads: [] }])
                toast.success("Coluna criada!")
                setIsAddColumnOpen(false)
                setNewColumnTitle("")
                setNewColumnLabelId("none")
            }
        } catch (error: any) {
            console.error("Column create error:", error)
            toast.error("Erro ao criar coluna")
        } finally {
            setIsCreatingColumn(false)
        }
    }

    const handleRenameColumn = async (columnId: string, newTitle: string) => {
        try {
            const { error } = await supabase
                .from('kanban_columns')
                .update({ title: newTitle })
                .eq('id', columnId)

            if (error) throw error

            setColumns(prev => prev.map(c => c.id === columnId ? { ...c, title: newTitle } : c))
            toast.success("Coluna renomeada!")
        } catch (error) {
            console.error("Rename column error:", error)
            toast.error("Erro ao renomear coluna")
        }
    }

    const handleDeleteColumn = async () => {
        if (!columnToDelete) return

        setIsDeleting(true)
        const idx = columns.findIndex(c => c.id === columnToDelete.id)
        const previousColumn = columns[idx - 1]

        if (!previousColumn) {
            toast.error("Não é possível excluir esta coluna.")
            setIsDeleting(false)
            setColumnToDelete(null)
            return
        }

        try {
            const { error: updateError } = await supabase
                .from('leads')
                .update({ column_id: previousColumn.id })
                .eq('column_id', columnToDelete.id)

            if (updateError) throw updateError

            const { error: deleteError } = await supabase
                .from('kanban_columns')
                .delete()
                .eq('id', columnToDelete.id)

            if (deleteError) throw deleteError

            const newColumns = Array.from(columns)
            const prevColIndex = newColumns.findIndex(c => c.id === previousColumn.id)
            const colToDeleteIndex = newColumns.findIndex(c => c.id === columnToDelete.id)

            if (prevColIndex !== -1 && colToDeleteIndex !== -1) {
                const leadsToMove = newColumns[colToDeleteIndex].leads.map(lead => ({ ...lead, column_id: previousColumn.id }))
                newColumns[prevColIndex] = {
                    ...newColumns[prevColIndex],
                    leads: [...newColumns[prevColIndex].leads, ...leadsToMove]
                }
                newColumns.splice(colToDeleteIndex, 1)
                setColumns(newColumns)
            }

            toast.success("Coluna excluída e leads migrados.")
        } catch (error) {
            console.error("Delete error:", error)
            toast.error("Erro ao excluir coluna")
        } finally {
            setIsDeleting(false)
            setColumnToDelete(null)
        }
    }

    const handleCreateLead = async () => {
        if (!newLeadData.full_name || !newLeadData.whatsapp) {
            toast.warning("Preencha nome e WhatsApp")
            return
        }

        setIsCreatingLead(true)

        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession()
            if (sessionError || !session?.user) throw new Error("Sessão inválida")

            // Localização da Coluna: Position 0
            const targetColumn = columns.find(c => c.position === 0)

            if (!targetColumn) {
                toast.error("Coluna 'Novos Leads' não encontrada (position 0).")
                setIsCreatingLead(false)
                return
            }

            const cleanPhone = cleanPhoneForDb(newLeadData.whatsapp)

            // 1. Criar/Garantir a Conversa
            const { data: convData, error: convError } = await supabase
                .from('conversations')
                .upsert({
                    user_id: session.user.id,
                    contact_phone: cleanPhone,
                    contact_name: newLeadData.full_name,
                    is_open: true
                }, {
                    onConflict: 'user_id,contact_phone'
                })
                .select('id')
                .single()

            if (convError && convError.code !== '23505') {
                 console.error("Erro ao criar conversa:", convError)
            }

            const conversationId = convData?.id || null

            // 2. Criar Lead
            const payload = {
                user_id: session.user.id,
                column_id: targetColumn.id,
                full_name: newLeadData.full_name,
                whatsapp: cleanPhone,
                origin: "WhatsApp",
                message_sent: false,
                conversation_id: conversationId
            }

            const { data, error } = await supabase
                .from('leads')
                .insert(payload)
                .select()
                .single()

            if (error) throw error

            // Inserir etiquetas selecionadas
            if (data && selectedNewLeadLabelIds.length > 0) {
                const labelInserts = selectedNewLeadLabelIds.map(labelId => ({
                    lead_id: data.id,
                    label_id: labelId
                }))
                await supabase.from('lead_labels').insert(labelInserts)
            }

            if (data) {
                const selectedLabels = availableLabels.filter(l => selectedNewLeadLabelIds.includes(l.id))
                const newLead = {
                    id: data.id,
                    full_name: data.full_name,
                    whatsapp: data.whatsapp,
                    origin: data.origin,
                    column_id: data.column_id,
                    message_sent: data.message_sent,
                    labels: selectedLabels
                }

                const newColumns = columns.map(col => {
                    if (col.id === targetColumn.id) {
                        return { ...col, leads: [newLead, ...col.leads] }
                    }
                    return col
                })

                setColumns(newColumns)
                toast.success("Lead criado com sucesso!")
                setIsNewLeadOpen(false)
                setNewLeadData({ full_name: "", whatsapp: "" })
                setSelectedNewLeadLabelIds([])
            }

        } catch (error: any) {
            console.error("Erro ao Criar Lead:", error.message || error)
            toast.error("Erro ao criar lead. Verifique o console.")
        } finally {
            setIsCreatingLead(false)
        }
    }

    const handleImportLeads = async () => {
        if (!pasteData.trim()) {
            toast.warning("Cole os dados da planilha antes de importar")
            return
        }

        setIsImporting(true)

        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession()
            if (sessionError || !session?.user) throw new Error("Sessão inválida")

            // Localização da Coluna: Position 0
            const targetColumn = columns.find(c => c.position === 0)
            if (!targetColumn) {
                toast.error("Coluna 'Novos Leads' não encontrada (position 0).")
                setIsImporting(false)
                return
            }

            const lines = pasteData.split("\n").map(l => l.trim()).filter(Boolean)
            
            // Map para remover duplicatas nativas da colagem (mantém o último)
            const uniqueLeadsMap = new Map<string, string>()

            for (const line of lines) {
                // regex atualizado para suportar vírgula única, exceto entre aspas
                const parts = line.split(/\t|;|,/)
                let name = parts[0]?.trim() || "Lead Importado"
                let rawPhone = parts[1]?.trim() || ""

                if (!rawPhone && parts[0]) {
                    const digitsOnly = parts[0].replace(/\D/g, "")
                    if (digitsOnly.length >= 8) {
                        rawPhone = parts[0]
                        name = "Lead Importado"
                    }
                }

                if (rawPhone) {
                    const cleanPhone = cleanPhoneForDb(rawPhone)
                    if (cleanPhone.length >= 8) {
                        name = name.replace(/^["']|["']$/g, "")
                        uniqueLeadsMap.set(cleanPhone, name)
                    }
                }
            }

            if (uniqueLeadsMap.size === 0) {
                toast.warning("Nenhum contato com número de WhatsApp válido foi identificado.")
                setIsImporting(false)
                return
            }

            const phonesToImport = Array.from(uniqueLeadsMap.keys())

            // 1. Buscar leads existentes no banco (Deduplicação)
            const { data: existingLeads, error: existingError } = await supabase
                .from('leads')
                .select('id, whatsapp, full_name, conversation_id')
                .eq('user_id', session.user.id)
                .in('whatsapp', phonesToImport)

            if (existingError) throw existingError

            const existingMap = new Map(existingLeads?.map(l => [l.whatsapp, l]))

            const leadsToInsert: any[] = []
            const leadsToUpdate: any[] = []

            for (const [phone, name] of uniqueLeadsMap.entries()) {
                const existing = existingMap.get(phone)
                if (existing) {
                    if (existing.full_name !== name) {
                        leadsToUpdate.push({ id: existing.id, full_name: name })
                    }
                } else {
                    leadsToInsert.push({ phone, name })
                }
            }

            // 2. Atualizar Nomes se necessário
            for (const updatePayload of leadsToUpdate) {
                await supabase.from('leads').update({ full_name: updatePayload.full_name }).eq('id', updatePayload.id)
            }

            if (leadsToInsert.length === 0) {
                toast.success(`Concluído! ${leadsToUpdate.length} contatos atualizados. Nenhum novo lead para inserir.`)
                setIsImportOpen(false)
                setPasteData("")
                router.refresh()
                return
            }

            // 3. Garantir conversas para os NOVOS leads via UPSERT em lote
            const convUpserts = leadsToInsert.map(l => ({
                user_id: session.user.id,
                contact_phone: l.phone,
                contact_name: l.name,
                is_open: true
            }))

            const { data: convData, error: convError } = await supabase
                .from('conversations')
                .upsert(convUpserts, { onConflict: 'user_id,contact_phone' })
                .select('id, contact_phone')

            if (convError) throw convError

            const convMap = new Map(convData?.map(c => [c.contact_phone, c.id]))

            // 4. Inserir Novos Leads
            const payloads = leadsToInsert.map(l => ({
                user_id: session.user.id,
                column_id: targetColumn.id,
                full_name: l.name,
                whatsapp: l.phone,
                origin: "Outros",
                message_sent: false,
                conversation_id: convMap.get(l.phone) || null
            }))

            const { data, error } = await supabase
                .from('leads')
                .insert(payloads)
                .select()

            if (error) throw error

            toast.success(`${data?.length || 0} criados. ${leadsToUpdate.length} atualizados.`)
            setIsImportOpen(false)
            setPasteData("")
            router.refresh()

        } catch (error: any) {
            console.error("Erro ao importar planilha:", error)
            toast.error("Erro ao importar contatos. Verifique o console.")
        } finally {
            setIsImporting(false)
        }
    }

    return (
        <div className="flex flex-col h-full gap-4">
            {/* Header / Toolbar */}
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    {/* Placeholder */}
                </div>
                <div className="flex items-center gap-2">
                    <LabelManager 
                        availableLabels={availableLabels} 
                        onLabelsChange={() => router.refresh()} 
                    />

                    {/* Add Column Button */}
                    <Dialog open={isAddColumnOpen} onOpenChange={setIsAddColumnOpen}>
                        <DialogTrigger asChild>
                            <Button
                                variant="outline"
                                className="bg-card border-border hover:bg-accent text-muted-foreground hover:text-foreground"
                            >
                                <Plus className="mr-2 h-4 w-4" /> Nova Coluna
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Nova Coluna</DialogTitle>
                                <DialogDescription>Crie uma etapa para seu fluxo.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="col-name" className="text-right">Nome</Label>
                                    <Input
                                        id="col-name"
                                        value={newColumnTitle}
                                        onChange={(e) => setNewColumnTitle(e.target.value)}
                                        className="col-span-3"
                                        placeholder="Ex: Em Negociação"
                                    />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4 mt-2">
                                    <Label htmlFor="col-tag" className="text-right text-xs text-muted-foreground leading-tight">Automação (Tag)</Label>
                                    <Select value={newColumnLabelId} onValueChange={setNewColumnLabelId}>
                                        <SelectTrigger className="col-span-3 h-9">
                                            <SelectValue placeholder="Nenhuma" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Nenhuma</SelectItem>
                                            {availableLabels?.map(label => (
                                                <SelectItem key={label.id} value={label.id}>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: label.color }} />
                                                        {label.title}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleAddColumn} disabled={isCreatingColumn}>
                                    {isCreatingColumn ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Criar Coluna"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* New Lead Button */}
                    <Dialog open={isNewLeadOpen} onOpenChange={setIsNewLeadOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
                                <UserPlus className="mr-2 h-4 w-4" /> Novo Lead
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Novo Lead</DialogTitle>
                                <DialogDescription>Adicione um cliente potencial ao pipeline.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="lead-name">Nome Completo</Label>
                                    <Input
                                        id="lead-name"
                                        value={newLeadData.full_name}
                                        onChange={(e) => setNewLeadData({ ...newLeadData, full_name: e.target.value })}
                                        placeholder="Ex: João da Silva"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="lead-whatsapp">WhatsApp</Label>
                                    <Input
                                        id="lead-whatsapp"
                                        value={newLeadData.whatsapp}
                                        onChange={handlePhoneChange}
                                        placeholder="(11) 99999-9999"
                                        maxLength={15}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Etiquetas</Label>
                                    {availableLabels.length === 0 ? (
                                        <p className="text-xs text-muted-foreground">Nenhuma etiqueta cadastrada.</p>
                                    ) : (
                                        <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-accent/50 border border-border max-h-36 overflow-y-auto custom-scrollbar">
                                            {availableLabels.map((label) => {
                                                const isSelected = selectedNewLeadLabelIds.includes(label.id)
                                                return (
                                                    <button
                                                        key={label.id}
                                                        type="button"
                                                        onClick={() => {
                                                            if (isSelected) {
                                                                setSelectedNewLeadLabelIds(prev => prev.filter(id => id !== label.id))
                                                            } else {
                                                                setSelectedNewLeadLabelIds(prev => [...prev, label.id])
                                                            }
                                                        }}
                                                        style={{
                                                            borderColor: label.color,
                                                            backgroundColor: isSelected ? `${label.color}20` : 'transparent',
                                                            color: isSelected ? '#FFF' : label.color
                                                        }}
                                                        className={`
                                                            px-2.5 py-1 text-xs font-bold rounded-md border transition-all hover:bg-accent
                                                            ${isSelected ? "border-solid font-extrabold" : "border-dashed opacity-60"}
                                                        `}
                                                    >
                                                        {label.title}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleCreateLead} disabled={isCreatingLead}>
                                    {isCreatingLead ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Adicionar Lead"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* Importar Planilha Button */}
                    <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                        <DialogTrigger asChild>
                            <Button
                                variant="outline"
                                className="bg-card border-border hover:bg-accent text-muted-foreground hover:text-foreground"
                            >
                                <FileText className="mr-2 h-4 w-4" /> Importar Planilha
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                                <DialogTitle>Importar Contatos de Planilha</DialogTitle>
                                <DialogDescription>
                                    Copie as colunas de sua planilha Excel ou Google Sheets (Coluna 1: Nome, Coluna 2: Número de WhatsApp) e cole abaixo.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="paste-data">Dados da Planilha</Label>
                                    <Textarea
                                        id="paste-data"
                                        placeholder="Exemplo de conteúdo colado:&#10;João da Silva	(11) 99999-9999&#10;Maria Santos	11988887777"
                                        value={pasteData}
                                        onChange={(e) => setPasteData(e.target.value)}
                                        rows={10}
                                        className="font-mono text-sm bg-accent/50 border-border"
                                    />
                                    <span className="text-xs text-muted-foreground">
                                        Os números serão formatados automaticamente (remoção de parênteses, traços, DDD zero inicial, e o DDI 55 se houver). Os contatos serão criados na coluna de &quot;Novos Leads&quot;.
                                    </span>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setIsImportOpen(false)
                                        setPasteData("")
                                    }}
                                    disabled={isImporting}
                                >
                                    Cancelar
                                </Button>
                                <Button onClick={handleImportLeads} disabled={isImporting}>
                                    {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Importar Contatos"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Board Area */}
            <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
                <div 
                    ref={scrollContainerRef}
                    className="w-full h-full overflow-x-auto overflow-y-auto pb-6 custom-scrollbar select-none">
                    <Droppable droppableId="board" type="column" direction="horizontal">
                        {(provided) => (
                            <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className="inline-flex min-h-full gap-6 items-start px-4 min-w-max"
                            >
                                {columns.map((col, index) => (
                                    <Draggable key={col.id} draggableId={col.id} index={index}>
                                        {(provided) => (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                {...provided.dragHandleProps}
                                                className="flex-shrink-0"
                                            >
                                                <KanbanColumn
                                                    column={col}
                                                    availableLabels={availableLabels}
                                                    isDeletable={index !== 0}
                                                    onRename={handleRenameColumn}
                                                    onDelete={(id) => {
                                                        const c = columns.find(x => x.id === id)
                                                        if (c) setColumnToDelete(c)
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </div>
            </DragDropContext>

            {/* Delete Confirmation */}
            <AlertDialog open={!!columnToDelete} onOpenChange={(open) => !open && !isDeleting && setColumnToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Coluna</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir esta coluna?
                            <br /><br />
                            Todos os leads serão movidos automaticamente para a coluna anterior:
                            {columnToDelete && columns.findIndex(c => c.id === columnToDelete.id) > 0 && (
                                <span className="font-bold text-white ml-1">
                                    {columns[columns.findIndex(c => c.id === columnToDelete.id) - 1]?.title}
                                </span>
                            )}
                            .
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault()
                                handleDeleteColumn()
                            }}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                        >
                            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar Exclusão"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
