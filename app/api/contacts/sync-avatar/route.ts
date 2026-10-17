export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { syncLeadAvatar } from '@/lib/utils/avatar'

export async function POST(req: NextRequest) {
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
    const { phone, leadId } = body

    if (!phone) {
      return NextResponse.json({ error: 'Telefone obrigatório' }, { status: 400 })
    }

    const avatarUrl = await syncLeadAvatar({
      userId: user.id,
      phone,
      leadId
    })

    return NextResponse.json({ success: true, avatarUrl })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}
