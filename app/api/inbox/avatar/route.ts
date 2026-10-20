export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createClient } from '@/lib/supabase-server';

// Cache em memória compartilhado entre requisições no Node.js
interface CacheItem {
  buffer: ArrayBuffer;
  contentType: string;
  expiresAt: number;
}
const memoryCache = new Map<string, CacheItem>();
const MAX_CACHE_ITEMS = 600;
const TTL_MS = 1000 * 60 * 60 * 6; // 6 horas em memória
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

// Set para evitar disparos concorrentes de persistência no Storage para o mesmo contato
const syncingSet = new Set<string>();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Função assíncrona para persistir a foto no Supabase Storage (bucket chat_media)
 * e substituir a URL temporária do WhatsApp pela URL permanente na tabela `leads`.
 * Protegida contra Path Traversal, SSRF e com isolamento estrito de Tenant (user_id).
 */
async function persistAvatarToStorage({
  buffer,
  contentType,
  phone,
  leadId,
  userId,
}: {
  buffer: ArrayBuffer;
  contentType: string;
  phone?: string | null;
  leadId?: string | null;
  userId: string;
}) {
  const cleanPhone = phone ? phone.replace(/\D/g, '') : null;
  const validLeadId = leadId && UUID_REGEX.test(leadId) ? leadId : null;

  // Sanitização estrita do identificador do arquivo para evitar Path Traversal
  const rawFileId = cleanPhone || validLeadId;
  if (!rawFileId) return;

  const fileId = rawFileId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!fileId) return;

  const syncKey = `${userId}:${fileId}`;
  if (syncingSet.has(syncKey)) return;

  syncingSet.add(syncKey);
  try {
    const filePath = `avatars/${fileId}.jpg`;
    const nodeBuffer = Buffer.from(buffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from('chat_media')
      .upload(filePath, nodeBuffer, {
        contentType: contentType || 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      console.warn(`[Avatar Proxy] Erro no upload para Storage (${syncKey}):`, uploadError.message);
      return;
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('chat_media')
      .getPublicUrl(filePath);

    if (!publicUrl) return;

    // Atualiza a tabela leads com isolamento estrito de tenant (user_id)
    if (validLeadId) {
      await (supabaseAdmin as any)
        .from('leads')
        .update({ profile_pic: publicUrl })
        .eq('id', validLeadId)
        .eq('user_id', userId);
    }
    if (cleanPhone && cleanPhone.length >= 8 && cleanPhone.length <= 20) {
      const phoneWithout55 = cleanPhone.startsWith('55') ? cleanPhone.slice(2) : cleanPhone;
      const phoneWith55 = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
      await (supabaseAdmin as any)
        .from('leads')
        .update({ profile_pic: publicUrl })
        .eq('user_id', userId)
        .or(`whatsapp.eq.${phoneWith55},whatsapp.eq.${phoneWithout55}`);
    }

    console.log(`[Avatar Proxy] 🚀 Sucesso: Avatar salvo no Supabase Storage e substituído no banco para ${syncKey}: ${publicUrl}`);
  } catch (err: any) {
    console.warn(`[Avatar Proxy] Erro ao persistir avatar no Storage (${syncKey}):`, err?.message || err);
  } finally {
    syncingSet.delete(syncKey);
  }
}

export async function GET(req: NextRequest) {
  // 1. Verificação de Autenticação obrigatória (usuário logado no sistema)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const url = req.nextUrl.searchParams.get('url');
  const phone = req.nextUrl.searchParams.get('phone');
  const leadId = req.nextUrl.searchParams.get('leadId');

  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  // 2. Validação estrita de URL e prevenção de SSRF
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new NextResponse('Invalid URL format', { status: 400 });
  }

  // Somente HTTPS
  if (parsed.protocol !== 'https:') {
    return new NextResponse('Only HTTPS protocol allowed', { status: 403 });
  }

  const hostname = parsed.hostname.toLowerCase();

  // Whitelist estrita de domínios permitidos (evita spoofing como evilwhatsapp.net)
  const allowedSuffixes = [
    '.whatsapp.net',
    '.fbcdn.net',
    '.facebook.com',
    '.supabase.co',
  ];
  const allowedExactHosts = [
    'whatsapp.net',
    'fbcdn.net',
    'facebook.com',
    'pps.whatsapp.net',
  ];

  const isAllowedHost = 
    allowedExactHosts.includes(hostname) ||
    allowedSuffixes.some((suffix) => hostname.endsWith(suffix));

  if (!isAllowedHost) {
    return new NextResponse('Host not allowed', { status: 403 });
  }

  // 3. Cache em memória (LRU) para responder em <1ms
  const cached = memoryCache.get(url);
  if (cached && Date.now() < cached.expiresAt) {
    if (phone || leadId) {
      persistAvatarToStorage({
        buffer: cached.buffer,
        contentType: cached.contentType,
        phone,
        leadId,
        userId: user.id,
      }).catch(() => {});
    }

    return new NextResponse(cached.buffer, {
      status: 200,
      headers: {
        'Content-Type': cached.contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
        'X-Cache': 'HIT',
      },
    });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
      },
    });

    if (!response.ok) {
      return new NextResponse('Failed to fetch avatar', { status: response.status });
    }

    // 4. Validação de tamanho máximo (evita ataques de DoS por estouro de memória)
    const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_IMAGE_SIZE) {
      return new NextResponse('Image too large', { status: 413 });
    }

    // 5. Validação de tipo MIME seguro (somente imagens seguras)
    const rawContentType = (response.headers.get('content-type') || 'image/jpeg').toLowerCase();
    const safeMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const isSafeImage = safeMimes.some((type) => rawContentType.startsWith(type));
    const contentType = isSafeImage ? rawContentType.split(';')[0].trim() : 'image/jpeg';

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_IMAGE_SIZE) {
      return new NextResponse('Image too large', { status: 413 });
    }

    // 6. Atualizar cache em memória
    if (memoryCache.size >= MAX_CACHE_ITEMS) {
      const firstKey = memoryCache.keys().next().value;
      if (firstKey) memoryCache.delete(firstKey);
    }
    memoryCache.set(url, {
      buffer,
      contentType,
      expiresAt: Date.now() + TTL_MS,
    });

    // 7. Persistência assíncrona protegida no Supabase Storage
    if (phone || leadId) {
      persistAvatarToStorage({
        buffer,
        contentType,
        phone,
        leadId,
        userId: user.id,
      }).catch(() => {});
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
        'X-Cache': 'MISS',
      },
    });
  } catch (err: any) {
    console.error('[Avatar Proxy] Error:', err);
    return new NextResponse('Internal error', { status: 500 });
  }
}
