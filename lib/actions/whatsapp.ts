"use server"

import { createClient } from "@/lib/supabase-server"

const UAZAPI_URL = process.env.NEXT_PUBLIC_UAZAPI_URL
const UAZAPI_ADMIN_TOKEN = process.env.UAZAPI_ADMIN_TOKEN

export async function initWhatsappInstance(payload: any) {
    if (!UAZAPI_ADMIN_TOKEN) {
        throw new Error("Admin token da UazAPI não configurado no servidor.")
    }

    // Verifica autenticação
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
        throw new Error("Usuário não autenticado")
    }

    try {
        const res = await fetch(`${UAZAPI_URL}/instance/init`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "admintoken": UAZAPI_ADMIN_TOKEN
            },
            body: JSON.stringify(payload)
        })

        const data = await res.json()
        return { ok: res.ok, status: res.status, data }
    } catch (err: any) {
        console.error("Erro na Server Action initWhatsappInstance:", err)
        return { ok: false, status: 500, data: { message: err.message } }
    }
}

export async function deleteWhatsappInstance(instanceName: string) {
    if (!UAZAPI_ADMIN_TOKEN) {
        throw new Error("Admin token da UazAPI não configurado no servidor.")
    }

    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
        throw new Error("Usuário não autenticado")
    }

    // 🔒 Proteção IDOR: Checa se a instância pertence ao usuário logado ou se ele é Admin
    const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

    if (!profile?.is_admin) {
        const { data: conn } = await supabase
            .from('whatsapp_connections')
            .select('id')
            .eq('user_id', user.id)
            .eq('instance_name', instanceName)
            .single()

        if (!conn) {
            throw new Error("Acesso negado: você não tem permissão para deletar esta instância.")
        }
    }

    // Tentativa 1: Path atualizado
    try {
        await fetch(`${UAZAPI_URL}/instance/${instanceName}`, {
            method: "DELETE",
            headers: { "admintoken": UAZAPI_ADMIN_TOKEN }
        })
    } catch (e) {
        console.warn("[Server Action] Delete 1 falhou:", e)
    }

    // Tentativa 2: Path legado
    try {
        await fetch(`${UAZAPI_URL}/instance/delete/${instanceName}`, {
            method: "DELETE",
            headers: { "admintoken": UAZAPI_ADMIN_TOKEN }
        })
    } catch (e) {
        console.warn("[Server Action] Delete 2 falhou:", e)
    }

    return { success: true }
}

/**
 * Consulta a Uazapi no backend e retorna o status real da conexão
 */
export async function checkWhatsappInstanceStatus(instanceToken: string) {
    if (!instanceToken) {
        return { connected: false, state: "disconnected", phone: null }
    }

    try {
        const res = await fetch(`${UAZAPI_URL}/instance/status`, {
            method: "GET",
            headers: { "token": instanceToken },
            cache: "no-store",
            signal: AbortSignal.timeout(5000)
        })

        if (!res.ok) {
            return { connected: false, state: "disconnected", phone: null, statusHttp: res.status }
        }

        const data = await res.json()
        const isConnected = data?.connected === true ||
                            data?.status?.connected === true ||
                            data?.instance?.status === "connected" ||
                            data?.state === "open" ||
                            data?.state === "connected" ||
                            data?.instance?.state === "open"

        const state = data?.state || data?.instance?.state || data?.instance?.status || (isConnected ? "open" : "disconnected")
        
        const rawPhone = data?.instance?.owner || data?.phone || data?.instance?.phone || data?.wid?.user || data?.me?.id || data?.status?.jid || null
        let phone: string | null = null
        if (rawPhone) {
            const cleaned = String(rawPhone).replace('@s.whatsapp.net', '').replace(/\D/g, '')
            if (cleaned.length >= 10) phone = cleaned
        }

        return {
            connected: isConnected,
            state: isConnected ? "open" : state,
            phone: phone
        }
    } catch (err: any) {
        console.warn(`[checkWhatsappInstanceStatus] Erro ao consultar Uazapi:`, err.message)
        return { connected: false, state: "disconnected", phone: null, error: err.message }
    }
}

/**
 * Valida e sincroniza o status de WhatsApp de um único usuário no Supabase
 */
export async function syncUserWhatsappStatus(userId: string) {
    const { createAdminClient } = await import("@/lib/supabase-admin")
    const supabaseAdmin = await createAdminClient()

    const { data: conn } = await (supabaseAdmin as any)
        .from("whatsapp_connections")
        .select("id, instance_name, instance_key, status")
        .eq("user_id", userId)
        .single()

    if (!conn || !conn.instance_key) {
        return { connected: false, state: "disconnected", phone: null }
    }

    const check = await checkWhatsappInstanceStatus(conn.instance_key)
    const newStatus = check.connected ? "connected" : "disconnected"

    if (conn.status !== newStatus) {
        await (supabaseAdmin as any)
            .from("whatsapp_connections")
            .update({ 
                status: newStatus,
                updated_at: new Date().toISOString()
            })
            .eq("id", conn.id)
    }

    return {
        ...check,
        instanceName: conn.instance_name,
        instanceToken: conn.instance_key
    }
}

/**
 * Consulta todas as instâncias da Uazapi, sincroniza as conectadas
 * e DELETA da Uazapi todas as instâncias desconectadas para liberar vagas no plano.
 */
export async function syncAndCleanupWhatsappInstances() {
    if (!UAZAPI_ADMIN_TOKEN) {
        throw new Error("Admin token da UazAPI não configurado no servidor.")
    }

    const { createAdminClient } = await import("@/lib/supabase-admin")
    const supabaseAdmin = await createAdminClient()

    // 1. Busca todas as instâncias direto da Uazapi
    let allInstances: any[] = []
    try {
        const res = await fetch(`${UAZAPI_URL}/instance/all`, {
            method: "GET",
            headers: { "admintoken": UAZAPI_ADMIN_TOKEN },
            cache: "no-store"
        })
        if (!res.ok) {
            throw new Error(`Uazapi retornou status ${res.status}`)
        }
        allInstances = await res.json()
    } catch (e: any) {
        console.error("Erro ao listar instâncias da Uazapi:", e)
        return { success: false, error: "Falha ao listar instâncias da Uazapi: " + e.message }
    }

    const totalBefore = allInstances.length
    let connectedCount = 0
    let deletedCount = 0
    const now = Date.now()
    const MIN_AGE_TO_DELETE_MS = 5 * 60 * 1000 // 5 minutos de tolerância

    // 2. Busca todas as conexões cadastradas no Supabase
    const { data: dbConnections } = await (supabaseAdmin as any)
        .from("whatsapp_connections")
        .select("id, user_id, instance_name, instance_key, status")

    const dbMapByName = new Map<string, any>()
    const dbMapByKey = new Map<string, any>()
    if (dbConnections) {
        for (const conn of dbConnections) {
            if (conn.instance_name) dbMapByName.set(conn.instance_name, conn)
            if (conn.instance_key) dbMapByKey.set(conn.instance_key, conn)
        }
    }

    // 3. Itera sobre cada instância da Uazapi
    for (const inst of allInstances) {
        const isConnected = inst.status === "connected"
        const instToken = inst.token
        const instName = inst.name

        if (isConnected) {
            connectedCount++
            const dbConn = dbMapByName.get(instName) || dbMapByKey.get(instToken)
            if (dbConn && dbConn.status !== "connected") {
                await (supabaseAdmin as any)
                    .from("whatsapp_connections")
                    .update({ 
                        status: "connected",
                        updated_at: new Date().toISOString()
                    })
                    .eq("id", dbConn.id)
            }
        } else {
            // Desconectada: checa tolerância
            const createdTime = inst.created ? new Date(inst.created).getTime() : 0
            const isOldEnough = (now - createdTime) > MIN_AGE_TO_DELETE_MS

            if (isOldEnough && instToken) {
                try {
                    const delRes = await fetch(`${UAZAPI_URL}/instance`, {
                        method: "DELETE",
                        headers: { "token": instToken }
                    })

                    if (delRes.ok) {
                        deletedCount++
                        const dbConn = dbMapByName.get(instName) || dbMapByKey.get(instToken)
                        if (dbConn) {
                            await (supabaseAdmin as any)
                                .from("whatsapp_connections")
                                .update({
                                    status: "disconnected",
                                    instance_name: null,
                                    instance_key: null,
                                    updated_at: new Date().toISOString()
                                })
                                .eq("id", dbConn.id)
                        }
                    }
                } catch (delErr: any) {
                    console.error(`[Cleanup] Erro ao deletar ${instName}:`, delErr.message)
                }

                await new Promise(resolve => setTimeout(resolve, 80))
            }
        }
    }

    return {
        success: true,
        totalBefore,
        connectedCount,
        deletedCount,
        remainingTotal: totalBefore - deletedCount,
        timestamp: new Date().toISOString()
    }
}
