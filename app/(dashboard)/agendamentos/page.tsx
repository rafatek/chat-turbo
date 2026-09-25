"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import {
  CalendarClock,
  Clock,
  CheckCircle2,
  AlertCircle,
  Ban,
  Search,
  Plus,
  Loader2,
  Trash2,
  Edit,
  MoreHorizontal,
  MessageSquare,
  RefreshCw,
  Phone,
  User,
  Calendar,
  Send,
  ArrowRight,
  Filter
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { format, formatDistanceToNow, isPast } from "date-fns"
import { ptBR } from "date-fns/locale"

// =============================================
// Interfaces
// =============================================
interface Agendamento {
  id: string
  user_id: string
  lead_id: string | null
  conversation_id: string | null
  contact_phone: string
  content: string
  scheduled_at: string
  status: "pending" | "sent" | "failed" | "cancelled"
  created_at: string
  leads?: {
    id: string
    full_name: string
    whatsapp: string
  } | null
}

interface LeadOption {
  id: string
  full_name: string
  whatsapp: string
  conversation_id?: string | null
}

// =============================================
// Helpers
// =============================================
function formatPhone(phone: string) {
  const clean = phone.replace(/\D/g, "")
  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`
  }
  if (clean.length === 10) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`
  }
  if (clean.length === 13 && clean.startsWith("55")) {
    return `+55 (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`
  }
  return phone
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
}

const AVATAR_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-teal-500"
]

function getAvatarColor(phone: string) {
  const sum = phone.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}

export default function AgendamentosPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  // Leads para seleção
  const [availableLeads, setAvailableLeads] = useState<LeadOption[]>([])
  const [loadingLeads, setLoadingLeads] = useState(false)

  // Dialogs de Criação / Edição
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Agendamento | null>(null)

  // Form States
  const [formPhone, setFormPhone] = useState("")
  const [formName, setFormName] = useState("")
  const [formLeadId, setFormLeadId] = useState<string | null>(null)
  const [formContent, setFormContent] = useState("")
  const [formDate, setFormDate] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Confirmação de Exclusão
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // ---- Obter Usuário Atual ----
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }: { data: { user: any } }) => {
      if (user) setUserId(user.id)
    })
  }, [])

  // ---- Carregar Agendamentos ----
  const fetchAgendamentos = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("agendamentos")
        .select(`
          *,
          leads (
            id,
            full_name,
            whatsapp
          )
        `)
        .eq("user_id", userId)
        .order("scheduled_at", { ascending: true })

      if (error) throw error
      setAgendamentos(data || [])
    } catch (err: any) {
      console.error("Erro ao carregar agendamentos:", err)
      toast.error("Não foi possível carregar os agendamentos.")
    } finally {
      setLoading(false)
    }
  }, [userId])

  // ---- Carregar Leads para o Seletor ----
  const fetchLeads = useCallback(async () => {
    if (!userId) return
    setLoadingLeads(true)
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("id, full_name, whatsapp, conversation_id")
        .eq("user_id", userId)
        .order("full_name", { ascending: true })
        .limit(100)

      if (error) throw error
      setAvailableLeads(data || [])
    } catch (err) {
      console.error("Erro ao carregar leads:", err)
    } finally {
      setLoadingLeads(false)
    }
  }, [userId])

  useEffect(() => {
    if (userId) {
      fetchAgendamentos()
      fetchLeads()
    }
  }, [userId, fetchAgendamentos, fetchLeads])

  // ---- Realtime Subscriptions ----
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel("agendamentos_realtime_page")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agendamentos", filter: `user_id=eq.${userId}` },
        () => {
          fetchAgendamentos()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, fetchAgendamentos])

  // ---- Métricas Rápidas ----
  const stats = useMemo(() => {
    const total = agendamentos.length
    const pending = agendamentos.filter((a) => a.status === "pending").length
    const sent = agendamentos.filter((a) => a.status === "sent").length
    const cancelledOrFailed = agendamentos.filter(
      (a) => a.status === "cancelled" || a.status === "failed"
    ).length
    return { total, pending, sent, cancelledOrFailed }
  }, [agendamentos])

  // ---- Filtragem ----
  const filteredAgendamentos = useMemo(() => {
    return agendamentos.filter((item) => {
      // Filtro de status
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false
      }

      // Filtro de busca textual
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchPhone = item.contact_phone?.toLowerCase().includes(q)
        const matchName = item.leads?.full_name?.toLowerCase().includes(q)
        const matchContent = item.content?.toLowerCase().includes(q)
        return matchPhone || matchName || matchContent
      }

      return true
    })
  }, [agendamentos, statusFilter, searchQuery])

  // ---- Abrir Modal de Criação ----
  const handleOpenCreate = () => {
    setFormPhone("")
    setFormName("")
    setFormLeadId(null)
    setFormContent("")
    setFormDate("")
    setIsCreateOpen(true)
  }

  // ---- Abrir Modal de Edição ----
  const handleOpenEdit = (item: Agendamento) => {
    setEditingItem(item)
    setFormPhone(item.contact_phone)
    setFormName(item.leads?.full_name || "")
    setFormLeadId(item.lead_id)
    setFormContent(item.content)
    
    // Formatar data para input datetime-local
    const dt = new Date(item.scheduled_at)
    const localIso = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16)
    setFormDate(localIso)

    setIsEditOpen(true)
  }

  // ---- Selecionar Lead no Form ----
  const handleSelectLead = (leadId: string) => {
    const lead = availableLeads.find((l) => l.id === leadId)
    if (lead) {
      setFormLeadId(lead.id)
      setFormName(lead.full_name)
      setFormPhone(lead.whatsapp)
    }
  }

  // ---- Salvar Novo Agendamento ----
  const handleSaveCreate = async () => {
    if (!userId || !formPhone.trim() || !formContent.trim() || !formDate) {
      toast.warning("Preencha todos os campos obrigatórios.")
      return
    }

    const cleanPhone = formPhone.replace(/\D/g, "")
    if (cleanPhone.length < 10) {
      toast.warning("Digite um número de WhatsApp válido.")
      return
    }

    setIsSubmitting(true)
    try {
      const scheduledAt = new Date(formDate).toISOString()

      // Tenta achar ou vincular conversa se houver
      let convId: string | null = null
      if (formLeadId) {
        const { data: convData } = await supabase
          .from("conversations")
          .select("id")
          .eq("user_id", userId)
          .eq("contact_phone", cleanPhone)
          .maybeSingle()
        if (convData) convId = convData.id
      }

      const { error } = await supabase.from("agendamentos").insert({
        user_id: userId,
        lead_id: formLeadId || null,
        conversation_id: convId,
        contact_phone: cleanPhone,
        content: formContent.trim(),
        scheduled_at: scheduledAt,
        status: "pending",
      })

      if (error) throw error

      toast.success("Mensagem agendada com sucesso!")
      setIsCreateOpen(false)
      fetchAgendamentos()
    } catch (err: any) {
      console.error("Erro ao criar agendamento:", err)
      toast.error(`Erro ao criar agendamento: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ---- Salvar Edição ----
  const handleSaveEdit = async () => {
    if (!editingItem || !formContent.trim() || !formDate) {
      toast.warning("Preencha todos os campos obrigatórios.")
      return
    }

    setIsSubmitting(true)
    try {
      const scheduledAt = new Date(formDate).toISOString()

      const { error } = await supabase
        .from("agendamentos")
        .update({
          content: formContent.trim(),
          scheduled_at: scheduledAt,
          status: "pending", // Reativa caso estivesse cancelado/falho
        })
        .eq("id", editingItem.id)

      if (error) throw error

      toast.success("Agendamento atualizado com sucesso!")
      setIsEditOpen(false)
      setEditingItem(null)
      fetchAgendamentos()
    } catch (err: any) {
      console.error("Erro ao atualizar agendamento:", err)
      toast.error(`Erro ao atualizar: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ---- Cancelar Agendamento ----
  const handleCancelAgendamento = async (id: string) => {
    try {
      const { error } = await supabase
        .from("agendamentos")
        .update({ status: "cancelled" })
        .eq("id", id)

      if (error) throw error
      toast.info("Agendamento cancelado.")
      fetchAgendamentos()
    } catch (err: any) {
      toast.error("Erro ao cancelar agendamento.")
    }
  }

  // ---- Excluir Agendamento Permanentemente ----
  const handleConfirmDelete = async () => {
    if (!deletingId) return
    setIsDeleting(true)
    try {
      const { error } = await supabase
        .from("agendamentos")
        .delete()
        .eq("id", deletingId)

      if (error) throw error
      toast.success("Agendamento excluído permanentemente.")
      setDeletingId(null)
      fetchAgendamentos()
    } catch (err: any) {
      toast.error("Erro ao excluir agendamento.")
    } finally {
      setIsDeleting(false)
    }
  }

  // ---- Status Badge Component ----
  const renderStatusBadge = (status: Agendamento["status"], scheduledAt: string) => {
    const isOverdue = status === "pending" && isPast(new Date(scheduledAt))

    switch (status) {
      case "pending":
        if (isOverdue) {
          return (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 gap-1 font-medium">
              <AlertCircle className="h-3 w-3" />
              Atrasado
            </Badge>
          )
        }
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-[#00A3FF] border-blue-500/30 gap-1 font-medium">
            <Clock className="h-3 w-3" />
            Pendente
          </Badge>
        )
      case "sent":
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 gap-1 font-medium">
            <CheckCircle2 className="h-3 w-3" />
            Enviado
          </Badge>
        )
      case "failed":
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 gap-1 font-medium">
            <AlertCircle className="h-3 w-3" />
            Falhou
          </Badge>
        )
      case "cancelled":
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground border-border gap-1 font-medium">
            <Ban className="h-3 w-3" />
            Cancelado
          </Badge>
        )
      default:
        return null
    }
  }

  return (
    <div className="flex-1 h-full min-h-0 overflow-y-auto custom-scrollbar">
      <div className="space-y-6 p-4 md:p-8 max-w-7xl mx-auto w-full pb-24">
      {/* ===== HEADER ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00A3FF]/10 text-[#00A3FF] border border-[#00A3FF]/20 shadow-sm">
              <CalendarClock className="h-5 w-5" />
            </div>
            Agendamentos de Mensagens
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie e acompanhe todos os disparos programados de mensagens para seus clientes.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAgendamentos}
            disabled={loading}
            className="h-9 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
          <Button
            onClick={handleOpenCreate}
            className="h-9 bg-[#00A3FF] hover:bg-[#0082CC] text-white shadow-md shadow-[#00A3FF]/20 gap-2 text-xs font-semibold"
          >
            <Plus className="h-4 w-4" />
            Novo Agendamento
          </Button>
        </div>
      </div>

      {/* ===== METRICS CARDS ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Agendados</p>
              <p className="text-2xl font-bold text-foreground mt-0.5">{stats.total}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-muted-foreground">
              <Calendar className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Pendentes</p>
              <p className="text-2xl font-bold text-[#00A3FF] mt-0.5">{stats.pending}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00A3FF]/10 text-[#00A3FF]">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Enviados</p>
              <p className="text-2xl font-bold text-emerald-500 mt-0.5">{stats.sent}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Cancelados / Falhas</p>
              <p className="text-2xl font-bold text-rose-500 mt-0.5">{stats.cancelledOrFailed}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">
              <Ban className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== FILTERS & SEARCH ===== */}
      <Card className="bg-card border-border shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por telefone, nome ou conteúdo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm bg-background border-border"
              />
            </div>

            {/* Status Filter Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 custom-scrollbar">
              <Button
                variant={statusFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("all")}
                className="h-8 text-xs font-medium"
              >
                Todos ({stats.total})
              </Button>
              <Button
                variant={statusFilter === "pending" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("pending")}
                className={cn(
                  "h-8 text-xs font-medium",
                  statusFilter === "pending" ? "bg-[#00A3FF] text-white" : ""
                )}
              >
                Pendentes ({stats.pending})
              </Button>
              <Button
                variant={statusFilter === "sent" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("sent")}
                className={cn(
                  "h-8 text-xs font-medium",
                  statusFilter === "sent" ? "bg-emerald-600 text-white" : ""
                )}
              >
                Enviados ({stats.sent})
              </Button>
              <Button
                variant={statusFilter === "cancelled" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("cancelled")}
                className="h-8 text-xs font-medium"
              >
                Cancelados
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===== TABLE CONTENT ===== */}
      <Card className="bg-card border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#00A3FF]" />
            <p className="text-xs text-muted-foreground">Carregando agendamentos...</p>
          </div>
        ) : filteredAgendamentos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-muted-foreground mb-3">
              <CalendarClock className="h-7 w-7 opacity-60" />
            </div>
            <h3 className="text-base font-semibold text-foreground">Nenhum agendamento encontrado</h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
              {searchQuery || statusFilter !== "all"
                ? "Tente ajustar os filtros de busca para encontrar o que procura."
                : "Você ainda não possui mensagens programadas. Crie um agendamento para começar."}
            </p>
            {!searchQuery && statusFilter === "all" && (
              <Button onClick={handleOpenCreate} size="sm" className="bg-[#00A3FF] hover:bg-[#0082CC] text-white gap-2 text-xs">
                <Plus className="h-3.5 w-3.5" />
                Criar Primeiro Agendamento
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="w-[240px]">Contato / Lead</TableHead>
                  <TableHead>Mensagem Programada</TableHead>
                  <TableHead className="w-[200px]">Data e Hora do Envio</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[80px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAgendamentos.map((item) => {
                  const leadName = item.leads?.full_name || "Lead Direto"
                  const phoneFormatted = formatPhone(item.contact_phone)
                  const scheduledDate = new Date(item.scheduled_at)

                  return (
                    <TableRow key={item.id} className="border-border hover:bg-accent/40 transition-colors">
                      {/* Contato / Lead */}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={cn("h-9 w-9 rounded-full flex items-center justify-center font-bold text-white text-xs flex-shrink-0", getAvatarColor(item.contact_phone))}>
                            {getInitials(leadName !== "Lead Direto" ? leadName : item.contact_phone)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{leadName}</p>
                            <p className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {phoneFormatted}
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      {/* Mensagem */}
                      <TableCell>
                        <div className="max-w-md">
                          <p className="text-sm text-foreground/90 line-clamp-2 leading-relaxed">
                            {item.content}
                          </p>
                        </div>
                      </TableCell>

                      {/* Data e Hora */}
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="text-xs font-semibold text-foreground">
                            {format(scheduledDate, "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatDistanceToNow(scheduledDate, { addSuffix: true, locale: ptBR })}
                          </p>
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell>{renderStatusBadge(item.status, item.scheduled_at)}</TableCell>

                      {/* Ações */}
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 bg-card border-border shadow-lg">
                            <DropdownMenuItem
                              onClick={() => router.push(`/atendimento?phone=${item.contact_phone}`)}
                              className="text-xs cursor-pointer gap-2"
                            >
                              <MessageSquare className="h-3.5 w-3.5 text-[#00A3FF]" />
                              Abrir no Atendimento
                            </DropdownMenuItem>

                            {item.status === "pending" && (
                              <>
                                <DropdownMenuItem onClick={() => handleOpenEdit(item)} className="text-xs cursor-pointer gap-2">
                                  <Edit className="h-3.5 w-3.5" />
                                  Editar Mensagem
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleCancelAgendamento(item.id)}
                                  className="text-xs cursor-pointer gap-2 text-amber-500 focus:text-amber-500"
                                >
                                  <Ban className="h-3.5 w-3.5" />
                                  Cancelar Disparo
                                </DropdownMenuItem>
                              </>
                            )}

                            {(item.status === "cancelled" || item.status === "failed") && (
                              <DropdownMenuItem onClick={() => handleOpenEdit(item)} className="text-xs cursor-pointer gap-2 text-emerald-400 focus:text-emerald-400">
                                <RefreshCw className="h-3.5 w-3.5" />
                                Reagendar Mensagem
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuSeparator className="bg-border" />

                            <DropdownMenuItem
                              onClick={() => setDeletingId(item.id)}
                              className="text-xs cursor-pointer gap-2 text-red-400 focus:text-red-400 focus:bg-red-500/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Excluir Registro
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* ===== DIALOG: CRIAR NOVO AGENDAMENTO ===== */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[500px] bg-card border-border text-foreground shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00A3FF]/10 text-[#00A3FF]">
                <CalendarClock className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle>Novo Agendamento</DialogTitle>
                <DialogDescription className="text-xs">
                  Programe uma mensagem no WhatsApp para ser enviada na data e horário desejados.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Selecionar Lead ou Digitar Telefone */}
            {availableLeads.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Selecionar Lead do CRM (opcional)</Label>
                <select
                  value={formLeadId || ""}
                  onChange={(e) => handleSelectLead(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-[#00A3FF]"
                >
                  <option value="">-- Escolha um contato ou preencha abaixo --</option>
                  {availableLeads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.full_name} ({formatPhone(l.whatsapp)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Número de WhatsApp *</Label>
                <Input
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="Ex: 11999998888"
                  className="h-9 text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Nome (opcional)</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: João da Silva"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Data e Hora */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Data e Horário do Envio *</Label>
              <Input
                type="datetime-local"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="h-9 text-xs [color-scheme:dark]"
              />
            </div>

            {/* Conteúdo da Mensagem */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Mensagem que será enviada *</Label>
              <Textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="Digite a mensagem que o cliente receberá..."
                rows={4}
                className="text-xs resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" size="sm" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting} className="text-xs">
              Cancelar
            </Button>
            <Button onClick={handleSaveCreate} disabled={isSubmitting} size="sm" className="bg-[#00A3FF] hover:bg-[#0082CC] text-white text-xs gap-1.5">
              {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="h-3.5 w-3.5" />}
              {isSubmitting ? "Agendando..." : "Confirmar Agendamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== DIALOG: EDITAR AGENDAMENTO ===== */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[480px] bg-card border-border text-foreground shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <Edit className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle>Editar Agendamento</DialogTitle>
                <DialogDescription className="text-xs">
                  Atualize a mensagem ou altere o horário programado.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-accent/40 border border-border flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <p className="font-semibold text-foreground">{editingItem?.leads?.full_name || "Lead Direto"}</p>
                <p className="font-mono text-muted-foreground">{editingItem && formatPhone(editingItem.contact_phone)}</p>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {editingItem?.status}
              </Badge>
            </div>

            {/* Data e Hora */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Novo Horário do Envio *</Label>
              <Input
                type="datetime-local"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="h-9 text-xs [color-scheme:dark]"
              />
            </div>

            {/* Conteúdo da Mensagem */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Mensagem *</Label>
              <Textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                rows={4}
                className="text-xs resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" size="sm" onClick={() => setIsEditOpen(false)} disabled={isSubmitting} className="text-xs">
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSubmitting} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5">
              {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {isSubmitting ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== ALERT DIALOG: CONFIRMAR EXCLUSÃO ===== */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => { if (!open) setDeletingId(null) }}>
        <AlertDialogContent className="bg-card border-border text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-rose-500 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Excluir Agendamento Permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-xs">
              Esta ação removerá este agendamento do banco de dados e ele não será disparado. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="text-xs">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmDelete()
              }}
              disabled={isDeleting}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs"
            >
              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </div>
  )
}
