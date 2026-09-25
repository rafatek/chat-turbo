/**
 * Implementação de Rate Limit em Memória
 * Ideal para Vercel Serverless (mitiga flood na mesma instância)
 */

type RateLimitData = {
    count: number;
    resetAt: number;
};

// Usamos globalThis para preservar o estado durante os HMR no desenvolvimento
// e manter em cache entre requisições quentes na mesma instância (Vercel)
const rateLimitCache = (globalThis as any).__rateLimitCache || new Map<string, RateLimitData>();

if (!(globalThis as any).__rateLimitCache) {
    (globalThis as any).__rateLimitCache = rateLimitCache;
}

interface RateLimitConfig {
    maxRequests?: number; // Máximo de requisições permitidas
    windowMs?: number;    // Janela de tempo em milissegundos
}

/**
 * Verifica se a chave excedeu o limite de requisições.
 * @param key Chave identificadora (ex: token do webhook, IP do usuário)
 * @param config Configurações de limite (padrão: 60 requisições por minuto)
 */
export function checkRateLimit(key: string, config?: RateLimitConfig): { success: boolean; limit: number; remaining: number; resetAt: number } {
    const maxRequests = config?.maxRequests || 60;
    const windowMs = config?.windowMs || 60 * 1000; // 1 minuto padrão
    
    const now = Date.now();
    let data = rateLimitCache.get(key);

    if (!data) {
        data = { count: 0, resetAt: now + windowMs };
    }

    // Se a janela expirou, reseta a contagem
    if (now > data.resetAt) {
        data.count = 0;
        data.resetAt = now + windowMs;
    }

    data.count++;
    rateLimitCache.set(key, data);

    const remaining = Math.max(0, maxRequests - data.count);
    const success = data.count <= maxRequests;

    // Opcional: limpeza de cache para evitar memory leak em produção
    if (rateLimitCache.size > 10000) {
        // Remove 20% das chaves aleatoriamente ou simplesmente esvazia
        rateLimitCache.clear();
    }

    return {
        success,
        limit: maxRequests,
        remaining,
        resetAt: data.resetAt,
    };
}
