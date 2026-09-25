import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  try {
    const { pin, old_pin } = await req.json();

    if (!pin || pin.length < 4) {
      return NextResponse.json({ error: 'O PIN deve ter pelo menos 4 dígitos' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Busca perfil para ver se já existe um PIN
    const { data: profile } = await supabase.from('profiles').select('invoice_pin').eq('id', user.id).single();

    // Se já tiver PIN, exige o old_pin e verifica a hash
    if (profile?.invoice_pin) {
      if (!old_pin) {
        return NextResponse.json({ error: 'O PIN atual é obrigatório para realizar a alteração' }, { status: 400 });
      }
      
      const isValid = bcrypt.compareSync(old_pin, profile.invoice_pin);
      if (!isValid) {
        // Proteção contra força bruta no setup também
        await new Promise(resolve => setTimeout(resolve, 1000));
        return NextResponse.json({ error: 'O PIN atual informado está incorreto' }, { status: 401 });
      }
    }

    // Hasheia o PIN antes de salvar (LGPD)
    const salt = bcrypt.genSaltSync(10);
    const hashedPin = bcrypt.hashSync(pin, salt);

    // Salva o PIN hasheado no perfil do usuário
    const { error } = await supabase
      .from('profiles')
      .update({ invoice_pin: hashedPin })
      .eq('id', user.id);

    if (error) {
      console.error('Erro ao salvar PIN:', error);
      return NextResponse.json({ error: 'Erro ao configurar a segurança' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Setup PIN Error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { pin } = await req.json();

    if (!pin) {
      return NextResponse.json({ error: 'O PIN atual é obrigatório para remover a proteção' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Verifica se o PIN informado bate com o do banco
    const { data: profile } = await supabase.from('profiles').select('invoice_pin').eq('id', user.id).single();
    
    if (profile?.invoice_pin) {
      const isValid = bcrypt.compareSync(pin, profile.invoice_pin);
      if (!isValid) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return NextResponse.json({ error: 'PIN incorreto. Não foi possível remover a proteção.' }, { status: 401 });
      }
    }

    // Remove o PIN do perfil do usuário
    const { error } = await supabase
      .from('profiles')
      .update({ invoice_pin: null })
      .eq('id', user.id);

    // Opcional: deletar as sessões ativas
    await supabase.from('invoice_pin_sessions').delete().eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: 'Erro ao remover proteção' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
