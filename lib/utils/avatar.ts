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
    const { data: connection } = await (supabaseAdmin as any)
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
      let finalAvatarUrl = avatarUrl

      // 4. Salvar permanentemente no Storage do Supabase (bucket chat_media)
      // Isso elimina requisições repetidas ao WhatsApp/proxy na navegação e escala com CDN do Supabase
      try {
        const parsedAvatar = new URL(avatarUrl)
        if (parsedAvatar.protocol === 'https:') {
          const imgRes = await fetch(avatarUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
            },
          })

          if (imgRes.ok) {
            const rawContentType = (imgRes.headers.get('content-type') || 'image/jpeg').toLowerCase()
            const safeMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
            const isSafeImage = safeMimes.some((type) => rawContentType.startsWith(type))
            const contentType = isSafeImage ? rawContentType.split(';')[0].trim() : 'image/jpeg'

            const arrayBuffer = await imgRes.arrayBuffer()
            if (arrayBuffer.byteLength <= 5 * 1024 * 1024) {
              const buffer = Buffer.from(arrayBuffer)
              const filePath = `avatars/${cleanPhone}.jpg`

              const { error: uploadError } = await supabaseAdmin.storage
                .from('chat_media')
                .upload(filePath, buffer, {
                  contentType,
                  upsert: true,
                })

              if (!uploadError) {
                const { data: { publicUrl } } = supabaseAdmin.storage
                  .from('chat_media')
                  .getPublicUrl(filePath)

                if (publicUrl) {
                  finalAvatarUrl = publicUrl
                  console.log(`[syncLeadAvatar] 🚀 Foto persistida com sucesso no Supabase Storage: ${finalAvatarUrl}`)
                }
              } else {
                console.warn(`[syncLeadAvatar] Falha no upload para Storage (mantendo URL original):`, uploadError)
              }
            }
          }
        }
      } catch (uploadErr: any) {
        console.warn(`[syncLeadAvatar] Erro ao salvar foto no Storage:`, uploadErr?.message || uploadErr)
      }

      // 5. Salvar na coluna profile_pic da tabela leads
      if (leadId) {
        await (supabaseAdmin as any)
          .from('leads')
          .update({ profile_pic: finalAvatarUrl })
          .eq('id', leadId)
      } else {
        const phoneWithout55 = cleanPhone.startsWith('55') ? cleanPhone.slice(2) : cleanPhone
        await (supabaseAdmin as any)
          .from('leads')
          .update({ profile_pic: finalAvatarUrl })
          .eq('user_id', userId)
          .or(`whatsapp.eq.${cleanPhone},whatsapp.eq.${phoneWithout55}`)
      }

      console.log(`[syncLeadAvatar] ✅ Foto de perfil atualizada no banco para ${cleanPhone}`)
      return finalAvatarUrl
    } else {
      console.log(`[syncLeadAvatar] Número ${cleanPhone} não possui foto pública no WhatsApp`)
    }

    return null
  } catch (err: any) {
    console.error('[syncLeadAvatar] Erro ao sincronizar foto de perfil:', err?.message || err)
    return null
  }
}
