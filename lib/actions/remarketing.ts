"use server"

import { createClient } from "@/lib/supabase-server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { revalidatePath } from "next/cache"

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
  updated_at?: string
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

export const DEFAULT_TIME_RULES: TimeRule[] = [
  { id: "1", days: 0, hours: 0, minutes: 30, label: "Após 30 minutos" },
  { id: "2", days: 0, hours: 2, minutes: 0, label: "Após 2 horas" },
  { id: "3", days: 1, hours: 0, minutes: 0, label: "Após 1 dia" },
]

export const DEFAULT_AI_PROMPT = `Você é um consultor especializado em reengajamento de leads.
O lead abaixo não respondeu há algum tempo. Sua missão é retomar o contato de forma natural, 
sem ser invasivo, demonstrando valor e curiosidade genuína.

Regras obrigatórias:
- Responda APENAS em JSON estruturado com: { "mensagem": "...", "estagio_funil": "cold|interested|objection", "intencao_optout": false }
- Seja direto, humano e conciso (máx. 3 linhas)
- Nunca mencione que é uma automação
- Se o lead demonstrar desinteresse claro, retorne intencao_optout: true`

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

async function resolveUserId(explicitUserId?: string): Promise<string | null> {
  if (explicitUserId) return explicitUserId
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user?.id) return user.id
  } catch (err) {
    console.warn("Não foi possível resolver user via createClient:", err)
  }
  return null
}

/**
 * Retorna as configurações de remarketing do usuário autenticado.
 */
export async function getRemarketingConfig(
  explicitUserId?: string
): Promise<RemarketingConfig | null> {
  const userId = await resolveUserId(explicitUserId)
  if (!userId) {
    return {
      user_id: "",
      is_active: false,
      agent_mode: "passive",
      time_rules: DEFAULT_TIME_RULES,
      ai_prompt: DEFAULT_AI_PROMPT,
      max_attempts: 3,
      template_cold: "",
      template_interested: "",
      template_objection: "",
    }
  }

  const { data, error } = await supabaseAdmin
    .from("remarketing_configs")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()

  if (error && error.code !== "PGRST116") {
    console.warn("Erro ao buscar remarketing_configs:", error)
  }

  if (!data) {
    return {
      user_id: userId,
      is_active: false,
      agent_mode: "passive",
      time_rules: DEFAULT_TIME_RULES,
      ai_prompt: DEFAULT_AI_PROMPT,
      max_attempts: 3,
      template_cold: "",
      template_interested: "",
      template_objection: "",
    }
  }

  return {
    ...data,
    agent_mode: data.agent_mode || "passive",
    time_rules:
      Array.isArray(data.time_rules) && data.time_rules.length > 0
        ? data.time_rules
        : DEFAULT_TIME_RULES,
    ai_prompt: data.ai_prompt ?? DEFAULT_AI_PROMPT,
  }
}

/**
 * Salva as configurações de remarketing.
 */
export async function saveRemarketingConfig(
  payload: Partial<RemarketingConfig>
): Promise<{ success: boolean; data?: any; error?: string }> {
  const userId = await resolveUserId(payload.user_id)
  if (!userId) {
    return { success: false, error: "Usuário não autenticado" }
  }

  try {
    const dataToSave: Record<string, any> = {
      user_id: userId,
      updated_at: new Date().toISOString(),
    }

    if (payload.is_active !== undefined) dataToSave.is_active = payload.is_active
    if (payload.agent_mode !== undefined) dataToSave.agent_mode = payload.agent_mode
    if (payload.time_rules !== undefined) dataToSave.time_rules = payload.time_rules
    if (payload.ai_prompt !== undefined) dataToSave.ai_prompt = payload.ai_prompt
    if (payload.max_attempts !== undefined) dataToSave.max_attempts = payload.max_attempts
    if (payload.template_cold !== undefined) dataToSave.template_cold = payload.template_cold
    if (payload.template_interested !== undefined)
      dataToSave.template_interested = payload.template_interested
    if (payload.template_objection !== undefined)
      dataToSave.template_objection = payload.template_objection

    const { data, error } = await supabaseAdmin
      .from("remarketing_configs")
      .upsert(dataToSave, { onConflict: "user_id" })
      .select()
      .single()

    if (error) throw error

    revalidatePath("/remarketing")
    revalidatePath("/atendimento")

    return { success: true, data }
  } catch (err: any) {
    console.error("Erro ao salvar remarketing_configs:", err)
    return { success: false, error: err.message || "Erro desconhecido ao salvar" }
  }
}

/**
 * Agenda os disparos de um lead específico na remarketing_queue com base nas time_rules.
 */
export async function scheduleLeadRemarketingQueue(
  leadId: string,
  explicitUserId?: string
): Promise<{ success: boolean; scheduledCount?: number; error?: string }> {
  try {
    // 1. Validar lead
    const { data: lead, error: leadError } = await supabaseAdmin
      .from("leads")
      .select("id, user_id")
      .eq("id", leadId)
      .maybeSingle()

    if (leadError || !lead) {
      return { success: false, error: "Lead não encontrado" }
    }

    const userId = explicitUserId || lead.user_id

    // 2. Buscar regras de tempo do usuário
    const { data: config } = await supabaseAdmin
      .from("remarketing_configs")
      .select("is_active, time_rules")
      .eq("user_id", userId)
      .maybeSingle()

    const rules: TimeRule[] =
      Array.isArray(config?.time_rules) && config!.time_rules.length > 0
        ? config!.time_rules
        : DEFAULT_TIME_RULES

    const now = new Date()

    // 3. Deletar agendamentos anteriores daquele lead
    await (supabaseAdmin as any)
      .from("remarketing_queue")
      .delete()
      .eq("lead_id", leadId)
      .eq("user_id", userId)

    // 4. Inserir/Atualizar estado em remarketing_leads
    await (supabaseAdmin as any).from("remarketing_leads").upsert(
      {
        lead_id: leadId,
        user_id: userId,
        rmk_enabled: true,
        remarketing_status: "none",
        remarketing_attempts: 0,
        last_remarketing_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      { onConflict: "lead_id" }
    )

    // 5. Montar as etapas para inserção na fila
    const queueInserts = []
    let step = 1

    for (const rule of rules) {
      const totalMinutes =
        (Number(rule.days) || 0) * 1440 +
        (Number(rule.hours) || 0) * 60 +
        (Number(rule.minutes) || 0)

      if (totalMinutes > 0) {
        const scheduledAt = new Date(now.getTime() + totalMinutes * 60 * 1000)
        queueInserts.push({
          user_id: userId,
          lead_id: leadId,
          step: step++,
          scheduled_at: scheduledAt.toISOString(),
          metadata: {
            label: rule.label || `Etapa ${step - 1}`,
            days: rule.days || 0,
            hours: rule.hours || 0,
            minutes: rule.minutes || 0,
          },
        })
      }
    }

    if (queueInserts.length > 0) {
      const { error: insertError } = await (supabaseAdmin as any)
        .from("remarketing_queue")
        .insert(queueInserts)

      if (insertError) {
        console.warn("Aviso ao inserir na remarketing_queue:", insertError)
        return { success: false, error: insertError.message }
      }
    }

    return { success: true, scheduledCount: queueInserts.length }
  } catch (err: any) {
    console.error("Erro em scheduleLeadRemarketingQueue:", err)
    return { success: false, error: err.message }
  }
}

/**
 * Cancela a fila de remarketing para um lead.
 */
export async function cancelLeadRemarketingQueue(
  leadId: string,
  explicitUserId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: lead, error: leadError } = await (supabaseAdmin as any)
      .from("leads")
      .select("id, user_id")
      .eq("id", leadId)
      .maybeSingle()

    if (leadError || !lead) {
      return { success: false, error: "Lead não encontrado" }
    }

    const userId = explicitUserId || lead.user_id

    await (supabaseAdmin as any)
      .from("remarketing_queue")
      .delete()
      .eq("lead_id", leadId)
      .eq("user_id", userId)

    await (supabaseAdmin as any).from("remarketing_leads").upsert(
      {
        lead_id: leadId,
        user_id: userId,
        rmk_enabled: false,
        remarketing_status: "optout",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "lead_id" }
    )

    return { success: true }
  } catch (err: any) {
    console.error("Erro em cancelLeadRemarketingQueue:", err)
    return { success: false, error: err.message }
  }
}

/**
 * Toggle do RMK acionado pelo botão da tela de chat ou painel.
 */
export async function toggleLeadRemarketingAction(
  leadId: string,
  enable: boolean,
  explicitUserId?: string
): Promise<{ success: boolean; enabled: boolean; error?: string }> {
  if (enable) {
    const result = await scheduleLeadRemarketingQueue(leadId, explicitUserId)
    if (!result.success) return { success: false, enabled: !enable, error: result.error }
    return { success: true, enabled: true }
  } else {
    const result = await cancelLeadRemarketingQueue(leadId, explicitUserId)
    if (!result.success) return { success: false, enabled: !enable, error: result.error }
    return { success: true, enabled: false }
  }
}

/**
 * Deleta um item específico da fila de remarketing pelo seu ID.
 */
export async function deleteQueueItemAction(
  queueId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from("remarketing_queue")
      .delete()
      .eq("id", queueId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Busca os próximos 20 agendamentos da fila com resolução inteligente de nomes.
 */
export async function getUpcomingRemarketingQueue(explicitUserId?: string): Promise<{
  queue: QueueItem[]
  totalCount: number
}> {
  const userId = await resolveUserId(explicitUserId)
  if (!userId) {
    return { queue: [], totalCount: 0 }
  }

  try {
    const { count: totalCount, error: countError } = await supabaseAdmin
      .from("remarketing_queue")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)

    if (countError) {
      return { queue: [], totalCount: 0 }
    }

    const { data: qData, error: queueError } = await supabaseAdmin
      .from("remarketing_queue")
      .select("id, step, scheduled_at, created_at, metadata, lead_id")
      .eq("user_id", userId)
      .order("scheduled_at", { ascending: true })
      .limit(20)

    if (queueError || !qData || qData.length === 0) {
      return { queue: [], totalCount: totalCount || 0 }
    }

    const leadIds = Array.from(new Set(qData.map((q: any) => q.lead_id).filter(Boolean)))
    const { data: leadsData } = await supabaseAdmin
      .from("leads")
      .select("id, full_name, whatsapp, conversation_id")
      .in("id", leadIds)

    const leadMap = new Map((leadsData || []).map((l: any) => [l.id, l]))

    const items: QueueItem[] = qData.map((item: any) => {
      const rawLead: any = leadMap.get(item.lead_id) || {
        id: item.lead_id,
        full_name: "Lead não localizado",
        whatsapp: "",
        conversation_id: null,
      }
      let displayName = rawLead.full_name || "Sem nome"
      if (isGenericName(displayName, rawLead.whatsapp) && rawLead.whatsapp) {
        displayName = `Contato ${formatPhoneDisplay(rawLead.whatsapp)}`
      }

      return {
        id: item.id,
        step: item.step,
        scheduled_at: item.scheduled_at,
        created_at: item.created_at,
        metadata: item.metadata || {},
        lead: {
          ...rawLead,
          display_name: displayName,
        },
      }
    })

    return {
      queue: items,
      totalCount: totalCount || 0,
    }
  } catch (err) {
    console.warn("Erro ao buscar fila de remarketing:", err)
    return { queue: [], totalCount: 0 }
  }
}
