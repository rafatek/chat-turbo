import { NextResponse, type NextRequest } from "next/server"
import { syncAndCleanupWhatsappInstances } from "@/lib/actions/whatsapp"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization")
    const secretParam = req.nextUrl.searchParams.get("secret")
    const cronSecret = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY

    if (cronSecret) {
      const isAuthorized = 
        authHeader === `Bearer ${cronSecret}` || 
        secretParam === cronSecret ||
        req.headers.get("x-cron-secret") === cronSecret

      if (!isAuthorized) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    const result = await syncAndCleanupWhatsappInstances()
    return NextResponse.json(result)
  } catch (error: any) {
    console.error("[CRON sync-connections] Erro:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

