"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import {
  Target,
  Save,
  Loader2,
  BrainCircuit,
  MessageSquare,
  Flame,
  ShieldOff,
  TrendingUp,
  Power,
  Info,
  Calendar,
  RefreshCw,
  Search,
  UserX,
  UserCheck,
  Clock,
  Plus,
  Trash2,
  Zap,
  Hexagon,
  ShieldAlert,
  ListOrdered,
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Pencil,
  Check,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
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

// ─── Types & Defaults ─────────────────────────────────────────────────────────

export interface TimeRule {
  id: string
  days: number
  hours: number
  minutes: number
  label: string
}

export interface RemarketingConfig {
  id?: string
  user_id: string
  is_active: boolean
  agent_mode: "passive" | "proactive"
  time_rules: TimeRule[]
  ai_prompt: string
  max_attempts?: number
  template_cold?: string
  template_interested?: string
  template_objection?: string
}

export interface QueueItem {
  id: string
  step: number
  scheduled_at: string
  created_at: string
  metadata: {
    label?: string
    days?: number
    hours?: number
    minutes?: number
  }
  lead: {
    id: string
    full_name: string
    whatsapp: string
    conversation_id?: string | null
    display_name?: string
  }
}

interface RemarketingStats {
  active: number
  optout: number
  converted: number
  total: number
}

interface SearchResultLead {
  id: string
  full_name: string
  whatsapp: string
  rmk: {
    lead_id?: string
    rmk_enabled?: boolean
    remarketing_status?: string
    remarketing_attempts?: number
  } | null
}

const DEFAULT_TIME_RULES: TimeRule[] = [
  { id: "1", days: 0, hours: 0, minutes: 5, label: "Após 5 minutos" },
  { id: "2", days: 0, hours: 0, minutes: 10, label: "Após 10 minutos" },
  { id: "3", days: 0, hours: 0, minutes: 15, label: "Após 15 minutos" },
]

const DEFAULT_AI_PROMPT = `Você é um consultor especializado em reengajamento de leads.
O lead abaixo não respondeu há algum tempo. Sua missão é retomar o contato de forma natural, 
sem ser invasivo, demonstrando valor e curiosidade genuína.

Regras obrigatórias:
- Responda APENAS em JSON estruturado com: { "mensagem": "...", "estagio_funil": "cold|interested|objection", "intencao_optout": false }
- Seja direto, humano e conciso (máx. 3 linhas)
- Nunca mencione que é uma automação
- Se o lead demonstrar desinteresse claro, retorne intencao_optout: true`

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateRuleLabel(days: number, hours: number, minutes: number): { label: string; subtitle: string } {
  const parts: string[] = []
  const shortParts: string[] = []

  if (days > 0) {
    parts.push(`${days} ${days === 1 ? "dia" : "dias"}`)
    shortParts.push(`${days}d`)
  }
  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? "hora" : "horas"}`)
    shortParts.push(`${hours}h`)
  }
  if (minutes > 0) {
    parts.push(`${minutes} ${minutes === 1 ? "minuto" : "minutos"}`)
    shortParts.push(`${minutes}min`)
  }

  if (parts.length === 0) {
    return {
      label: "Imediato",
      subtitle: "Imediatamente após o momento da ativação",
    }
  }

  let text = ""
  if (parts.length === 1) {
    text = parts[0]
  } else if (parts.length === 2) {
    text = `${parts[0]} e ${parts[1]}`
  } else {
    text = `${parts[0]}, ${parts[1]} e ${parts[2]}`
  }

  return {
    label: `Após ${text}`,
    subtitle: `${shortParts.join(" ")} após o momento da ativação`,
  }
}

function isGenericName(name?: string | null, phone?: string | null): boolean {
  if (!name || name.trim().length === 0) return true
  const n = name.trim().toLowerCase()
  if (phone && n === phone.toLowerCase()) return true
  if (/^\d+$/.test(n)) return true
  if (n.includes("lead whatsapp") || n.includes("lead externo") || n.includes("lead importado")) return true
  if (n === "sem nome" || n === "lead desconhecido" || n === "sem razão social") return true
  return false
}

function formatPhoneDisplay(phone?: string | null): string {
  if (!phone) return ""
  const digits = phone.replace(/\D/g, "")
  const local = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`
  }
  return phone
}

function getRmkStatusLabel(rmk: SearchResultLead["rmk"]): { label: string; color: string } {
  if (!rmk || rmk.rmk_enabled === false)
    return { label: "RMK Inativo", color: "text-muted-foreground bg-accent/50 border-border" }
  const status = rmk.remarketing_status
  if (!status || status === "none")
    return { label: "Aguardando disparo", color: "text-muted-foreground bg-accent/50 border-border" }
  if (["sent_1", "sent_2", "sent_3", "sent_4"].includes(status))
    return {
      label: `Em sequência (${rmk.remarketing_attempts}x)`,
      color: "text-[#8E3AAA] bg-[#8E3AAA]/10 border-[#8E3AAA]/20",
    }
  if (status === "optout") return { label: "Opt-out", color: "text-red-500 bg-red-500/10 border-red-500/20" }
  if (status === "converted")
    return { label: "Convertido", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" }
  return { label: status, color: "text-muted-foreground bg-accent/50 border-border" }
}

function formatRelativeTime(dateString: string): string {
  const target = new Date(dateString).getTime()
  const now = Date.now()
  const diffMs = target - now
  const diffMin = Math.round(diffMs / (1000 * 60))

  if (diffMin < 0) {
    const minsAgo = Math.abs(diffMin)
    if (minsAgo < 60) return `Atrasado há ${minsAgo}m`
    const hoursAgo = Math.round(minsAgo / 60)
    return `Atrasado há ${hoursAgo}h`
  }
  if (diffMin === 0) return "Agora"
  if (diffMin < 60) return `Em ${diffMin} min`
  const diffHours = Math.round(diffMin / 60)
  if (diffHours < 24) return `Em ${diffHours}h`
  const diffDays = Math.round(diffHours / 24)
  return `Em ${diffDays}d`
}

function formatScheduledDate(dateString: string): string {
  try {
    const d = new Date(dateString)
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return dateString
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RemarketingPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [config, setConfig] = useState<RemarketingConfig | null>(null)
  const [stats, setStats] = useState<RemarketingStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isRefreshingStats, setIsRefreshingStats] = useState(false)
  const [isMigrationPending, setIsMigrationPending] = useState(false)

  // ── Accordion / Saiba Mais State ────────────────────────────────────────────
  const [showMoreInfo, setShowMoreInfo] = useState(false)

  // ── New Rule Inputs State ───────────────────────────────────────────────────
  const [newDays, setNewDays] = useState(0)
  const [newHours, setNewHours] = useState(2)
  const [newMinutes, setNewMinutes] = useState(0)

  // ── Inline Edit State for Existing Rules ────────────────────────────────────
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editDays, setEditDays] = useState(0)
  const [editHours, setEditHours] = useState(0)
  const [editMinutes, setEditMinutes] = useState(0)

  // ── Queue State ─────────────────────────────────────────────────────────────
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [totalQueueCount, setTotalQueueCount] = useState(0)
  const [isLoadingQueue, setIsLoadingQueue] = useState(false)
  const [cancelingQueueId, setCancelingQueueId] = useState<string | null>(null)

  // ── Lead Search State ────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResultLead[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [togglingLeadId, setTogglingLeadId] = useState<string | null>(null)

  // ── Bulk Actions State ───────────────────────────────────────────────────────
  const [isEnablingAll, setIsEnablingAll] = useState(false)
  const [isDisablingAll, setIsDisablingAll] = useState(false)
  const [showEnableAllConfirm, setShowEnableAllConfirm] = useState(false)
  const [showDisableAllConfirm, setShowDisableAllConfirm] = useState(false)

  // ── Fetch user ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true
    const init = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user && isMounted) {
          setUserId(user.id)
        }
      } catch (err) {
        console.error("Erro ao autenticar usuário:", err)
      }
    }
    init()
    return () => {
      isMounted = false
    }
  }, [])

  // ── Load Queue ──────────────────────────────────────────────────────────────
  const loadQueue = useCallback(async (uid: string) => {
    setIsLoadingQueue(true)
    try {
      const { count, error: countErr } = await supabase
        .from("remarketing_queue")
        .select("*", { count: "exact", head: true })
        .eq("user_id", uid)

      if (countErr) {
        if (countErr.code === "42P01" || countErr.message?.includes("does not exist")) {
          setIsMigrationPending(true)
        }
        setQueue([])
        setTotalQueueCount(0)
        return
      }

      setIsMigrationPending(false)
      setTotalQueueCount(count || 0)

      const { data: qData, error: qErr } = await supabase
        .from("remarketing_queue")
        .select("id, step, scheduled_at, created_at, metadata, lead_id")
        .eq("user_id", uid)
        .order("scheduled_at", { ascending: true })
        .limit(20)

      if (qErr || !qData || qData.length === 0) {
        setQueue([])
        return
      }

      const leadIds = Array.from(new Set(qData.map((q: any) => q.lead_id).filter(Boolean)))
      const { data: leadsData } = await supabase
        .from("leads")
        .select("id, full_name, whatsapp, conversation_id")
        .in("id", leadIds)

      const leadMap = new Map((leadsData || []).map((l: any) => [l.id, l]))

      const items: QueueItem[] = qData.map((item: any) => {
        const lead: any = leadMap.get(item.lead_id) || {
          id: item.lead_id,
          full_name: "Lead não localizado",
          whatsapp: "",
          conversation_id: null,
        }
        let displayName = lead.full_name || "Sem nome"
        if (isGenericName(displayName, lead.whatsapp) && lead.whatsapp) {
          displayName = `Contato ${formatPhoneDisplay(lead.whatsapp)}`
        }

        return {
          id: item.id,
          step: item.step,
          scheduled_at: item.scheduled_at,
          created_at: item.created_at,
          metadata: item.metadata || {},
          lead: {
            ...lead,
            display_name: displayName,
          },
        }
      })

      setQueue(items)
    } catch (err) {
      console.warn("Aviso ao buscar fila:", err)
      setQueue([])
      setTotalQueueCount(0)
    } finally {
      setIsLoadingQueue(false)
    }
  }, [])

  // ── Load config + stats + queue ─────────────────────────────────────────────
  const loadData = useCallback(
    async (uid: string) => {
      setIsLoading(true)
      try {
        const { data: configData, error } = await supabase
          .from("remarketing_configs")
          .select("*")
          .eq("user_id", uid)
          .maybeSingle()

        if (error && error.code !== "PGRST116") {
          console.warn("Aviso ao buscar remarketing_configs:", error)
        }

        if (configData) {
          setConfig({
            ...configData,
            agent_mode: configData.agent_mode || "passive",
            time_rules:
              Array.isArray(configData.time_rules) && configData.time_rules.length > 0
                ? configData.time_rules
                : DEFAULT_TIME_RULES,
            ai_prompt: configData.ai_prompt ?? DEFAULT_AI_PROMPT,
          })
        } else {
          setConfig({
            user_id: uid,
            is_active: false,
            agent_mode: "passive",
            time_rules: DEFAULT_TIME_RULES,
            ai_prompt: DEFAULT_AI_PROMPT,
            max_attempts: 3,
            template_cold: "",
            template_interested: "",
            template_objection: "",
          })
        }

        await fetchStats(uid)
        await loadQueue(uid)
      } catch (err) {
        console.error(err)
        toast.error("Erro ao carregar configurações de remarketing")
      } finally {
        setIsLoading(false)
      }
    },
    [loadQueue]
  )

  useEffect(() => {
    if (userId) {
      loadData(userId)
    }
  }, [userId, loadData])

  // ── Stats query (Cruzamento Seguro: remarketing_leads + remarketing_queue) ─
  const fetchStats = async (uid: string) => {
    setIsRefreshingStats(true)
    try {
      // 1. Busca linhas na tabela remarketing_leads
      const { data: rmkData, error: rmkError } = await supabase
        .from("remarketing_leads")
        .select("lead_id, remarketing_status, rmk_enabled")
        .eq("user_id", uid)

      if (rmkError) throw rmkError
      const rows = rmkData || []

      // 2. Busca leads únicos com agendamentos pendentes na fila
      const { data: queueData } = await supabase
        .from("remarketing_queue")
        .select("lead_id")
        .eq("user_id", uid)

      const activeQueueLeadIds = new Set((queueData || []).map((q: any) => q.lead_id))

      // Em sequência ativa: leads com itens na fila OU com status sent_1..4 / rmk_enabled ativo
      const active = rows.filter(
        (r: any) =>
          activeQueueLeadIds.has(r.lead_id) ||
          ["sent_1", "sent_2", "sent_3", "sent_4"].includes(r.remarketing_status) ||
          (r.rmk_enabled !== false && r.remarketing_status !== "optout" && r.remarketing_status !== "converted")
      ).length

      // Opt-out solicitado: leads desativados manualmente ou com status optout
      const optout = rows.filter(
        (r: any) => r.remarketing_status === "optout" || r.rmk_enabled === false
      ).length

      // Responderam / Convertidos: leads que responderam (atualizados pelo trigger do WhatsApp)
      const converted = rows.filter((r: any) => r.remarketing_status === "converted").length

      // Total de leads registrados
      const total = rows.length

      setStats({ active, optout, converted, total })
    } catch (err) {
      console.warn("Aviso ao buscar estatísticas:", err)
    } finally {
      setIsRefreshingStats(false)
    }
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!config || !userId) return
    setIsSaving(true)
    try {
      const payload: Record<string, any> = {
        user_id: userId,
        is_active: config.is_active,
        agent_mode: config.agent_mode,
        time_rules: config.time_rules,
        ai_prompt: config.ai_prompt,
        max_attempts: config.max_attempts,
        template_cold: config.template_cold,
        template_interested: config.template_interested,
        template_objection: config.template_objection,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from("remarketing_configs")
        .upsert(payload, { onConflict: "user_id" })

      if (error) {
        if (error.code === "42703" || error.message?.includes("column")) {
          throw new Error("As novas colunas não existem no Supabase. Execute a migration SQL no SQL Editor.")
        }
        throw error
      }

      toast.success("Configurações salvas com sucesso!")
      await loadQueue(userId)
      await fetchStats(userId)
    } catch (err: any) {
      console.error(err)
      toast.error("Erro ao salvar: " + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  // ── Add New Time Rule with Automatic Label Calculation ──────────────────────
  const handleAddNewRule = () => {
    if (!config) return

    const d = Math.max(0, Number(newDays) || 0)
    const h = Math.max(0, Number(newHours) || 0)
    const m = Math.max(0, Number(newMinutes) || 0)

    const totalMinutes = d * 1440 + h * 60 + m
    if (totalMinutes === 0) {
      toast.warning("Defina pelo menos 1 minuto, hora ou dia para criar uma etapa.")
      return
    }

    const { label } = generateRuleLabel(d, h, m)
    const currentRules = config.time_rules || []

    const newRule: TimeRule = {
      id: String(Date.now()),
      days: d,
      hours: h,
      minutes: m,
      label,
    }

    setConfig({
      ...config,
      time_rules: [...currentRules, newRule],
    })

    toast.success(`Etapa "${label}" adicionada! Clique em Salvar Configurações para persistir.`)
    setNewDays(0)
    setNewHours(0)
    setNewMinutes(30)
  }

  // ── Start Editing an Existing Rule ──────────────────────────────────────────
  const handleStartEditRule = (idx: number, rule: TimeRule) => {
    setEditingIndex(idx)
    setEditDays(rule.days || 0)
    setEditHours(rule.hours || 0)
    setEditMinutes(rule.minutes || 0)
  }

  // ── Commit Rule Edit with Realtime Label Auto-calculation ───────────────────
  const handleSaveEditRule = (idx: number) => {
    if (!config) return
    const d = Math.max(0, Number(editDays) || 0)
    const h = Math.max(0, Number(editHours) || 0)
    const m = Math.max(0, Number(editMinutes) || 0)

    const totalMinutes = d * 1440 + h * 60 + m
    if (totalMinutes === 0) {
      toast.warning("O tempo não pode ser zerado.")
      return
    }

    const { label } = generateRuleLabel(d, h, m)
    const updated = [...config.time_rules]
    updated[idx] = {
      ...updated[idx],
      days: d,
      hours: h,
      minutes: m,
      label,
    }

    setConfig({
      ...config,
      time_rules: updated,
    })

    setEditingIndex(null)
    toast.success(`Etapa atualizada para "${label}"! Lembre-se de salvar.`)
  }

  const handleCancelEditRule = () => {
    setEditingIndex(null)
  }

  const handleRemoveTimeRule = (index: number) => {
    if (!config) return
    if (editingIndex === index) setEditingIndex(null)
    const updated = config.time_rules.filter((_, i) => i !== index)
    setConfig({
      ...config,
      time_rules: updated,
    })
  }

  // ── Cancel Item from Queue ──────────────────────────────────────────────────
  const handleDeleteQueueItem = async (queueId: string) => {
    setCancelingQueueId(queueId)
    try {
      const { error } = await supabase.from("remarketing_queue").delete().eq("id", queueId)

      if (error) throw error
      toast.success("Agendamento removido da fila")
      setQueue((prev) => prev.filter((item) => item.id !== queueId))
      setTotalQueueCount((prev) => Math.max(0, prev - 1))
      if (userId) fetchStats(userId)
    } catch (err: any) {
      console.error(err)
      toast.error("Erro ao remover da fila: " + err.message)
    } finally {
      setCancelingQueueId(null)
    }
  }

  // ── Cancel Lead from Queue Completely ────────────────────────────────────────
  const handleCancelLeadFromQueue = async (leadId: string) => {
    if (!userId) return
    setCancelingQueueId(leadId)
    try {
      await supabase
        .from("remarketing_queue")
        .delete()
        .eq("lead_id", leadId)
        .eq("user_id", userId)

      await supabase.from("remarketing_leads").upsert(
        {
          lead_id: leadId,
          user_id: userId,
          rmk_enabled: false,
          remarketing_status: "optout",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "lead_id" }
      )

      toast.success("Todos os agendamentos do lead foram cancelados")
      setQueue((prev) => prev.filter((item) => item.lead.id !== leadId))
      loadQueue(userId)
      fetchStats(userId)
    } catch (err: any) {
      console.error(err)
      toast.error("Erro ao cancelar agendamentos do lead: " + err.message)
    } finally {
      setCancelingQueueId(null)
    }
  }

  // ── Lead Search ─────────────────────────────────────────────────────────────
  const handleSearchLeads = async () => {
    if (!userId || !searchQuery.trim()) return
    setIsSearching(true)
    try {
      const { data: leadsData, error: leadsError } = await supabase
        .from("leads")
        .select("id, full_name, whatsapp")
        .eq("user_id", userId)
        .or(`full_name.ilike.%${searchQuery}%,whatsapp.ilike.%${searchQuery}%`)
        .limit(20)

      if (leadsError) throw leadsError
      const leads = leadsData || []

      if (leads.length === 0) {
        setSearchResults([])
        toast.info("Nenhum lead encontrado")
        return
      }

      const leadIds = leads.map((l: any) => l.id)
      const { data: rmkData } = await supabase
        .from("remarketing_leads")
        .select("lead_id, rmk_enabled, remarketing_status, remarketing_attempts")
        .in("lead_id", leadIds)

      const rmkMap = new Map((rmkData || []).map((r: any) => [r.lead_id, r]))
      setSearchResults(
        leads.map((lead: any) => ({
          ...lead,
          rmk: rmkMap.get(lead.id) || null,
        }))
      )
    } catch (err) {
      console.error(err)
      toast.error("Erro ao buscar leads")
    } finally {
      setIsSearching(false)
    }
  }

  // ── Toggle RMK por Lead ─────────────────────────────────────────────────────
  const handleToggleLeadRmk = async (leadId: string, rmk: SearchResultLead["rmk"]) => {
    if (!userId) return
    setTogglingLeadId(leadId)
    try {
      const isCurrentlyEnabled = rmk?.rmk_enabled !== false
      const newEnabled = !isCurrentlyEnabled

      const payload: any = {
        lead_id: leadId,
        user_id: userId,
        rmk_enabled: newEnabled,
      }

      if (newEnabled) {
        payload.remarketing_status = "none"
        payload.remarketing_attempts = 0
        payload.last_remarketing_at = null
      }

      const { error } = await supabase
        .from("remarketing_leads")
        .upsert(payload, { onConflict: "lead_id" })

      if (error) throw error

      setSearchResults((prev) =>
        prev.map((lead) =>
          lead.id === leadId
            ? {
                ...lead,
                rmk: {
                  ...(lead.rmk || {}),
                  rmk_enabled: newEnabled,
                  remarketing_status: newEnabled ? "none" : lead.rmk?.remarketing_status,
                  remarketing_attempts: newEnabled ? 0 : lead.rmk?.remarketing_attempts,
                },
              }
            : lead
        )
      )

      toast.success(newEnabled ? "RMK ativado para o lead" : "RMK desativado para o lead")
      fetchStats(userId)
    } catch (err: any) {
      console.error(err)
      toast.error("Erro ao alterar: " + err.message)
    } finally {
      setTogglingLeadId(null)
    }
  }

  // ── Enable All Leads ─────────────────────────────────────────────────────────
  const handleEnableAll = async () => {
    if (!userId) return
    setIsEnablingAll(true)
    try {
      const { data: toEnable, error } = await supabase
        .from("remarketing_leads")
        .select("lead_id")
        .eq("user_id", userId)
        .eq("rmk_enabled", false)
        .not("remarketing_status", "in", "(optout,converted)")

      if (error) throw error

      if (!toEnable || toEnable.length === 0) {
        toast.info("Nenhum lead desativado para reativar.")
        setShowEnableAllConfirm(false)
        return
      }

      const payload = toEnable.map((r: any) => ({
        lead_id: r.lead_id,
        user_id: userId,
        rmk_enabled: true,
        remarketing_status: "none",
        remarketing_attempts: 0,
        last_remarketing_at: null,
      }))

      const { error: upsertError } = await supabase
        .from("remarketing_leads")
        .upsert(payload, { onConflict: "lead_id" })

      if (upsertError) throw upsertError

      toast.success(`RMK ativado para ${payload.length} lead(s)!`)
      if (userId) fetchStats(userId)
      setSearchResults([])
      setSearchQuery("")
    } catch (err: any) {
      console.error(err)
      toast.error("Erro ao ativar: " + err.message)
    } finally {
      setIsEnablingAll(false)
      setShowEnableAllConfirm(false)
    }
  }

  // ── Disable All Leads ────────────────────────────────────────────────────────
  const handleDisableAll = async () => {
    if (!userId) return
    setIsDisablingAll(true)
    try {
      const { error: updateError } = await supabase
        .from("remarketing_leads")
        .update({ rmk_enabled: false })
        .eq("user_id", userId)

      if (updateError) throw updateError

      const { data: allLeads, error: leadsError } = await supabase
        .from("leads")
        .select("id")
        .eq("user_id", userId)

      if (leadsError) throw leadsError

      const { data: existing, error: existingError } = await supabase
        .from("remarketing_leads")
        .select("lead_id")
        .eq("user_id", userId)

      if (existingError) throw existingError

      const existingIds = new Set((existing || []).map((r: any) => r.lead_id))
      const toInsert = (allLeads || [])
        .filter((l: any) => !existingIds.has(l.id))
        .map((l: any) => ({
          lead_id: l.id,
          user_id: userId,
          rmk_enabled: false,
          remarketing_status: "none",
          remarketing_attempts: 0,
        }))

      if (toInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("remarketing_leads")
          .insert(toInsert)
        if (insertError) throw insertError
      }

      toast.success("RMK desativado para todos os leads!")
      if (userId) fetchStats(userId)
      setSearchResults([])
      setSearchQuery("")
    } catch (err: any) {
      console.error(err)
      toast.error("Erro ao desativar: " + err.message)
    } finally {
      setIsDisablingAll(false)
      setShowDisableAllConfirm(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-[#8E3AAA]" />
      </div>
    )
  }

  if (!config) return null

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-y-auto custom-scrollbar text-foreground">
      {/* ── Aviso se a Migration ainda não foi aplicada no Supabase ────────── */}
      {isMigrationPending && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-3 flex items-center justify-between text-xs text-amber-500 gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
            <span>
              <strong>Tabelas de Remarketing pendentes:</strong> A tabela de fila ainda não está criada no Supabase.
              Execute o script de migração no <strong>SQL Editor do Supabase</strong> para habilitar a fila de disparos.
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => userId && loadQueue(userId)}
            className="h-7 text-[11px] border-amber-500/30 text-amber-500 hover:bg-amber-500/20 shrink-0"
          >
            Verificar Novamente
          </Button>
        </div>
      )}

      {/* ── Header (Identidade Turbo: Roxo #8E3AAA) ─────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 md:p-8 gap-4 border-b border-border flex-shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Target className="h-6 w-6 text-[#8E3AAA]" />
              Remarketing Automático
            </h1>
            <Badge
              variant="outline"
              className={cn(
                "text-xs px-2.5 py-0.5 font-semibold uppercase tracking-wider",
                config.is_active
                  ? "border-[#8E3AAA]/40 text-[#8E3AAA] bg-[#8E3AAA]/10"
                  : "border-muted-foreground/30 text-muted-foreground bg-accent/40"
              )}
            >
              {config.is_active ? "ATIVO" : "PAUSADO"}
            </Badge>
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-[#8E3AAA] hover:bg-[#8E3AAA]/80 text-white gap-2 h-10 px-5 flex-shrink-0 shadow-sm"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Configurações
        </Button>
      </div>

      <div className="p-6 md:p-8 space-y-8 max-w-5xl mx-auto w-full">
        {/* ── Seção 1 — Modo de Operação do Agente (Cores Turbo) ───────────── */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground">Modo de Operação do Agente</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Escolha como os leads entrarão na sua régua de remarketing.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "text-xs font-semibold",
                  config.is_active ? "text-emerald-500" : "text-muted-foreground"
                )}
              >
                {config.is_active ? "SERVIÇO ATIVO" : "SERVIÇO PAUSADO"}
              </span>
              <Switch
                checked={config.is_active}
                onCheckedChange={(v) => setConfig({ ...config, is_active: v })}
                className="data-[state=checked]:bg-emerald-500"
              />
            </div>
          </div>

          {/* Botões Estilo Pílula / Toggle Group (Turbo: #8E3AAA) */}
          <div className="inline-flex p-1 bg-black/40 border border-border rounded-xl">
            <button
              type="button"
              onClick={() => setConfig({ ...config, agent_mode: "passive" })}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold transition-all",
                config.agent_mode === "passive"
                  ? "bg-[#8E3AAA] text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Hexagon className={cn("h-4 w-4", config.agent_mode === "passive" ? "text-white" : "text-amber-500")} />
              Agente Passivo
            </button>
            <button
              type="button"
              onClick={() => setConfig({ ...config, agent_mode: "proactive" })}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold transition-all",
                config.agent_mode === "proactive"
                  ? "bg-[#8E3AAA] text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Zap className={cn("h-4 w-4", config.agent_mode === "proactive" ? "text-white" : "text-[#8E3AAA]")} />
              Agente Proativo
            </button>
          </div>

          {/* Resumo do Modo Selecionado + Botão Saiba Mais */}
          <div className="p-4 rounded-xl border border-[#8E3AAA]/20 bg-[#8E3AAA]/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              {config.agent_mode === "proactive" ? (
                <Zap className="h-4 w-4 text-[#8E3AAA] mt-0.5 shrink-0" />
              ) : (
                <Hexagon className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              )}
              <div>
                <p className="text-xs font-bold text-[#8E3AAA]">
                  {config.agent_mode === "proactive"
                    ? "Modo Proativo Selecionado"
                    : "Modo Passivo Selecionado"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {config.agent_mode === "proactive"
                    ? "Todos os novos leads criados a partir de agora entram automaticamente na sua régua de disparos seguindo as regras de horário abaixo. Se você não quiser que um lead específico continue no fluxo, basta clicar no botão \"RMK\" dele no atendimento para cancelar os agendamentos futuros."
                    : "Neste modo, os leads só entram na régua de disparos se você clicar manualmente no botão \"RMK\" no chat de atendimento. Se o lead responder a qualquer momento, o remarketing é cancelado imediatamente."}
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMoreInfo(!showMoreInfo)}
              className="text-xs text-[#8E3AAA] hover:text-[#8E3AAA]/80 hover:bg-[#8E3AAA]/10 shrink-0 gap-1.5 self-end sm:self-center font-medium"
            >
              <span>{showMoreInfo ? "Recolher" : "Saiba Mais!"}</span>
              <ChevronDown
                className={cn("h-3.5 w-3.5 transition-transform duration-200", showMoreInfo && "rotate-180")}
              />
            </Button>
          </div>

          {/* Detalhes Retráteis (Abre quando clica em Saiba Mais) */}
          {showMoreInfo && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 animate-in fade-in-50 duration-200">
              <div className="p-4 rounded-xl bg-accent/20 border border-border space-y-2">
                <div className="flex items-center gap-2">
                  <Hexagon className="h-4 w-4 text-amber-500" />
                  <span className="text-xs font-bold text-foreground">Como funciona o Agente Passivo:</span>
                </div>
                <ul className="text-[11px] text-muted-foreground space-y-1.5 list-disc list-inside leading-relaxed">
                  <li><strong>Entrada:</strong> Somente ao clicar no botão RMK no atendimento.</li>
                  <li><strong>Autocancelamento:</strong> Remove da fila e desativa o RMK se o cliente responder.</li>
                  <li><strong>Trava:</strong> Não dispara se o lead respondeu após a criação do agendamento.</li>
                  <li><strong>Ideal para:</strong> Vendas consultivas e atendimentos de alta personalização.</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-accent/20 border border-border space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-[#8E3AAA]" />
                  <span className="text-xs font-bold text-foreground">Como funciona o Agente Proativo:</span>
                </div>
                <ul className="text-[11px] text-muted-foreground space-y-1.5 list-disc list-inside leading-relaxed">
                  <li><strong>Entrada:</strong> Automática para todo novo lead recebido (WhatsApp, Kanban, CSV, n8n).</li>
                  <li><strong>Continuidade:</strong> Mantém a esteira ativa para follow-ups contextuais futuros.</li>
                  <li><strong>Trava inteligente de 10 min:</strong> Pausa o envio se o lead falou recentemente para não interromper a conversa ao vivo.</li>
                  <li><strong>Ideal para:</strong> Operações em escala, lançamentos e esteiras automatizadas.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* ── Seção 2 — Regras de Horários dos Disparos ─────────────────────── */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-[#8E3AAA]" />
              <h2 className="text-base font-bold text-foreground">Regras de Horários dos Disparos</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configure as etapas de tempo calculadas a partir do momento da ativação do lead.
            </p>
          </div>

          {/* Linha do Tempo Visual dos Disparos (NO TOPO, como solicitado) */}
          <div className="bg-accent/10 border border-border/60 rounded-xl p-4">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
              Linha do Tempo Visual dos Disparos:
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-accent border border-border text-foreground">
                Início (Momento da Ativação)
              </span>
              {(config.time_rules || []).map((rule, idx) => {
                const totalMins =
                  (Number(rule.days) || 0) * 1440 +
                  (Number(rule.hours) || 0) * 60 +
                  (Number(rule.minutes) || 0)
                let timeStr = `${totalMins}m`
                if (totalMins >= 1440 && totalMins % 1440 === 0) {
                  timeStr = `${totalMins / 1440} dia(s)`
                } else if (totalMins >= 60 && totalMins % 60 === 0) {
                  timeStr = `${totalMins / 60}h`
                }
                return (
                  <div key={rule.id || idx} className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs font-mono">→</span>
                    <Badge
                      variant="outline"
                      className="border-[#8E3AAA]/40 text-[#8E3AAA] bg-[#8E3AAA]/10 font-mono text-xs py-1 px-2.5 gap-1.5"
                    >
                      <span className="font-bold">Etapa {idx + 1}:</span>
                      <span>{rule.label || timeStr}</span>
                    </Badge>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Lista das Etapas Existentes com Lápis de Edição + Lixeira */}
          <div className="space-y-2.5">
            {(config.time_rules || []).map((rule, idx) => {
              const isEditing = editingIndex === idx
              const { label: previewLabel, subtitle: previewSubtitle } = generateRuleLabel(
                editDays,
                editHours,
                editMinutes
              )
              const { label: currentLabel, subtitle: currentSubtitle } = generateRuleLabel(
                rule.days,
                rule.hours,
                rule.minutes
              )

              if (isEditing) {
                return (
                  <div
                    key={rule.id || idx}
                    className="p-4 bg-accent/20 border border-[#8E3AAA]/40 rounded-xl space-y-3 animate-in fade-in-50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-[#8E3AAA]/20 text-[#8E3AAA] text-xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <p className="text-xs font-bold text-foreground">
                          Editando Etapa {idx + 1} — <span className="text-[#8E3AAA]">{previewLabel}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          onClick={() => handleSaveEditRule(idx)}
                          size="sm"
                          className="h-7 px-2.5 bg-[#8E3AAA] hover:bg-[#8E3AAA]/80 text-white text-xs gap-1"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Salvar
                        </Button>
                        <Button
                          type="button"
                          onClick={handleCancelEditRule}
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-[11px] text-muted-foreground block mb-1">Dias</Label>
                        <Input
                          type="number"
                          min={0}
                          value={editDays}
                          onChange={(e) => setEditDays(Math.max(0, parseInt(e.target.value) || 0))}
                          className="h-8 text-xs text-center"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] text-muted-foreground block mb-1">Horas</Label>
                        <Input
                          type="number"
                          min={0}
                          max={23}
                          value={editHours}
                          onChange={(e) => setEditHours(Math.max(0, parseInt(e.target.value) || 0))}
                          className="h-8 text-xs text-center"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] text-muted-foreground block mb-1">Minutos</Label>
                        <Input
                          type="number"
                          min={0}
                          max={59}
                          value={editMinutes}
                          onChange={(e) => setEditMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                          className="h-8 text-xs text-center"
                        />
                      </div>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={rule.id || idx}
                  className="flex items-center justify-between p-3.5 bg-black/40 border border-border/70 rounded-xl hover:border-border transition-colors gap-3"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-7 h-7 rounded-full bg-[#8E3AAA]/10 border border-[#8E3AAA]/30 text-[#8E3AAA] text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground leading-snug">
                        {rule.label || currentLabel}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {currentSubtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      onClick={() => handleStartEditRule(idx, rule)}
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-[#8E3AAA] hover:bg-[#8E3AAA]/10 shrink-0"
                      title="Editar horário desta etapa"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>

                    <Button
                      type="button"
                      onClick={() => handleRemoveTimeRule(idx)}
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 shrink-0"
                      title="Excluir etapa"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })}

            {(config.time_rules || []).length === 0 && (
              <div className="text-center py-6 border border-dashed border-border rounded-xl text-xs text-muted-foreground">
                Nenhuma regra de tempo configurada. Utilize o formulário abaixo para adicionar etapas.
              </div>
            )}
          </div>

          {/* Adicionar Nova Etapa de Tempo (com cálculo automático do texto) */}
          <div className="bg-black/30 border border-border/80 rounded-xl p-4 space-y-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Adicionar Nova Etapa de Tempo
            </p>
            <div className="flex flex-col sm:flex-row items-end gap-3">
              <div className="flex-1 grid grid-cols-3 gap-3 w-full">
                <div>
                  <Label className="text-xs text-muted-foreground block mb-1">Dias</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newDays}
                    onChange={(e) => setNewDays(Math.max(0, parseInt(e.target.value) || 0))}
                    className="h-9 text-xs bg-background/50 text-center"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground block mb-1">Horas</Label>
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    value={newHours}
                    onChange={(e) => setNewHours(Math.max(0, parseInt(e.target.value) || 0))}
                    className="h-9 text-xs bg-background/50 text-center"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground block mb-1">Minutos</Label>
                  <Input
                    type="number"
                    min={0}
                    max={59}
                    value={newMinutes}
                    onChange={(e) => setNewMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                    className="h-9 text-xs bg-background/50 text-center"
                  />
                </div>
              </div>

              <Button
                type="button"
                onClick={handleAddNewRule}
                className="w-full sm:w-auto h-9 px-6 bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs border border-border shrink-0 gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Prévia do texto: <strong className="text-[#8E3AAA]">{generateRuleLabel(newDays, newHours, newMinutes).label}</strong>
            </p>
          </div>
        </div>

        {/* ── Seção 3 — Cérebro da IA ──────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <BrainCircuit className="h-4 w-4 text-purple-500" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest">
              Cérebro da IA (Instruções e Prompt)
            </h2>
          </div>

          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-muted-foreground" />
            <p>
              Escreva o prompt que guia a IA no n8n ao recontatar um lead silencioso. A IA lê o histórico da conversa e
              devolve um JSON estruturado para tomada de decisão e disparo.
            </p>
          </div>

          <div className="relative">
            <textarea
              value={config.ai_prompt}
              onChange={(e) => setConfig({ ...config, ai_prompt: e.target.value })}
              placeholder={DEFAULT_AI_PROMPT}
              rows={9}
              className="w-full resize-y rounded-xl bg-background border border-input p-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#8E3AAA]/50 custom-scrollbar leading-relaxed font-mono"
            />
            <span className="absolute bottom-3 right-3 text-[10px] text-muted-foreground">
              {config.ai_prompt.length} caracteres
            </span>
          </div>
        </div>

        {/* ── Seção 4 — Templates de Fallback (Segurança) ───────────────────── */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest">
                Templates de Fallback (Segurança)
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
              <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              Mensagens enviadas caso a IA falhe ou ocorra indisponibilidade na API da OpenAI/Claude. Use as variáveis{" "}
              <code className="text-amber-500 bg-amber-500/10 px-1 py-0.5 rounded text-[11px]">{"{{nome}}"}</code> e{" "}
              <code className="text-amber-500 bg-amber-500/10 px-1 py-0.5 rounded text-[11px]">{"{{empresa}}"}</code>.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Template Cold */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#8E3AAA] inline-block" />
                Lead Frio
              </Label>
              <textarea
                value={config.template_cold}
                onChange={(e) => setConfig({ ...config, template_cold: e.target.value })}
                placeholder="Oi {{nome}}! Tudo bem? Estava pensando em você e gostaria de entender melhor como posso ajudar..."
                rows={5}
                className="w-full resize-none rounded-xl bg-background border border-input p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#8E3AAA]/50 custom-scrollbar leading-relaxed"
              />
            </div>

            {/* Template Interested */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                Demonstrou Interesse
              </Label>
              <textarea
                value={config.template_interested}
                onChange={(e) => setConfig({ ...config, template_interested: e.target.value })}
                placeholder="Oi {{nome}}! Notei que você demonstrou interesse antes. Ainda está analisando? Posso te ajudar a decidir..."
                rows={5}
                className="w-full resize-none rounded-xl bg-background border border-input p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50 custom-scrollbar leading-relaxed"
              />
            </div>

            {/* Template Objection */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                Levantou Objeção
              </Label>
              <textarea
                value={config.template_objection}
                onChange={(e) => setConfig({ ...config, template_objection: e.target.value })}
                placeholder="Oi {{nome}}! Entendo que talvez tenha surgido alguma dúvida. Quero garantir que você tem todas as informações..."
                rows={5}
                className="w-full resize-none rounded-xl bg-background border border-input p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/50 custom-scrollbar leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* ── Seção 5 — Status & Estatísticas (Identidade Turbo) ────────────── */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest">
                Status dos Leads
              </h2>
            </div>
            <button
              type="button"
              onClick={() => userId && fetchStats(userId)}
              disabled={isRefreshingStats}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              title="Atualizar estatísticas"
            >
              <RefreshCw className={cn("h-3 w-3", isRefreshingStats && "animate-spin")} />
              Atualizar
            </button>
          </div>

          {stats === null || isRefreshingStats ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-[#8E3AAA]" />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-accent/30 border border-[#8E3AAA]/30 rounded-xl p-4 text-center">
                <Target className="h-5 w-5 text-[#8E3AAA] mx-auto mb-2" />
                <p className="text-2xl font-bold text-[#8E3AAA]">{stats.active}</p>
                <p className="text-[11px] text-muted-foreground mt-1 leading-tight">Em sequência ativa</p>
              </div>

              <div className="bg-accent/30 border border-red-500/20 rounded-xl p-4 text-center">
                <ShieldOff className="h-5 w-5 text-red-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-red-500">{stats.optout}</p>
                <p className="text-[11px] text-muted-foreground mt-1 leading-tight">Opt-out solicitado</p>
              </div>

              <div className="bg-accent/30 border border-emerald-500/20 rounded-xl p-4 text-center">
                <Flame className="h-5 w-5 text-emerald-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-emerald-500">{stats.converted}</p>
                <p className="text-[11px] text-muted-foreground mt-1 leading-tight">Responderam / Convertidos</p>
              </div>

              <div className="bg-accent/30 border border-border rounded-xl p-4 text-center">
                <MessageSquare className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                <p className="text-[11px] text-muted-foreground mt-1 leading-tight">Total tocados pelo RMK</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Seção 6 — Gerenciar Leads Manualmente ─────────────────────────── */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-2 mb-1">
            <Search className="h-4 w-4 text-[#8E3AAA]" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest">
              Gerenciar Leads Manualmente
            </h2>
          </div>

          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-muted-foreground" />
            <p>
              Busque leads para ativar ou pausar o remarketing individualmente. Se preferir, use as ações em massa abaixo.
            </p>
          </div>

          {/* Ações em Massa */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-accent/20 border border-border rounded-xl">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground mb-0.5">Ações em Massa</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Afeta todos os leads, exceto os com <span className="text-red-400 font-medium">opt-out</span> ou{" "}
                <span className="text-emerald-400 font-medium">convertidos</span>.
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button
                type="button"
                onClick={() => setShowEnableAllConfirm(true)}
                disabled={isEnablingAll || isDisablingAll}
                variant="outline"
                size="sm"
                className="gap-2 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500/60 hover:text-emerald-400"
              >
                {isEnablingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
                Ligar para Todos
              </Button>
              <Button
                type="button"
                onClick={() => setShowDisableAllConfirm(true)}
                disabled={isEnablingAll || isDisablingAll}
                variant="outline"
                size="sm"
                className="gap-2 border-red-500/30 text-red-500 hover:bg-red-500/10 hover:border-red-500/60 hover:text-red-400"
              >
                {isDisablingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserX className="h-3.5 w-3.5" />}
                Desligar para Todos
              </Button>
            </div>
          </div>

          {/* Search input */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchLeads()}
                placeholder="Buscar por nome ou telefone..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-input text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#8E3AAA]/50"
              />
            </div>
            <Button
              type="button"
              onClick={handleSearchLeads}
              disabled={isSearching || !searchQuery.trim()}
              className="bg-[#8E3AAA] hover:bg-[#8E3AAA]/80 text-white gap-2 px-5 shrink-0"
            >
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Buscar
            </Button>
          </div>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map((lead) => {
                const isEnabled = lead.rmk?.rmk_enabled !== false
                const statusInfo = getRmkStatusLabel(lead.rmk)
                const isToggling = togglingLeadId === lead.id

                return (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between p-3 bg-accent/30 border border-border rounded-xl gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground font-medium truncate">
                        {lead.full_name || "Sem nome"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{lead.whatsapp}</p>
                    </div>

                    <span
                      className={cn(
                        "text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0",
                        statusInfo.color
                      )}
                    >
                      {statusInfo.label}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleToggleLeadRmk(lead.id, lead.rmk)}
                      disabled={isToggling}
                      className={cn(
                        "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all shrink-0",
                        isEnabled
                          ? "text-red-500 border-red-500/20 hover:bg-red-500/10"
                          : "text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/10"
                      )}
                    >
                      {isToggling ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : isEnabled ? (
                        <UserX className="h-3 w-3" />
                      ) : (
                        <UserCheck className="h-3 w-3" />
                      )}
                      {isEnabled ? "Desativar" : "Ativar"}
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {searchResults.length === 0 && searchQuery && !isSearching && (
            <p className="text-center text-xs text-muted-foreground py-4">
              Nenhum lead encontrado para "{searchQuery}".
            </p>
          )}
        </div>

        {/* ── Seção 7 — Fila de Disparos em Tempo Real (Por Último) ────────── */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ListOrdered className="h-4 w-4 text-[#8E3AAA]" />
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest">
                Fila de Disparos em Tempo Real
              </h2>
              <Badge variant="secondary" className="text-xs font-semibold ml-2">
                {totalQueueCount} agendamento(s) total
              </Badge>
            </div>
            <Button
              type="button"
              onClick={() => userId && loadQueue(userId)}
              disabled={isLoadingQueue}
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isLoadingQueue && "animate-spin")} />
              Atualizar Fila
            </Button>
          </div>

          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-muted-foreground" />
            <p>
              Exibindo os <strong>próximos 20 disparos agendados</strong> na fila PostgreSQL. O n8n consulta essa lista
              de minuto em minuto e executa a IA quando o horário for atingido.
            </p>
          </div>

          {isLoadingQueue ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#8E3AAA]" />
            </div>
          ) : queue.length === 0 ? (
            <div className="text-center py-10 bg-accent/10 border border-border rounded-xl text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-40 text-[#8E3AAA]" />
              <p className="text-sm font-medium text-foreground">Fila de remarketing vazia</p>
              <p className="text-xs mt-1">
                Nenhum disparo pendente no momento. Os agendamentos aparecerão aqui conforme os leads forem cadastrados ou ativados.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-left">
                    <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">Lead</th>
                    <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">Etapa</th>
                    <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">Agendado Para</th>
                    <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {queue.map((item) => {
                    const isCanceling = cancelingQueueId === item.id || cancelingQueueId === item.lead.id
                    return (
                      <tr key={item.id} className="hover:bg-accent/20 transition-colors">
                        <td className="py-3 px-3">
                          <p className="font-semibold text-foreground">
                            {item.lead.display_name || item.lead.full_name}
                          </p>
                          <p className="text-[11px] text-muted-foreground font-mono">
                            {item.lead.whatsapp}
                          </p>
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant="outline" className="border-border text-foreground font-medium text-[11px]">
                            Etapa {item.step} - {item.metadata.label || "Sem rótulo"}
                          </Badge>
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-medium text-foreground">
                            {formatScheduledDate(item.scheduled_at)}
                          </p>
                          <p className="text-[11px] text-[#8E3AAA] font-medium">
                            {formatRelativeTime(item.scheduled_at)}
                          </p>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              onClick={() => handleDeleteQueueItem(item.id)}
                              disabled={isCanceling}
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-red-400 hover:text-red-500 hover:bg-red-500/10"
                              title="Remover apenas esta etapa da fila"
                            >
                              {isCanceling ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                              <span className="hidden sm:inline ml-1">Excluir Etapa</span>
                            </Button>
                            <Button
                              type="button"
                              onClick={() => handleCancelLeadFromQueue(item.lead.id)}
                              disabled={isCanceling}
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs border-red-500/20 text-red-500 hover:bg-red-500/10"
                              title="Cancelar todo o remarketing deste lead"
                            >
                              <UserX className="h-3.5 w-3.5 mr-1" />
                              <span className="hidden sm:inline">Cancelar Lead</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal: Confirmar Ligar Todos ────────────────────────────────────── */}
      <AlertDialog open={showEnableAllConfirm} onOpenChange={setShowEnableAllConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ligar RMK para Todos?</AlertDialogTitle>
            <AlertDialogDescription>
              O remarketing será <strong>ativado</strong> para todos os leads que foram desativados manualmente.
              Leads com status <strong>opt-out</strong> ou <strong>convertido</strong> serão ignorados.
              A contagem de tentativas será reiniciada para os leads reativados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isEnablingAll}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEnableAll}
              disabled={isEnablingAll}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {isEnablingAll && <Loader2 className="h-4 w-4 animate-spin" />}
              Sim, ligar para todos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Modal: Confirmar Desligar Todos ─────────────────────────────────── */}
      <AlertDialog open={showDisableAllConfirm} onOpenChange={setShowDisableAllConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desligar RMK para Todos?</AlertDialogTitle>
            <AlertDialogDescription>
              O remarketing será <strong>desativado</strong> para todos os leads sem exceção.
              Nenhum lead receberá mensagens automáticas até ser reativado individualmente
              ou pelo botão "Ligar para Todos".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDisablingAll}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisableAll}
              disabled={isDisablingAll}
              className="bg-red-600 hover:bg-red-700 text-white gap-2"
            >
              {isDisablingAll && <Loader2 className="h-4 w-4 animate-spin" />}
              Sim, desligar para todos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
