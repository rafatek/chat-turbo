import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { listAsaasPayments } from '@/lib/asaas';

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('asaas_customer_id')
      .eq('id', user.id)
      .single();

    if (!profile?.asaas_customer_id) {
      return NextResponse.json({ next_due_date: null });
    }

    const payments = await listAsaasPayments(profile.asaas_customer_id);
    if (!payments || !payments.data) {
      return NextResponse.json({ next_due_date: null });
    }

    // Find the earliest PENDING invoice
    const pendingInvoices = payments.data.filter((p: any) => p.status === 'PENDING');
    if (pendingInvoices.length === 0) {
      return NextResponse.json({ next_due_date: null });
    }

    // Sort by due date
    pendingInvoices.sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    
    return NextResponse.json({ next_due_date: pendingInvoices[0].dueDate });
  } catch (err: any) {
    console.error('Erro ao buscar next due date:', err);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
