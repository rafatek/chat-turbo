import { createClient } from '@supabase/supabase-js'

let adminInstance: ReturnType<typeof createClient> | null = null

/**
 * Cria ou retorna a instância do Supabase Admin em tempo de execução (runtime).
 * Não executa durante a compilação/build estático do Docker.
 */
export function getAdminClient() {
    if (!adminInstance) {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!url || !key) {
            throw new Error('Variáveis do Supabase Admin (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) ausentes no runtime do servidor.')
        }

        adminInstance = createClient(url, key, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        })
    }
    return adminInstance
}

export async function createAdminClient() {
    return getAdminClient()
}

/**
 * Proxy seguro para uso transparente como `supabaseAdmin` em Route Handlers.
 * A inicialização real só ocorre na primeira requisição em runtime.
 */
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createClient>, {
    get(_, prop) {
        const client = getAdminClient()
        const val = (client as any)[prop]
        return typeof val === 'function' ? val.bind(client) : val
    }
})
