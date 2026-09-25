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
