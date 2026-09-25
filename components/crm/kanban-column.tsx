import { Droppable } from "@hello-pangea/dnd"
import { KanbanCard } from "./kanban-card"
import { Column, Label as KanbanLabel } from "@/types/kanban"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Trash2, Edit2, Loader2, Check } from "lucide-react"
import { useState } from "react"

interface KanbanColumnProps {
    column: Column
    onDelete?: (columnId: string) => void
    onRename?: (columnId: string, newTitle: string) => Promise<void>
    availableLabels?: KanbanLabel[]
    isDeletable?: boolean // nova prop
}

export function KanbanColumn({ column, onDelete, onRename, availableLabels = [], isDeletable = true }: KanbanColumnProps) {
    const linkedLabel = availableLabels.find(l => l.id === column.linked_label_id)
    
    const [isEditing, setIsEditing] = useState(false)
    const [editTitle, setEditTitle] = useState(column.title)
    const [isSaving, setIsSaving] = useState(false)

    const handleSaveTitle = async () => {
        if (editTitle.trim() === "" || editTitle === column.title) {
            setIsEditing(false)
            setEditTitle(column.title)
            return
        }
        setIsSaving(true)
        if (onRename) {
            await onRename(column.id, editTitle)
        }
        setIsSaving(false)
        setIsEditing(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleSaveTitle()
        } else if (e.key === "Escape") {
            setIsEditing(false)
            setEditTitle(column.title)
        }
    }

    const totalColumnValue = column.leads.reduce((acc, lead) => {
        let val = 0
        if (lead.valor !== undefined) val = Number(lead.valor)
        else if (lead.value !== undefined) val = lead.value / 100
        else if (lead.price !== undefined) val = lead.price / 100
        return acc + val
    }, 0)

    return (
        <div data-column-id={column.id} className="flex flex-col w-[350px] min-w-[350px] flex-shrink-0 h-full max-h-full">
            {/* Column Header */}
            <div className="flex items-center justify-between p-4 mb-2 rounded-lg bg-card border border-border group">
                <div className="flex flex-col gap-1.5 flex-1 mr-2">
                    <div className="flex items-center gap-2">
                        {isEditing ? (
                            <div className="flex items-center w-full gap-1">
                                <input 
                                    autoFocus
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    onBlur={handleSaveTitle}
                                    onKeyDown={handleKeyDown}
                                    disabled={isSaving}
                                    className="bg-background text-sm font-semibold text-foreground px-2 py-1 rounded w-full outline-none border border-border focus:border-[#00A3FF]"
                                />
                                {isSaving && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}
                            </div>
                        ) : (
                            <>
                                <h3 
                                    className="font-semibold text-sm text-foreground cursor-text hover:text-primary transition-colors"
                                    onClick={() => setIsEditing(true)}
                                    title="Clique para renomear"
                                >
                                    {column.title}
                                </h3>
                                <Badge variant="secondary" className="text-xs bg-accent hover:bg-accent/80 text-muted-foreground ml-1">
                                    {column.leads.length}
                                </Badge>
                                <button 
                                    onClick={() => setIsEditing(true)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                >
                                    <Edit2 className="h-3 w-3" />
                                </button>
                            </>
                        )}
                    </div>
                    {linkedLabel && (
                        <div className="flex items-center gap-1.5 opacity-80" title="Leads com esta tag movem para esta coluna">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: linkedLabel.color }} />
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider line-clamp-1">{linkedLabel.title}</span>
                        </div>
                    )}
                </div>

                {!isEditing && isDeletable && onDelete && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => onDelete(column.id)}
                        title="Excluir Coluna"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                )}
            </div>

            {/* Total Value row */}
            {totalColumnValue > 0 && (
                <div className="px-2 mb-3">
                    <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded px-3 py-1.5">
                        <span className="text-[10px] uppercase font-bold text-emerald-500/80 tracking-wider">Total</span>
                        <span className="text-xs font-bold text-emerald-400">
                            R$ {totalColumnValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>
            )}

            {/* Droppable Area */}
            <Droppable droppableId={column.id} type="lead">
                {(provided, snapshot) => (
                    <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={`
                flex-1 flex flex-col gap-3 p-2 rounded-lg transition-colors overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent
                ${snapshot.isDraggingOver ? "bg-accent/30" : "bg-transparent"}
            `}
                        style={{ minHeight: '150px', flexGrow: 1, maxHeight: 'calc(100vh - 200px)' }}
                    >
                        {column.leads.map((lead, index) => (
                            <KanbanCard key={lead.id} lead={lead} index={index} availableLabels={availableLabels} />
                        ))}
                        {provided.placeholder}
                    </div>
                )}
            </Droppable>
        </div>
    )
}
