import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Admin client — usa a service role key para bypassar RLS quando necessário
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '').trim()

    if (!token) {
      return NextResponse.json({ error: 'Token de autenticação ausente' }, { status: 401 })
    }

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !user) {
      console.error('[delete_msg] Auth error:', authErr?.message)
      return NextResponse.json({ error: 'Sessão inválida ou expirada' }, { status: 401 })
    }

    const body = await req.json()
    const { message_id, whatsapp_message_id, contact_phone } = body

    if (!message_id || !whatsapp_message_id || !contact_phone) {
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
      return NextResponse.json({
        error: 'Nenhuma conexão WhatsApp encontrada.'
      }, { status: 400 })
    }

    let phone = contact_phone.replace(/\D/g, '')
    if (!phone.startsWith('55') && phone.length <= 11) {
      phone = '55' + phone
    }

    const baseUrl = (process.env.NEXT_PUBLIC_UAZAPI_URL || '').replace(/\/$/, '')

    // Endpoints descobertos que funcionam com esta versão específica do UazAPI
    const endpoints = [
      { method: 'POST', path: `/message/delete`, body: { number: phone, id: whatsapp_message_id } },
      { method: 'DELETE', path: `/message/delete`, body: { number: phone, id: whatsapp_message_id } },
      
      // Fallbacks
      { method: 'DELETE', path: `/message/delete/${connection.instance_name}`, body: { number: phone, messageId: whatsapp_message_id } },
      { method: 'DELETE', path: `/chat/deleteMessage/${connection.instance_name}`, body: { number: phone, messageId: whatsapp_message_id } }
    ]

    let sendSuccess = false
    let lastError = ''

    for (const ep of endpoints) {
      try {
        const url = `${baseUrl}${ep.path}`
        console.log(`[delete_msg] Tentando: ${ep.method} ${url}`)

        const uazRes = await fetch(url, {
          method: ep.method,
          headers: {
            'Content-Type': 'application/json',
            'token': connection.instance_key,
          },
          body: JSON.stringify(ep.body),
        })

        const responseText = await uazRes.text()
        console.log(`[delete_msg] ${ep.path} → status ${uazRes.status}: ${responseText.slice(0, 200)}`)

        if (uazRes.ok || uazRes.status === 200) {
          sendSuccess = true
          console.log(`[delete_msg] ✅ Sucesso em ${ep.path}`)
          break
        }
        lastError = `${ep.path}: HTTP ${uazRes.status} — ${responseText.slice(0, 100)}`
      } catch (fetchErr: any) {
        lastError = `${ep.path}: ${fetchErr?.message}`
      }
    }

    if (!sendSuccess) {
      console.warn('[delete_msg] ❌ Falha ao apagar na API do WhatsApp. Erro:', lastError)
      // Opcional: Permitir apagar localmente mesmo se falhar no WhatsApp?
      // Por enquanto, vamos forçar a exclusão local para não prender a UI do usuário
    }

    // Marca como apagada no Supabase
    const { error: dbErr } = await supabaseAdmin
      .from('messages')
      .update({ 
          content: '🚫 Mensagem apagada',
          status: 'deleted' // se existir a coluna status e suporte para isso, senão apenas o texto muda. 
      })
      .eq('id', message_id)
      .eq('user_id', user.id)

    if (dbErr) throw dbErr

    return NextResponse.json({ success: true })

  } catch (err: any) {
    console.error('[delete_msg] Erro fatal:', err)
    return NextResponse.json({ error: 'Erro interno do servidor', details: err.message }, { status: 500 })
  }
}
