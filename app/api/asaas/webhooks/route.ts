import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  try {
    // Validação do token de segurança do webhook do Asaas (higieniza aspas/espaços)
    const webhookSecret = (process.env.ASAAS_WEBHOOK_SECRET || '').trim().replace(/^["']|["']$/g, '');
    const receivedToken = (req.headers.get('asaas-access-token') || '').trim();

    if (webhookSecret && receivedToken !== webhookSecret) {
      console.warn('[Asaas Webhook] Acesso negado: token inválido ou ausente.');
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const payload = await req.json();
    const event = payload.event; // ex: PAYMENT_RECEIVED, PAYMENT_OVERDUE
    const payment = payload.payment; // Objeto de pagamento do Asaas

    if (!payment || !payment.id) {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
    }

    // Atualiza a tabela profiles para bloquear ou liberar o usuário
    let profileStatus: string | null = null;

    if (event === 'PAYMENT_OVERDUE') {
      profileStatus = 'vencida';
    } else if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      // Se pagou, reativamos o acesso
      profileStatus = 'active';
    }

    if (profileStatus && payment.customer) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({ subscription_status: profileStatus, updated_at: new Date().toISOString() })
        .eq('asaas_customer_id', payment.customer);

      if (profileError) {
        console.error('Erro ao atualizar perfil no webhook:', profileError);
      }
    }

    return NextResponse.json({ received: true, updated: true });
  } catch (err: any) {
    console.error('Webhook Error:', err);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
