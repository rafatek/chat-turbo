import { supabaseAdmin } from '@/lib/supabase-admin'

interface SyncLeadAvatarParams {
  userId: string
  phone: string
  leadId?: string
}

/**
 * Consulta a UazAPI para obter a foto de perfil do WhatsApp do número informado
 * e salva automaticamente na coluna `profile_pic` da tabela `leads`.
 *
 * Endpoint UazAPI utilizado:
 * POST /chat/avatar
 * Headers: token, Accept, Content-Type
 * Body: { number: "55...", preview: true }
 */
export async function syncLeadAvatar({ userId, phone, leadId }: SyncLeadAvatarParams): Promise<string | null> {
  try {
    if (!userId || !phone) return null

    // 1. Formatar o número para a UazAPI (garantir código 55 do Brasil)
    let cleanPhone = phone.replace(/\D/g, '')
    if (!cleanPhone.startsWith('55') && cleanPhone.length <= 11) {
      cleanPhone = `55${cleanPhone}`
    }

    // 2. Buscar a conexão ativa do WhatsApp deste usuário
    const { data: connection } = await supabaseAdmin
      .from('whatsapp_connections')
      .select('instance_key, instance_name')
      .eq('user_id', userId)
      .single()

    if (!connection?.instance_key) {
      console.warn(`[syncLeadAvatar] Nenhuma conexão WhatsApp encontrada para user_id: ${userId}`)
      return null
    }

    // 3. Chamar a UazAPI no endpoint /chat/avatar
    const baseUrl = (process.env.NEXT_PUBLIC_UAZAPI_URL || 'https://turbodigital.uazapi.com').replace(/\/$/, '')
    const url = `${baseUrl}/chat/avatar`

    console.log(`[syncLeadAvatar] Consultando foto para ${cleanPhone} via ${connection.instance_name}...`)

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'token': connection.instance_key
      },
      body: JSON.stringify({
        number: cleanPhone,
        preview: true
      })
    })

    if (!res.ok) {
      console.warn(`[syncLeadAvatar] UazAPI retornou HTTP ${res.status}`)
      return null
    }

    const data = await res.json()
    const avatarUrl = data?.url?.trim()

    if (avatarUrl) {
      // 4. Salvar na coluna profile_pic da tabela leads
      if (leadId) {
        await supabaseAdmin
          .from('leads')
          .update({ profile_pic: avatarUrl })
          .eq('id', leadId)
      } else {
        const phoneWithout55 = cleanPhone.startsWith('55') ? cleanPhone.slice(2) : cleanPhone
        await supabaseAdmin
          .from('leads')
          .update({ profile_pic: avatarUrl })
          .eq('user_id', userId)
          .or(`whatsapp.eq.${cleanPhone},whatsapp.eq.${phoneWithout55}`)
      }

      console.log(`[syncLeadAvatar] ✅ Foto de perfil atualizada no banco para ${cleanPhone}`)
      return avatarUrl
    } else {
      console.log(`[syncLeadAvatar] Número ${cleanPhone} não possui foto pública no WhatsApp`)
    }

    return null
  } catch (err: any) {
    console.error('[syncLeadAvatar] Erro ao sincronizar foto de perfil:', err?.message || err)
    return null
  }
}
