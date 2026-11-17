import { syncAndCleanupWhatsappInstances } from "@/lib/actions/whatsapp"

declare global {
  var __whatsappSyncTimerInitialized: boolean | undefined
}

const SYNC_INTERVAL_MS = 30 * 60 * 1000 // 30 minutos

export function startWhatsappSyncCron() {
  if (global.__whatsappSyncTimerInitialized) {
    return
  }

  if (typeof window !== "undefined" || process.env.NEXT_RUNTIME === "edge") {
    return
  }

  global.__whatsappSyncTimerInitialized = true

  console.log(`[WhatsApp Sync Cron] Agendador iniciado. Intervalo: 30 minutos.`)

  // Checagem inicial após 15 segundos da inicialização do servidor
  setTimeout(async () => {
    try {
      console.log(`[WhatsApp Sync Cron] Executando checagem e limpeza inicial de conexões...`)
      const res = await syncAndCleanupWhatsappInstances()
      if (res && res.success) {
        console.log(`[WhatsApp Sync Cron] Inicial concluída: ${res.connectedCount} ativas | ${res.deletedCount} desconectadas excluídas | Restantes: ${res.remainingTotal}.`)
      }
    } catch (e: any) {
      console.warn(`[WhatsApp Sync Cron] Aviso na checagem inicial:`, e.message)
    }
  }, 15000)

  // Intervalo periódico a cada 30 minutos
  setInterval(async () => {
    try {
      console.log(`[WhatsApp Sync Cron] Executando rotina periódica de sincronização e limpeza...`)
      const res = await syncAndCleanupWhatsappInstances()
      if (res && res.success) {
        console.log(`[WhatsApp Sync Cron] Periódica concluída: ${res.connectedCount} ativas | ${res.deletedCount} desconectadas excluídas | Restantes: ${res.remainingTotal}.`)
      }
    } catch (e: any) {
      console.error(`[WhatsApp Sync Cron] Erro na rotina periódica:`, e)
    }
  }, SYNC_INTERVAL_MS)
}

