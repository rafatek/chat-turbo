import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function DELETE(req: NextRequest) {
  try {
    // 1. Autenticar
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '').trim()
    if (!token) {
      return NextResponse.json({ error: 'Token de autenticação ausente' }, { status: 401 })
    }

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !user) {
      return NextResponse.json({ error: 'Sessão inválida ou expirada' }, { status: 401 })
    }

    // 2. Ler body
    const { message_id, conversation_id } = await req.json()
    if (!message_id || !conversation_id) {
      return NextResponse.json({ error: 'message_id e conversation_id são obrigatórios' }, { status: 400 })
    }

    // 3. Buscar a mensagem no banco (segurança: só apaga mensagens do próprio usuário)
    const { data: message, error: msgErr } = await supabaseAdmin
      .from('messages')
      .select('id, whatsapp_message_id, from_me, conversation_id')
      .eq('id', message_id)
      .eq('conversation_id', conversation_id)
      .eq('user_id', user.id)
      .single()

    if (msgErr || !message) {
      return NextResponse.json({ error: 'Mensagem não encontrada ou sem permissão' }, { status: 404 })
    }

    if (!message.from_me) {
      return NextResponse.json({ error: 'Só é possível apagar mensagens enviadas por você' }, { status: 403 })
    }

    // 4. Buscar a conexão WhatsApp do usuário
    const { data: connection } = await supabaseAdmin
      .from('whatsapp_connections')
      .select('instance_key, instance_name')
      .eq('user_id', user.id)
      .single()

    if (!connection?.instance_key) {
      return NextResponse.json({ error: 'Nenhuma conexão WhatsApp encontrada' }, { status: 400 })
    }

    // 5. Buscar o telefone do contato na conversa (garantindo que pertence ao usuário)
    const { data: conv } = await supabaseAdmin
      .from('conversations')
      .select('contact_phone')
      .eq('id', conversation_id)
      .eq('user_id', user.id)
      .single()

    if (!conv?.contact_phone) {
      return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 })
    }

    // 6. Formata o telefone com código do Brasil + @s.whatsapp.net
    let phone = conv.contact_phone.replace(/\D/g, '')
    if (!phone.startsWith('55') && phone.length <= 11) {
      phone = '55' + phone
    }
    const remoteJid = `${phone}@s.whatsapp.net`

    const baseUrl = (process.env.NEXT_PUBLIC_UAZAPI_URL || '').replace(/\/$/, '')
    const waMessageId = message.whatsapp_message_id

    // 7. Tenta deletar no WhatsApp via UazAPI (múltiplos endpoints para compatibilidade)
    let deleteSuccess = false
    let lastError = ''

    if (waMessageId) {
      const deleteEndpoints = [
        {
          path: '/message/delete',
          body: { id: waMessageId, remoteJid, fromMe: true },
        },
        {
          path: `/message/delete/${connection.instance_name}`,
          body: { id: waMessageId, remoteJid, fromMe: true },
        },
        {
          path: '/chat/deleteMessage',
          body: { messageId: waMessageId, remoteJid, fromMe: true },
        },
        {
          path: '/send/delete',
          body: { id: waMessageId, remoteJid, fromMe: true },
        },
      ]

      for (const ep of deleteEndpoints) {
        try {
          const url = `${baseUrl}${ep.path}`
          console.log(`[delete-message] Tentando: DELETE/POST ${url}`)

          // Tenta DELETE primeiro, depois POST (alguns endpoints aceitam ambos)
          for (const method of ['DELETE', 'POST']) {
            const res = await fetch(url, {
              method,
              headers: {
                'Content-Type': 'application/json',
                'token': connection.instance_key,
              },
              body: JSON.stringify(ep.body),
            })

            const text = await res.text()
            console.log(`[delete-message] ${method} ${ep.path} → ${res.status}: ${text.slice(0, 200)}`)

            if (res.ok) {
              deleteSuccess = true
              console.log(`[delete-message] ✅ Sucesso em ${method} ${ep.path}`)
              break
            }
            lastError = `${method} ${ep.path}: HTTP ${res.status} — ${text.slice(0, 100)}`
          }

          if (deleteSuccess) break
        } catch (err: any) {
          lastError = `${ep.path}: ${err?.message}`
          console.warn(`[delete-message] Falha em ${ep.path}:`, err?.message)
        }
      }

      if (!deleteSuccess) {
        console.warn('[delete-message] ⚠️ Não foi possível deletar no WhatsApp:', lastError)
        // Não bloqueamos — ainda remove do banco local
      }
    } else {
      console.warn('[delete-message] Sem whatsapp_message_id — só remove do banco local')
    }

    // 8. Remove a mensagem do banco de dados (garantindo isolamento por usuário)
    const { error: deleteErr } = await supabaseAdmin
      .from('messages')
      .delete()
      .eq('id', message_id)
      .eq('user_id', user.id)

    if (deleteErr) {
      console.error('[delete-message] Erro ao apagar mensagem do banco:', deleteErr.message)
      return NextResponse.json({ error: `Erro ao apagar mensagem: ${deleteErr.message}` }, { status: 500 })
    }

    console.log(`[delete-message] ✅ Mensagem ${message_id} apagada. WhatsApp: ${deleteSuccess ? 'sim' : 'falhou (só banco)'}`)
    return NextResponse.json({
      success: true,
      deleted_from_whatsapp: deleteSuccess,
    })

  } catch (err: any) {
    console.error('[delete-message] Erro fatal:', err?.message || err)
    return NextResponse.json({ error: err?.message || 'Erro interno inesperado' }, { status: 500 })
  }
}
