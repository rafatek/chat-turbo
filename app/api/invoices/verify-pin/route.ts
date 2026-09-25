import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  try {
    const { pin } = await req.json();

    if (!pin) {
      return NextResponse.json({ error: 'PIN é obrigatório' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Busca o PIN cadastrado pelo usuário
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('invoice_pin')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 });
    }

    if (!profile.invoice_pin) {
      return NextResponse.json({ error: 'PIN não configurado' }, { status: 400 });
    }

    // Verifica a hash usando bcrypt
    const isValid = bcrypt.compareSync(pin, profile.invoice_pin);
    if (!isValid) {
      // Proteção contra força bruta (Artificial Delay)
      await new Promise(resolve => setTimeout(resolve, 1000));
      return NextResponse.json({ error: 'PIN incorreto' }, { status: 401 });
    }

    // Se o PIN for válido, cria a sessão
    // Sessão válida por 15 minutos
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const deviceId = crypto.randomUUID(); // Gerado de forma segura no servidor

    const { error: sessionError } = await supabase
      .from('invoice_pin_sessions')
      .insert([
        {
          user_id: user.id,
          device_id: deviceId,
          expires_at: expiresAt,
        }
      ]);

    if (sessionError) {
      console.error('Erro ao criar sessão PIN:', sessionError);
      return NextResponse.json({ error: 'Erro ao iniciar sessão' }, { status: 500 });
    }

    // Set cookie para manter o device_id de forma segura (HttpOnly por segurança)
    const cookieStore = await cookies();
    cookieStore.set('device_id', deviceId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60, // 15 minutos
      path: '/'
    });

    return NextResponse.json({ success: true, expires_at: expiresAt });

  } catch (err: any) {
    console.error('Verify PIN Error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
