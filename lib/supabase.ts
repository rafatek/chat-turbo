import { createBrowserClient } from '@supabase/ssr'

// Helper seguro para obter variáveis em tempo de execução (runtime)
function getRuntimeEnv(key: string): string {
    if (typeof window !== 'undefined') {
        const winEnv = (window as any).__ENV
        if (winEnv && winEnv[key]) {
            return winEnv[key]
        }
        if ((window as any).process?.env?.[key]) {
            return (window as any).process.env[key]
        }
    }
    return process.env[key] || ''
}

let clientInstance: ReturnType<typeof createBrowserClient> | null = null

export function getSupabaseBrowserClient() {
    const url = getRuntimeEnv('NEXT_PUBLIC_SUPABASE_URL')
    const anonKey = getRuntimeEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

    if (!url || !anonKey) {
        if (typeof window === 'undefined') {
            // Durante compilação no servidor / build estático, evita lançar exceção
            return null as any
        }
        console.error(
            '[Supabase Client Error] NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY não estão definidas no ambiente de runtime!'
        )
        return null as any
    }

    if (!clientInstance) {
        clientInstance = createBrowserClient(url, anonKey)
    }
    return clientInstance
}

// Proxy transparente para manter total compatibilidade com `import { supabase } from '@/lib/supabase'`
export const supabase = new Proxy({} as ReturnType<typeof createBrowserClient>, {
    get(_, prop) {
        const client = getSupabaseBrowserClient()
        if (!client) {
            // Em caso de chamada antes da inicialização ou durante renderização estática
            if (prop === 'auth') {
                return {
                    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
                    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
                    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
                }
            }
            return () => Promise.resolve({ data: null, error: new Error('Supabase client not initialized') })
        }
        const val = (client as any)[prop]
        return typeof val === 'function' ? val.bind(client) : val
    }
})