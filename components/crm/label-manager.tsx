"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { Plus, Trash2, Loader2, Tag } from "lucide-react"
import { Label as KanbanLabel } from "@/types/kanban"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface LabelManagerProps {
    availableLabels: KanbanLabel[]
    onLabelsChange: () => void // Para mandar o pai dar refetch
}

const PRESET_COLORS = [
    "#EF4444", "#F97316", "#F59E0B", "#84CC16", 
    "#10B981", "#06B6D4", "#3B82F6", "#6366F1", 
    "#8B5CF6", "#D946EF", "#F43F5E", "#64748B"
]

export function LabelManager({ availableLabels, onLabelsChange }: LabelManagerProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [title, setTitle] = useState("")
    const [color, setColor] = useState(PRESET_COLORS[0])
    const [isSaving, setIsSaving] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const handleCreate = async () => {
        if (!title.trim()) return
        setIsSaving(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.user) throw new Error("Não autenticado")

            const { error } = await supabase.from('labels').insert({
                title: title.trim().toUpperCase(),
                color,
                user_id: session.user.id
            })

            if (error) throw error

            toast.success("Etiqueta criada!")
            setTitle("")
            onLabelsChange()
        } catch (err: any) {
            toast.error(err.message || "Erro ao criar etiqueta")
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        setDeletingId(id)
        try {
            const { error } = await supabase.from('labels').delete().eq('id', id)
            if (error) throw error

            toast.success("Etiqueta removida!")
            onLabelsChange()
        } catch (err: any) {
            toast.error("Erro ao remover etiqueta")
        } finally {
            setDeletingId(null)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="bg-[#111114] border-white/10 hover:bg-white/5 text-gray-300 hover:text-white">
                    <Tag className="mr-2 h-4 w-4" /> Etiquetas
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Gerenciar Etiquetas</DialogTitle>
                    <DialogDescription>
                        Crie e exclua as etiquetas que você usa para organizar seus leads.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-6 py-4">
                    {/* Add New Section */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-gray-200">Criar Nova Etiqueta</h4>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <Input 
                                    placeholder="Ex: PRIORIDADE ALTA" 
                                    value={title} 
                                    onChange={(e) => setTitle(e.target.value)} 
                                    className="uppercase"
                                />
                            </div>
                            <div className="w-10 h-10 rounded-md overflow-hidden flex-shrink-0 border border-white/10 relative">
                                <input 
                                    type="color" 
                                    value={color}
                                    onChange={(e) => setColor(e.target.value)}
                                    className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer"
                                />
                            </div>
                            <Button onClick={handleCreate} disabled={!title.trim() || isSaving} className="bg-[#00A3FF] hover:bg-[#00A3FF]/80">
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            </Button>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            {PRESET_COLORS.map(c => (
                                <button 
                                    key={c} 
                                    onClick={() => setColor(c)}
                                    className={cn("w-5 h-5 rounded-full border border-white/10 transition-transform hover:scale-110", color === c && "ring-2 ring-white/50")}
                                    style={{ backgroundColor: c }}
                                    title={c}
                                    aria-label={`Cor ${c}`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* List Existing Section */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-gray-200">Etiquetas Existentes ({availableLabels.length})</h4>
                        <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                            {availableLabels.length === 0 ? (
                                <p className="text-sm text-gray-500 text-center py-4">Nenhuma etiqueta criada ainda.</p>
                            ) : (
                                availableLabels.map(label => (
                                    <div key={label.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: label.color }} />
                                            <span className="text-sm font-semibold tracking-wide text-gray-200">{label.title}</span>
                                        </div>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => handleDelete(label.id)}
                                            disabled={deletingId === label.id}
                                            className="h-7 w-7 text-gray-500 hover:text-red-400 hover:bg-white/5"
                                        >
                                            {deletingId === label.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
