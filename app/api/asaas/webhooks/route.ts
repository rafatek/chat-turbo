import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const event = payload.event; // ex: PAYMENT_RECEIVED, PAYMENT_OVERDUE
    const payment = payload.payment; // Objeto de pagamento do Asaas

    if (!payment || !payment.id) {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
    }

    // Usar a service role key porque o webhook vem do Asaas e não tem sessão
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Atualiza a tabela profiles para bloquear ou liberar o usuário
    let profileStatus: string | null = null;

    if (event === 'PAYMENT_OVERDUE') {
      profileStatus = 'vencida';
    } else if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      // Se pagou, reativamos o acesso
      profileStatus = 'active';
    }

    if (profileStatus && payment.customer) {
      const { error: profileError } = await supabase
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
