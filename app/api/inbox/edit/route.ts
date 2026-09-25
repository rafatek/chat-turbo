import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function PUT(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '').trim()

    if (!token) {
      return NextResponse.json({ error: 'Token de autenticação ausente' }, { status: 401 })
    }

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !user) {
      return NextResponse.json({ error: 'Sessão inválida ou expirada' }, { status: 401 })
    }

    const body = await req.json()
    const { message_id, whatsapp_message_id, contact_phone, content } = body

    if (!message_id || !whatsapp_message_id || !contact_phone || !content) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
    }

    // 2.5. Verificar se a mensagem pertence ao usuário (IDOR Check)
    const { data: msgCheck, error: msgCheckErr } = await supabaseAdmin
      .from('messages')
      .select('id, user_id')
      .eq('id', message_id)
      .eq('user_id', user.id)
      .single()

    if (msgCheckErr || !msgCheck) {
      return NextResponse.json({ error: 'Mensagem não encontrada ou sem permissão' }, { status: 404 })
    }

    const { data: connection, error: connErr } = await supabaseAdmin
      .from('whatsapp_connections')
      .select('instance_key, instance_name')
      .eq('user_id', user.id)
      .single()

    if (connErr || !connection?.instance_key) {
      return NextResponse.json({ error: 'Nenhuma conexão WhatsApp encontrada.' }, { status: 400 })
    }

    let phone = contact_phone.replace(/\D/g, '')
    if (!phone.startsWith('55') && phone.length <= 11) {
      phone = '55' + phone
    }

    const baseUrl = (process.env.NEXT_PUBLIC_UAZAPI_URL || '').replace(/\/$/, '')

    // Endpoints descobertos que funcionam com esta versão específica do UazAPI
    const endpoints = [
      { method: 'POST', path: `/message/edit`, body: { number: phone, id: whatsapp_message_id, text: content } },
      { method: 'PUT', path: `/message/edit`, body: { number: phone, id: whatsapp_message_id, text: content } },
      { method: 'PATCH', path: `/message/edit`, body: { number: phone, id: whatsapp_message_id, text: content } },
      
      // Fallbacks
      { method: 'PATCH', path: `/message/edit/${connection.instance_name}`, body: { number: phone, messageId: whatsapp_message_id, text: content } },
      { method: 'PUT', path: `/message/update/${connection.instance_name}`, body: { number: phone, messageId: whatsapp_message_id, text: content } },
    ]

    let sendSuccess = false
    let allErrors: string[] = []

    for (const ep of endpoints) {
      try {
        const url = `${baseUrl}${ep.path}`
        console.log(`[edit_msg] Tentando: ${ep.method} ${url}`)

        const uazRes = await fetch(url, {
          method: ep.method,
          headers: {
            'Content-Type': 'application/json',
            'token': connection.instance_key,
          },
          body: JSON.stringify(ep.body),
        })

        const responseText = await uazRes.text()
        console.log(`[edit_msg] ${ep.path} → status ${uazRes.status}: ${responseText.slice(0, 200)}`)

        if (uazRes.ok || uazRes.status === 200) {
          sendSuccess = true
          console.log(`[edit_msg] ✅ Sucesso em ${ep.path}`)
          break
        }
        allErrors.push(`[${ep.method} ${ep.path}]: HTTP ${uazRes.status} — ${responseText.slice(0, 100)}`)
      } catch (fetchErr: any) {
        allErrors.push(`[${ep.method} ${ep.path}]: ${fetchErr?.message}`)
      }
    }

    if (!sendSuccess) {
      console.warn('[edit_msg] ❌ Falha ao editar na API do WhatsApp. Erro:', allErrors.join(' | '))
      // Pode ser que os 15 minutos já tenham passado. Vamos retornar erro para a UI.
      return NextResponse.json({ 
        error: `Falha ao editar no WhatsApp. Detalhes: ${allErrors.join(' | ')}` 
      }, { status: 400 })
    }

    // Marca como editada no Supabase
    const { error: dbErr } = await supabaseAdmin
      .from('messages')
      .update({ 
          content: content
          // Se tiver um campo is_edited, poderiamos setar true
      })
      .eq('id', message_id)
      .eq('user_id', user.id)

    if (dbErr) throw dbErr

    return NextResponse.json({ success: true })

  } catch (err: any) {
    console.error('[edit_msg] Erro fatal:', err)
    return NextResponse.json({ error: 'Erro interno do servidor', details: err.message }, { status: 500 })
  }
}
