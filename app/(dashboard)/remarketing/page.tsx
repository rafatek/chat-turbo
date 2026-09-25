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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { Label } from "@/components/ui/label"
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface RemarketingConfig {
  id?: string
  user_id: string
  is_active: boolean
  max_attempts: number
  ai_prompt: string
  template_cold: string
  template_interested: string
  template_objection: string
}

interface RemarketingStats {
  active: number    // sent_1 | sent_2 | sent_3 | sent_4
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ATTEMPTS_OPTIONS = [1, 2, 3, 4]

const ATTEMPTS_LABELS: Record<number, string> = {
  1: "Semana 1",
  2: "Semanas 1 e 2",
  3: "Semanas 1, 2 e 3",
  4: "Semanas 1, 2, 3 e 4",
}

const PLACEHOLDER_AI_PROMPT = `Você é um consultor especializado em reengajamento de leads.
O lead abaixo não respondeu há alguns dias. Sua missão é retomar o contato de forma natural, 
sem ser invasivo, demonstrando valor e curiosidade genuína.

Regras obrigatórias:
- Responda APENAS em JSON estruturado com: { "mensagem": "...", "estagio_funil": "cold|interested|objection", "intencao_optout": false }
- Seja direto, humano e conciso (máx. 3 linhas)
- Nunca mencione que é uma automação
- Se o lead demonstrar desinteresse claro, retorne intencao_optout: true`

function getRmkStatusLabel(rmk: SearchResultLead["rmk"]): { label: string; color: string } {
  if (!rmk || rmk.rmk_enabled === false) return { label: "RMK Inativo", color: "text-muted-foreground bg-accent/50 border-border" }
  const status = rmk.remarketing_status
  if (!status || status === "none") return { label: "Aguardando disparo", color: "text-muted-foreground bg-accent/50 border-border" }
  if (["sent_1", "sent_2", "sent_3", "sent_4"].includes(status)) return { label: `Em sequência (${rmk.remarketing_attempts}x)`, color: "text-[#00A3FF] bg-[#00A3FF]/10 border-[#00A3FF]/20" }
  if (status === "optout") return { label: "Opt-out", color: "text-red-500 bg-red-500/10 border-red-500/20" }
  if (status === "converted") return { label: "Convertido", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" }
  return { label: status, color: "text-muted-foreground bg-accent/50 border-border" }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RemarketingPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [config, setConfig] = useState<RemarketingConfig | null>(null)
  const [stats, setStats] = useState<RemarketingStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isRefreshingStats, setIsRefreshingStats] = useState(false)

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
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
    }
    init()
  }, [])

  // ── Load config + stats ─────────────────────────────────────────────────────
  const loadData = useCallback(async (uid: string) => {
    setIsLoading(true)
    try {
      const { data: configData } = await supabase
        .from("remarketing_configs")
        .select("*")
        .eq("user_id", uid)
        .single()

      if (configData) {
        setConfig(configData)
      } else {
        setConfig({
          user_id: uid,
          is_active: false,
          max_attempts: 3,
          ai_prompt: "",
          template_cold: "",
          template_interested: "",
          template_objection: "",
        })
      }

      await fetchStats(uid)
    } catch (err) {
      console.error(err)
      toast.error("Erro ao carregar configurações")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (userId) loadData(userId)
  }, [userId, loadData])

  // ── Stats query ─────────────────────────────────────────────────────────────
  const fetchStats = async (uid: string) => {
    setIsRefreshingStats(true)
    try {
      const { data, error } = await supabase
        .from("remarketing_leads")
        .select("remarketing_status")
        .eq("user_id", uid)

      if (error) throw error

      const rows = data || []
      const active = rows.filter((r) =>
        ["sent_1", "sent_2", "sent_3", "sent_4"].includes(r.remarketing_status)
      ).length
      const optout = rows.filter((r) => r.remarketing_status === "optout").length
      const converted = rows.filter((r) => r.remarketing_status === "converted").length

      setStats({ active, optout, converted, total: rows.length })
    } catch (err) {
      console.error("Erro ao buscar stats:", err)
    } finally {
      setIsRefreshingStats(false)
    }
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!config || !userId) return
    setIsSaving(true)
    try {
      const payload = {
        user_id: userId,
        is_active: config.is_active,
        max_attempts: config.max_attempts,
        ai_prompt: config.ai_prompt,
        template_cold: config.template_cold,
        template_interested: config.template_interested,
        template_objection: config.template_objection,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from("remarketing_configs")
        .upsert(payload, { onConflict: "user_id" })

      if (error) throw error
      toast.success("Configurações salvas com sucesso!")
    } catch (err: any) {
      console.error(err)
      toast.error("Erro ao salvar: " + err.message)
    } finally {
      setIsSaving(false)
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
      setSearchResults(leads.map((lead: any) => ({
        ...lead,
        rmk: rmkMap.get(lead.id) || null,
      })))
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

      setSearchResults(prev => prev.map(lead =>
        lead.id === leadId
          ? {
              ...lead,
              rmk: {
                ...(lead.rmk || {}),
                rmk_enabled: newEnabled,
                remarketing_status: newEnabled ? "none" : lead.rmk?.remarketing_status,
                remarketing_attempts: newEnabled ? 0 : lead.rmk?.remarketing_attempts,
              }
            }
          : lead
      ))

      toast.success(newEnabled ? "RMK ativado para o lead" : "RMK desativado para o lead")
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
      // Busca apenas leads desativados manualmente, excluindo optout e convertidos
      const { data: toEnable, error } = await supabase
        .from('remarketing_leads')
        .select('lead_id')
        .eq('user_id', userId)
        .eq('rmk_enabled', false)
        .not('remarketing_status', 'in', '(optout,converted)')

      if (error) throw error

      if (!toEnable || toEnable.length === 0) {
        toast.info('Nenhum lead desativado para reativar.')
        setShowEnableAllConfirm(false)
        return
      }

      const payload = toEnable.map((r: any) => ({
        lead_id: r.lead_id,
        user_id: userId,
        rmk_enabled: true,
        remarketing_status: 'none',
        remarketing_attempts: 0,
        last_remarketing_at: null,
      }))

      const { error: upsertError } = await supabase
        .from('remarketing_leads')
        .upsert(payload, { onConflict: 'lead_id' })

      if (upsertError) throw upsertError

      toast.success(`RMK ativado para ${payload.length} lead(s)!`)
      if (userId) fetchStats(userId)
      setSearchResults([])
      setSearchQuery('')
    } catch (err: any) {
      console.error(err)
      toast.error('Erro ao ativar: ' + err.message)
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
      // 1. Desativa todas as linhas existentes na tabela
      const { error: updateError } = await supabase
        .from('remarketing_leads')
        .update({ rmk_enabled: false })
        .eq('user_id', userId)

      if (updateError) throw updateError

      // 2. Busca todos os leads do usuário
      const { data: allLeads, error: leadsError } = await supabase
        .from('leads')
        .select('id')
        .eq('user_id', userId)

      if (leadsError) throw leadsError

      // 3. Busca os que já têm linha (após a atualização acima)
      const { data: existing, error: existingError } = await supabase
        .from('remarketing_leads')
        .select('lead_id')
        .eq('user_id', userId)

      if (existingError) throw existingError

      // 4. Insere linhas desativadas para leads que ainda não tinham registro
      const existingIds = new Set((existing || []).map((r: any) => r.lead_id))
      const toInsert = (allLeads || [])
        .filter((l: any) => !existingIds.has(l.id))
        .map((l: any) => ({
          lead_id: l.id,
          user_id: userId,
          rmk_enabled: false,
          remarketing_status: 'none',
          remarketing_attempts: 0,
        }))

      if (toInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('remarketing_leads')
          .insert(toInsert)
        if (insertError) throw insertError
      }

      toast.success('RMK desativado para todos os leads!')
      if (userId) fetchStats(userId)
      setSearchResults([])
      setSearchQuery('')
    } catch (err: any) {
      console.error(err)
      toast.error('Erro ao desativar: ' + err.message)
    } finally {
      setIsDisablingAll(false)
      setShowDisableAllConfirm(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-[#00A3FF]" />
      </div>
    )
  }

  if (!config) return null

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-y-auto custom-scrollbar text-foreground">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 md:p-8 gap-4 border-b border-border flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Target className="h-6 w-6 text-[#00A3FF]" />
            Remarketing Automático
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Reengaje leads silenciosos automaticamente com inteligência artificial.
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-[#00A3FF] hover:bg-[#00A3FF]/80 text-white gap-2 h-10 px-5 flex-shrink-0"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salvar Configurações
        </Button>
      </div>

      <div className="p-6 md:p-8 space-y-8 max-w-5xl mx-auto w-full">

        {/* ── Seção 1 — Controle Principal ────────────────────────────────── */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-2 mb-1">
            <Power className="h-4 w-4 text-[#00A3FF]" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest">
              Controle Principal
            </h2>
          </div>

          {/* Toggle is_active */}
          <div className="flex items-center justify-between p-4 bg-accent/30 rounded-xl border border-border">
            <div>
              <p className="text-foreground font-medium">Serviço de Remarketing</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                Quando ativo, o N8N irá processar os leads elegíveis automaticamente.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={cn("text-xs font-semibold", config.is_active ? "text-emerald-500" : "text-muted-foreground")}>
                {config.is_active ? "ATIVO" : "INATIVO"}
              </span>
              <Switch
                checked={config.is_active}
                onCheckedChange={(v) => setConfig({ ...config, is_active: v })}
                className="data-[state=checked]:bg-emerald-500"
              />
            </div>
          </div>

          {/* Max Attempts */}
          <div className="space-y-3">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider block">
              Número de Tentativas
            </Label>
            <div className="flex gap-3">
              {ATTEMPTS_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => setConfig({ ...config, max_attempts: n })}
                  className={cn(
                    "flex-1 py-3 rounded-xl border text-sm font-bold transition-all",
                    config.max_attempts === n
                      ? "bg-[#00A3FF]/10 border-[#00A3FF]/40 text-[#00A3FF]"
                      : "bg-accent/30 border-border text-muted-foreground hover:bg-accent/50"
                  )}
                >
                  {n}x
                  <span className="block text-[10px] font-normal opacity-60 mt-0.5">
                    {ATTEMPTS_LABELS[n]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Info Banner */}
          <div className="flex items-start gap-3 bg-[#00A3FF]/5 border border-[#00A3FF]/10 rounded-xl p-4">
            <Calendar className="h-4 w-4 text-[#00A3FF] flex-shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground leading-relaxed">
              <span className="text-[#00A3FF] font-semibold">Agendamento automático:</span>{" "}
              Disparos ocorrem <strong className="text-foreground">toda quarta-feira às 09:00</strong>.
              O gatilho é definido como <strong className="text-foreground">lead sem resposta após o último contato da empresa</strong>.
            </div>
          </div>
        </div>

        {/* ── Seção 2 — Cérebro da IA ──────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <BrainCircuit className="h-4 w-4 text-purple-500" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest">
              Cérebro da IA
            </h2>
          </div>

          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-muted-foreground" />
            <p>
              Escreva o prompt que guia a IA ao recontatar um lead silencioso.
              A IA <strong className="text-foreground">sempre devolve um JSON estruturado</strong> com a mensagem,
              o estágio do funil e a intenção de opt-out.
            </p>
          </div>

          <div className="relative">
            <textarea
              value={config.ai_prompt}
              onChange={(e) => setConfig({ ...config, ai_prompt: e.target.value })}
              placeholder={PLACEHOLDER_AI_PROMPT}
              rows={10}
              className="w-full resize-y rounded-xl bg-background border border-input p-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-purple-500/50 custom-scrollbar leading-relaxed font-mono"
            />
            <span className="absolute bottom-3 right-3 text-[10px] text-muted-foreground">
              {config.ai_prompt.length} chars
            </span>
          </div>
        </div>

        {/* ── Seção 3 — Templates de Fallback ──────────────────────────────── */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest">
              Templates de Fallback
            </h2>
          </div>

          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-muted-foreground" />
            <p>
              Mensagens enviadas caso a IA falhe ou retorne um formato inválido.
              Use as variáveis <code className="text-amber-600 bg-amber-500/10 px-1 rounded">{"{{nome}}"}</code>{" "}
              e <code className="text-amber-600 bg-amber-500/10 px-1 rounded">{"{{empresa}}"}</code> para personalizar.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Template Cold */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                Lead Frio
              </Label>
              <textarea
                value={config.template_cold}
                onChange={(e) => setConfig({ ...config, template_cold: e.target.value })}
                placeholder={"Oi {{nome}}! Tudo bem? Estava pensando em você e gostaria de entender melhor como posso ajudar..."}
                rows={5}
                className="w-full resize-none rounded-xl bg-background border border-input p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/50 custom-scrollbar"
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
                placeholder={"Oi {{nome}}! Notei que você demonstrou interesse antes. Ainda está analisando? Posso te ajudar a decidir..."}
                rows={5}
                className="w-full resize-none rounded-xl bg-background border border-input p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50 custom-scrollbar"
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
                placeholder={"Oi {{nome}}! Entendo que talvez tenha surgido alguma dúvida. Quero garantir que você tem todas as informações..."}
                rows={5}
                className="w-full resize-none rounded-xl bg-background border border-input p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/50 custom-scrollbar"
              />
            </div>
          </div>
        </div>

        {/* ── Seção 4 — Status & Estatísticas ──────────────────────────────── */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest">
                Status dos Leads
              </h2>
            </div>
            <button
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
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-accent/30 border border-[#00A3FF]/20 rounded-xl p-4 text-center">
                <Target className="h-5 w-5 text-[#00A3FF] mx-auto mb-2" />
                <p className="text-2xl font-bold text-[#00A3FF]">{stats.active}</p>
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

          {stats && stats.total === 0 && !isRefreshingStats && (
            <p className="text-center text-xs text-muted-foreground pt-2">
              Nenhum lead foi processado pelo remarketing ainda. As métricas aparecerão aqui após os primeiros disparos.
            </p>
          )}
        </div>

        {/* ── Seção 5 — Gerenciar Leads ────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-2 mb-1">
            <Search className="h-4 w-4 text-violet-500" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest">
              Gerenciar Leads
            </h2>
          </div>

          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-muted-foreground" />
            <p>
              Por padrão, todos os leads são elegíveis ao remarketing. Use a busca abaixo para
              ativar ou desativar o RMK individualmente por lead.
              Reativar um lead <strong className="text-foreground">reinicia a contagem de tentativas</strong>.
            </p>
          </div>

          {/* Ações em Massa */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-accent/20 border border-border rounded-xl">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground mb-0.5">Ações em Massa</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Afeta todos os leads, exceto os com{" "}
                <span className="text-red-400 font-medium">opt-out</span> ou{" "}
                <span className="text-emerald-400 font-medium">convertidos</span>.
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button
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
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-input text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50"
              />
            </div>
            <Button
              onClick={handleSearchLeads}
              disabled={isSearching || !searchQuery.trim()}
              className="bg-violet-600 hover:bg-violet-700 text-white gap-2 px-5 shrink-0"
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

                    <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0", statusInfo.color)}>
                      {statusInfo.label}
                    </span>

                    <button
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
