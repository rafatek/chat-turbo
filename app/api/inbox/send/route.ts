import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Admin client — usa a service role key para bypassar RLS quando necessário
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    // 1. Pega o token JWT enviado pelo cliente no header Authorization
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '').trim()

    if (!token) {
      return NextResponse.json({ error: 'Token de autenticação ausente' }, { status: 401 })
    }

    // 2. Valida o token e extrai o usuário
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !user) {
      console.error('[send] Auth error:', authErr?.message)
      return NextResponse.json({ error: 'Sessão inválida ou expirada' }, { status: 401 })
    }

    // 3. Lê o body
    const body = await req.json()
    const { conversation_id, contact_phone, content, media_url, media_type } = body

    if (!conversation_id || !contact_phone || (!content && !media_url)) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes (conversation_id, contact_phone, content ou media_url)' }, { status: 400 })
    }

    // 3.5. Verificar que a conversa pertence ao usuário (Segurança / IDOR)
    const { data: convData, error: convCheckErr } = await supabaseAdmin
      .from('conversations')
      .select('id, lead_id')
      .eq('id', conversation_id)
      .eq('user_id', user.id)
      .single()

    if (convCheckErr || !convData) {
      return NextResponse.json({ error: 'Conversa não encontrada ou sem permissão' }, { status: 404 })
    }

    // 4. Busca a conexão WhatsApp do usuário
    const { data: connection, error: connErr } = await supabaseAdmin
      .from('whatsapp_connections')
      .select('instance_key, instance_name')
      .eq('user_id', user.id)
      .single()

    if (connErr || !connection?.instance_key) {
      console.error('[send] No connection:', connErr?.message)
      return NextResponse.json({
        error: 'Nenhuma conexão WhatsApp encontrada. Conecte o número na página de Conexões.'
      }, { status: 400 })
    }

    // 5. Formata o telefone (garante código do Brasil)
    let phone = contact_phone.replace(/\D/g, '')
    if (!phone.startsWith('55') && phone.length <= 11) {
      phone = '55' + phone
    }

    // 6. Remove barra final da URL base (evita double slash)
    const baseUrl = (process.env.NEXT_PUBLIC_UAZAPI_URL || '').replace(/\/$/, '')

    console.log(`[send] → ${phone} | instância: ${connection.instance_name} | base: ${baseUrl}`)

    // 7. Tenta múltiplos endpoints do UazAPI (compatibilidade com versões diferentes)
    let endpoints: any[] = []
    
    if (media_url) {
        endpoints = [
            { path: '/send/media', body: { number: phone, type: media_type || 'document', file: media_url, docName: 'anexo', text: content === '[Mídia]' ? '' : content || '' } },
            { path: '/message/sendMedia', body: { number: phone, mediatype: media_type || 'document', mimetype: 'application/octet-stream', caption: content === '[Mídia]' ? '' : content || '', media: media_url } },
            { path: '/message/sendMediaUrl', body: { number: phone, url: media_url, caption: content === '[Mídia]' ? '' : content || '' } },
        ]
    } else {
        endpoints = [
            { path: '/send/text',        body: { number: phone, text: content } },
            { path: `/message/sendText/${connection.instance_name}`, body: { number: phone, text: content } },
            { path: `/message/sendText/${connection.instance_name}`, body: { number: phone, textMessage: { text: content } } },
            { path: `/message/text/${connection.instance_name}`,     body: { number: phone, text: content } },
            { path: `/send/text/${connection.instance_name}`,        body: { number: phone, text: content } },
            // fallbacks legados (sem nome de instância)
            { path: '/message/sendText', body: { number: phone, text: content } },
            { path: '/message/text',     body: { number: phone, text: content } },
        ]
    }

    let uazData: any = null
    let sendSuccess = false
    let lastError = ''

    for (const ep of endpoints) {
      try {
        const url = `${baseUrl}${ep.path}`
        console.log(`[send] Tentando: POST ${url}`)

        const uazRes = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'token': connection.instance_key,
          },
          body: JSON.stringify(ep.body),
        })

        const responseText = await uazRes.text()
        console.log(`[send] ${ep.path} → status ${uazRes.status}: ${responseText.slice(0, 300)}`)

        if (uazRes.ok) {
          try { uazData = JSON.parse(responseText) } catch { uazData = {} }
          sendSuccess = true
          console.log(`[send] ✅ Sucesso em ${ep.path}`)
          break
        }

        lastError = `${ep.path}: HTTP ${uazRes.status} — ${responseText.slice(0, 100)}`
      } catch (fetchErr: any) {
        lastError = `${ep.path}: ${fetchErr?.message}`
        console.warn(`[send] Falha em ${ep.path}:`, fetchErr?.message)
      }
    }

    if (!sendSuccess) {
      console.error('[send] ❌ Todos os endpoints falharam. Último erro:', lastError)
      return NextResponse.json({
        error: `Falha ao enviar pelo WhatsApp. Detalhes: ${lastError}`
      }, { status: 500 })
    }

    const messageId = uazData?.key?.id || uazData?.id || uazData?.messageId || null

    // 8. O lead_id já foi buscado no passo 3.5

    // 9. Salva a mensagem no banco
    const { data: message, error: msgError } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id,
        user_id: user.id,
        content: content || '[Mídia]',
        from_me: true,
        whatsapp_message_id: messageId,
        status: 'sent',
        lead_id: convData?.lead_id || null,
        media_url: media_url || null,
        media_type: media_type || null
      })
      .select()
      .single()

    if (msgError) {
      console.error('[send] Erro ao salvar mensagem:', msgError.message)
      return NextResponse.json({ error: 'Mensagem enviada mas falha ao salvar no banco' }, { status: 500 })
    }

    // 10. Atualiza last_message na conversa
    await supabaseAdmin
      .from('conversations')
      .update({ last_message: content || '[Mídia]', last_message_at: new Date().toISOString() })
      .eq('id', conversation_id)

    console.log(`[send] ✅ Mensagem salva. DB id: ${message.id}`)
    return NextResponse.json({ success: true, message })

  } catch (err: any) {
    console.error('[send] Erro fatal:', err?.message || err)
    return NextResponse.json({ error: err?.message || 'Erro interno inesperado' }, { status: 500 })
  }
}
