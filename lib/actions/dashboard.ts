"use server"

import { createAdminClient } from "@/lib/supabase-admin"
import { verifyAdmin } from "./admin"

// Funções auxiliares de data
function getStartOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function getEndOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

function formatAsaasDate(date: Date) {
  return date.toISOString().split('T')[0]
}

export async function getDashboardMetrics(period: 'current_month' | 'last_month' | 'last_30_days' | 'last_6_months') {
  try {
    await verifyAdmin()
    const supabaseAdmin = await createAdminClient()
    
    const { ASAAS_API_URL, ASAAS_API_KEY } = await import('@/lib/asaas')
    const headers = { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' }

    // Determinar as datas baseadas no período escolhido
    const now = new Date()
    let currentStart = new Date()
    let currentEnd = new Date()
    let prevStart = new Date()
    let prevEnd = new Date()

    if (period === 'current_month') {
      currentStart = new Date(now.getFullYear(), now.getMonth(), 1)
      currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
      
      prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999) // Último dia do mês passado
      prevEnd = getEndOfDay(prevEnd)
    } else if (period === 'last_month') {
      currentStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      currentEnd = new Date(now.getFullYear(), now.getMonth(), 0)
      currentEnd = getEndOfDay(currentEnd)
      
      prevStart = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      prevEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0)
      prevEnd = getEndOfDay(prevEnd)
    } else if (period === 'last_30_days') {
      currentStart = new Date(now)
      currentStart.setDate(now.getDate() - 30)
      currentStart = getStartOfDay(currentStart)
      currentEnd = getEndOfDay(now)
      
      prevStart = new Date(currentStart)
      prevStart.setDate(currentStart.getDate() - 30)
      prevEnd = new Date(currentStart)
      prevEnd.setDate(currentStart.getDate() - 1)
      prevEnd = getEndOfDay(prevEnd)
    } else if (period === 'last_6_months') {
      currentStart = new Date(now.getFullYear(), now.getMonth() - 5, 1)
      currentEnd = getEndOfDay(now)
      
      prevStart = new Date(now.getFullYear(), now.getMonth() - 11, 1)
      prevEnd = new Date(now.getFullYear(), now.getMonth() - 5, 0)
      prevEnd = getEndOfDay(prevEnd)
    }

    // --- FUNÇÕES DE BUSCA ---
    
    const earliestStart = formatAsaasDate(prevStart)
    const latestEnd = formatAsaasDate(currentEnd)
    
    // Função auxiliar para buscar com paginação
    const fetchAllPayments = async (paramsString: string = "") => {
      let allPayments: any[] = []
      let offset = 0
      const limit = 100
      let hasMore = true
      
      while (hasMore) {
        const queryStr = paramsString ? `${paramsString}&limit=${limit}&offset=${offset}` : `limit=${limit}&offset=${offset}`
        const res = await fetch(`${ASAAS_API_URL}/payments?${queryStr}`, { headers })
        
        try {
          const data = await res.json()
          if (data && data.data && data.data.length > 0) {
            allPayments = allPayments.concat(data.data)
            offset += limit
            hasMore = !!data.hasMore
          } else {
            hasMore = false
          }
        } catch (e) {
          console.error("Asaas API Error parsing JSON:", e)
          hasMore = false
        }
      }
      return allPayments
    }

    // Busca absolutamente TODAS as cobranças (sem filtro de data/status na API) para evitar bugs da Sandbox
    const allPayments = await fetchAllPayments()
    
    // Filtramos em memória
    const paidPayments = allPayments.filter(p => p.status === 'RECEIVED')
    const pendingPayments = allPayments.filter(p => p.status === 'PENDING')
    const overduePayments = allPayments.filter(p => p.status === 'OVERDUE')

    // Dados do Supabase (Perfis)
    const { data: profiles, error: profilesError } = await supabaseAdmin.from('profiles').select('*')
    if (profilesError) throw new Error(profilesError.message)

    // Dados do WhatsApp
    const { data: wppConns } = await supabaseAdmin.from('whatsapp_connections').select('status')
    const wppConnected = wppConns?.filter(c => c.status === 'connected' || c.status === 'CONNECTED' || c.status === 'conectado' || c.status === 'Conectado').length || 0

    // --- CÁLCULOS DO PERÍODO ATUAL ---
    
    const isCurrentPeriod = (d: Date) => d >= currentStart && d <= currentEnd
    const isPrevPeriod = (d: Date) => d >= prevStart && d <= prevEnd
    
    const processPayments = (targetPaid: any[], targetPending: any[], targetOverdue: any[], checkDate: (d: Date) => boolean) => {
      let recebido = 0
      let aReceber = 0
      let inadimplencia = 0
      
      targetPaid.forEach(p => {
        const pDate = new Date(p.dueDate + 'T12:00:00')
        if (checkDate(pDate)) recebido += p.value
      })
      
      targetPending.forEach(p => {
        const pDate = new Date(p.dueDate + 'T12:00:00')
        if (checkDate(pDate)) aReceber += p.value
      })

      targetOverdue.forEach(p => {
        const pDate = new Date(p.dueDate + 'T12:00:00')
        if (checkDate(pDate)) inadimplencia += p.value
      })
      
      return { recebido, aReceber, inadimplencia }
    }

    const currentFinancials = processPayments(paidPayments, pendingPayments, overduePayments, isCurrentPeriod)
    const prevFinancials = processPayments(paidPayments, pendingPayments, overduePayments, isPrevPeriod)

    // Usuários e Assinaturas
    const totalCurrentClients = profiles.length
    const currentActive = profiles.filter(p => p.subscription_status === 'active' || p.subscription_status === 'ativo' || p.subscription_status === 'Ativo').length
    const currentOverdue = profiles.filter(p => p.subscription_status === 'vencida').length
    const currentCancelled = profiles.filter(p => p.subscription_status === 'canceled' || p.subscription_status === 'cancelada').length
    
    const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    if (usersError) console.error("Error fetching auth users:", usersError)
    const allUsers = usersData?.users || []

    const newClientsCurrent = allUsers.filter(u => u.created_at && isCurrentPeriod(new Date(u.created_at))).length
    const newClientsPrev = allUsers.filter(u => u.created_at && isPrevPeriod(new Date(u.created_at))).length
    
    const iaActive = profiles.filter(p => p.subscription_status === 'active').length // Mock para IA

    // --- GRÁFICO DE LINHA (Receita) ---
    const chartDataMap: Record<string, number> = {}
    
    paidPayments.forEach(p => {
      const pDate = new Date(p.dueDate + 'T12:00:00')
      if (isCurrentPeriod(pDate)) {
        let label = ""
        if (period === 'last_6_months') {
          label = `${pDate.getMonth()+1}/${pDate.getFullYear()}`
        } else {
          label = `${pDate.getDate().toString().padStart(2, '0')}/${(pDate.getMonth()+1).toString().padStart(2, '0')}`
        }
        chartDataMap[label] = (chartDataMap[label] || 0) + p.value
      }
    })
    
    const sortedKeys = Object.keys(chartDataMap).sort()
    const chartData = sortedKeys.map(k => ({ label: k, receita: chartDataMap[k] }))

    // Retorno Consolidado
    return {
      success: true,
      data: {
        financials: {
          current: currentFinancials,
          prev: prevFinancials
        },
        clients: {
          total: totalCurrentClients,
          active: currentActive,
          overdue: currentOverdue,
          cancelled: currentCancelled,
          newCurrent: newClientsCurrent,
          newPrev: newClientsPrev,
          wppConnected,
          iaActive
        },
        chartData
      }
    }

  } catch (error: any) {
    console.error("Dashboard Error:", error)
    return { success: false, error: error.message }
  }
}
