export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startWhatsappSyncCron } = await import("@/lib/cron/whatsapp-sync")
    startWhatsappSyncCron()
  }
}

