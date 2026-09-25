import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// -- INÍCIO: RATE LIMIT SIMPLES (IN-MEMORY) --
// Nota: Em ambiente Serverless (Edge), este Map pode resetar ocasionalmente,
// mas é suficiente para barrar robôs simples e surtos de chamadas.
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string, limit: number, windowMs: number, pathKey: string) {
    const key = `${ip}:${pathKey}`;
    const now = Date.now();
    const record = rateLimitMap.get(key);
    
    // Limpeza para evitar vazamento de memória se o Map ficar gigante
    if (rateLimitMap.size > 5000) {
        rateLimitMap.clear();
    }
    
    if (record && record.resetTime > now) {
        if (record.count >= limit) return false;
        record.count++;
        return true;
    }
    
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
}
// -- FIM: RATE LIMIT SIMPLES --

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const path = request.nextUrl.pathname;
    const method = request.method;

    // 1. Rate Limit para disparo de mensagens / API em geral (15 requisições a cada 10 segundos)
    if (path.startsWith('/api/inbox/') && method === 'POST') {
        const isAllowed = checkRateLimit(ip, 15, 10 * 1000, 'api_inbox');
        if (!isAllowed) {
            return NextResponse.json({ error: 'Muitas requisições. Vá devagar.' }, { status: 429 });
        }
    }

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    const {
        data: { user },
    } = await supabase.auth.getUser()

    // Redirecionamento seguro: Se logado e no login/home, vai para dashboard
    if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/')) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Proteção de rotas privadas
    const publicRoutes = ['/login', '/cadastro', '/forgot-password', '/update-password', '/auth', '/favicon.ico', '/api/webhook', '/api/asaas', '/api/capture', '/api/inbox/process-media']
    if (!user && !publicRoutes.some((route) => request.nextUrl.pathname.startsWith(route))) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    return response
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
