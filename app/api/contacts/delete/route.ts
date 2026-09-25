import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Admin client — usa service role para bypassar RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function DELETE(req: NextRequest) {
  try {
    // 1. Autenticar o usuário pelo token JWT
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
    const { conversation_id } = await req.json()
    if (!conversation_id) {
      return NextResponse.json({ error: 'conversation_id é obrigatório' }, { status: 400 })
    }

    // 3. Verificar que a conversa pertence ao usuário (segurança)
    const { data: conv, error: convCheckErr } = await supabaseAdmin
      .from('conversations')
      .select('id, lead_id')
      .eq('id', conversation_id)
      .eq('user_id', user.id)
      .single()

    if (convCheckErr || !conv) {
      return NextResponse.json({ error: 'Conversa não encontrada ou sem permissão' }, { status: 404 })
    }

    const leadId = conv.lead_id

    // 4. Apagar mensagens
    const { error: msgErr } = await supabaseAdmin
      .from('messages')
      .delete()
      .eq('conversation_id', conversation_id)

    if (msgErr) {
      console.error('[delete-contact] Erro ao apagar mensagens:', msgErr.message)
      return NextResponse.json({ error: `Erro ao apagar mensagens: ${msgErr.message}` }, { status: 500 })
    }

    // 5. Apagar lead (se existir) ANTES da conversa por causa da FK
    if (leadId) {
      const { error: leadErr } = await supabaseAdmin
        .from('leads')
        .delete()
        .eq('id', leadId)

      if (leadErr) {
        console.error('[delete-contact] Erro ao apagar lead:', leadErr.message)
        return NextResponse.json({ error: `Erro ao apagar lead: ${leadErr.message}` }, { status: 500 })
      }
    } else {
      // Tenta apagar leads órfãos vinculados a esta conversa (sem lead_id na conversa)
      await supabaseAdmin
        .from('leads')
        .delete()
        .eq('conversation_id', conversation_id)
        .eq('user_id', user.id)
    }

    // 6. Apagar conversa
    const { error: convErr } = await supabaseAdmin
      .from('conversations')
      .delete()
      .eq('id', conversation_id)

    if (convErr) {
      console.error('[delete-contact] Erro ao apagar conversa:', convErr.message)
      return NextResponse.json({ error: `Erro ao apagar conversa: ${convErr.message}` }, { status: 500 })
    }

    console.log(`[delete-contact] ✅ Contato deletado. conv_id: ${conversation_id}`)
    return NextResponse.json({ success: true })

  } catch (err: any) {
    console.error('[delete-contact] Erro fatal:', err?.message || err)
    return NextResponse.json({ error: err?.message || 'Erro interno inesperado' }, { status: 500 })
  }
}
