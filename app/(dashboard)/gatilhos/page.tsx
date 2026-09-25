"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { 
  Plus, 
  Trash2, 
  Loader2, 
  Search, 
  Zap, 
  Tag
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"


interface Gatilho {
  id: string
  trigger_text: string
  label_id: string
  created_at: string
}

interface CrmLabel {
  id: string
  title: string
  color: string
}

export default function GatilhosPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [gatilhos, setGatilhos] = useState<Gatilho[]>([])
  const [labels, setLabels] = useState<CrmLabel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")

  // Form State
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newTriggerText, setNewTriggerText] = useState("")
  const [newLabelIds, setNewLabelIds] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      }
    }
    fetchUser()
  }, [])

  useEffect(() => {
    if (userId) {
      loadData()
    }
  }, [userId])

  const loadData = async () => {
    setIsLoading(true)
    try {
      // Load Labels
      const { data: labelsData, error: labelsError } = await supabase
        .from('labels')
        .select('*')
        .eq('user_id', userId)
      
      if (labelsError) throw labelsError
      setLabels(labelsData || [])

      // Load Gatilhos
      const { data: gatilhosData, error: gatilhosError } = await supabase
        .from('gatilhos')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      
      if (gatilhosError) throw gatilhosError
      setGatilhos(gatilhosData || [])

    } catch (err: any) {
      toast.error("Erro ao carregar dados")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!newTriggerText.trim() || newLabelIds.length === 0) {
      toast.warning("Preencha o texto e selecione pelo menos uma etiqueta.")
      return
    }

    setIsSaving(true)
    try {
      // Insert multiple rows
      const inserts = newLabelIds.map(labelId => ({
        user_id: userId,
        trigger_text: newTriggerText.trim().toLowerCase(),
        label_id: labelId
      }))

      const { error } = await supabase
        .from('gatilhos')
        .insert(inserts)
      
      if (error) throw error
      
      toast.success("Gatilho criado com sucesso!")
      setIsDialogOpen(false)
      setNewTriggerText("")
      setNewLabelIds([])
      loadData()
    } catch (err: any) {
      toast.error("Erro ao criar gatilho")
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja apagar este gatilho?")) return

    try {
      const { error } = await supabase
        .from('gatilhos')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      toast.success("Gatilho removido!")
      loadData()
    } catch (err: any) {
      toast.error("Erro ao remover gatilho")
      console.error(err)
    }
  }

  const filteredGatilhos = gatilhos.filter(g => 
    g.trigger_text.toLowerCase().includes(search.toLowerCase())
  )

  const getLabelInfo = (labelId: string) => {
    return labels.find(l => l.id === labelId)
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0A0A0E] overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 md:p-8 gap-4 border-b border-white/5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap className="h-6 w-6 text-[#00A3FF]" />
            Gatilhos de Mensagem
          </h1>
          <p className="text-gray-400 mt-1">Aplique etiquetas automaticamente aos novos leads com base na primeira mensagem recebida.</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#00A3FF] hover:bg-[#00A3FF]/80 text-white gap-2 h-10 px-4">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Novo Gatilho</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-[#12121A] border-white/10 text-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-[#00A3FF]">
                <Zap className="h-5 w-5" />
                Criar Gatilho
              </DialogTitle>
              <DialogDescription className="text-gray-400 text-xs">
                Se a primeira mensagem de um novo lead contiver o texto abaixo, ele será etiquetado automaticamente.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="trigger_text" className="text-gray-300">Texto da Mensagem (contém)</Label>
                <Input
                  id="trigger_text"
                  placeholder="Ex: olá, gostaria de saber mais"
                  value={newTriggerText}
                  onChange={(e) => setNewTriggerText(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-[#00A3FF]/30"
                />
                <p className="text-[10px] text-gray-500">O sistema vai ignorar maiúsculas/minúsculas.</p>
              </div>
              
              <div className="space-y-2">
                <Label className="text-gray-300">Etiquetas a serem aplicadas</Label>
                <div className="flex flex-wrap gap-2 pt-1 max-h-[150px] overflow-y-auto custom-scrollbar">
                  {labels.length === 0 ? (
                    <div className="text-xs text-gray-500">Nenhuma etiqueta encontrada.</div>
                  ) : (
                    labels.map((lbl) => {
                      const isSelected = newLabelIds.includes(lbl.id);
                      return (
                        <button
                          key={lbl.id}
                          onClick={() => {
                            if (isSelected) {
                              setNewLabelIds(prev => prev.filter(id => id !== lbl.id));
                            } else {
                              setNewLabelIds(prev => [...prev, lbl.id]);
                            }
                          }}
                          className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all cursor-pointer",
                            isSelected 
                              ? "bg-white/10 text-white border-white/20" 
                              : "bg-white/5 text-gray-400 border-white/5 hover:bg-white/10"
                          )}
                        >
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: lbl.color }}></div>
                          {lbl.title}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="text-gray-400 hover:text-white hover:bg-white/5">
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={isSaving} className="bg-[#00A3FF] hover:bg-[#00A3FF]/80 text-white">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Salvar Gatilho
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 p-6 md:p-8 overflow-y-auto custom-scrollbar">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#00A3FF]" />
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            
            {/* Barra de Busca */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Buscar gatilhos por texto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-white/5 border-white/10 text-white h-12 rounded-xl focus-visible:ring-[#00A3FF]/30 placeholder:text-gray-600"
              />
            </div>

            {/* Listagem */}
            {filteredGatilhos.length === 0 ? (
              <div className="text-center py-16 px-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                <Zap className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">Nenhum gatilho encontrado</h3>
                <p className="text-gray-400 text-sm max-w-md mx-auto">
                  {search ? "Não há gatilhos que correspondam à sua busca." : "Crie regras para classificar seus leads automaticamente assim que eles mandarem a primeira mensagem."}
                </p>
                {!search && (
                  <Button onClick={() => setIsDialogOpen(true)} variant="outline" className="mt-6 bg-transparent border-white/10 text-white hover:bg-white/5 hover:text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    Criar meu primeiro Gatilho
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredGatilhos.map((gatilho) => {
                  const label = getLabelInfo(gatilho.label_id);
                  return (
                    <div key={gatilho.id} className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:border-white/10 transition-colors group">
                      
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Se a mensagem contiver:</span>
                        </div>
                        <div className="text-white font-medium text-sm lg:text-base border border-white/10 bg-black/20 px-3 py-2 rounded-lg inline-block">
                          "{gatilho.trigger_text}"
                        </div>
                      </div>

                      <div className="flex items-center self-stretch sm:self-auto min-h-full sm:min-h-0 sm:border-l sm:border-t-0 border-t border-white/10 pt-3 sm:pt-0 sm:pl-6 pl-0">
                        <div className="flex flex-1 flex-col space-y-1.5 sm:w-48">
                           <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Aplicar Etiqueta:</span>
                           {label ? (
                             <div className="flex items-center gap-2 max-w-full">
                               <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: label.color }}></div>
                               <span className="text-sm font-medium text-gray-200 truncate">{label.title}</span>
                             </div>
                           ) : (
                             <div className="flex items-center gap-2 text-red-400/80">
                               <Tag className="h-3.5 w-3.5" />
                               <span className="text-xs font-medium">Etiqueta deletada</span>
                             </div>
                           )}
                        </div>
                        
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDelete(gatilho.id)}
                          className="h-9 w-9 text-gray-500 hover:text-red-400 hover:bg-red-500/10 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 ml-4"
                          title="Excluir gatilho"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
