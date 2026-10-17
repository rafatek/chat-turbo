export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Permitir apenas domínios de CDN do WhatsApp e Meta
    const isAllowedHost = 
      hostname.endsWith('whatsapp.net') ||
      hostname.endsWith('fbcdn.net') ||
      hostname.endsWith('facebook.com') ||
      hostname.endsWith('supabase.co');

    if (!isAllowedHost) {
      return new NextResponse('Host not allowed', { status: 403 });
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
      },
    });

    if (!response.ok) {
      return new NextResponse('Failed to fetch avatar', { status: response.status });
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch (err: any) {
    console.error('[Avatar Proxy] Error:', err);
    return new NextResponse('Internal error', { status: 500 });
  }
}
