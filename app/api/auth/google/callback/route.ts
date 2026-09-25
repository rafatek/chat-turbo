import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export async function GET(request: Request) {
    const url = new URL(request.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state') // Formato esperado: userId.signature
    const host = process.env.NEXT_PUBLIC_APP_URL || url.origin

    if (!code) {
        return NextResponse.json({ error: 'Code not found' }, { status: 400 })
    }

    if (!state) {
        return NextResponse.redirect(`${host}/login?error=missing_state`)
    }

    // 🔒 Proteção IDOR / CSRF: Validar a assinatura do state
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || 'fallback-secret'
    const parts = state.split('.')
    if (parts.length !== 2) {
        console.error("Invalid state format received:", state)
        return NextResponse.redirect(`${host}/agente?google_error=invalid_state`)
    }

    const [targetUserId, receivedSignature] = parts
    const expectedSignature = crypto.createHmac('sha256', secret).update(targetUserId).digest('hex')

    if (receivedSignature !== expectedSignature) {
        console.error("State HMAC signature verification failed!")
        return NextResponse.redirect(`${host}/agente?google_error=unauthorized_state`)
    }

    try {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            `${host}/api/auth/google/callback`
        )

        const { tokens } = await oauth2Client.getToken(code)
        
        if (!tokens.access_token) {
            throw new Error("No access token returned")
        }

        // Initialize Supabase ADMIN client to bypass RLS (já que o cookie de sessão pode se perder no redirecionamento cross-origin)
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
        
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || "")

        // Save tokens in agents_agendamento_config
        const payload = {
            user_id: targetUserId, // ID verificado e autenticado pela assinatura HMAC
            google_access_token: tokens.access_token,
            ...(tokens.refresh_token && { google_refresh_token: tokens.refresh_token }),
            google_token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
            updated_at: new Date().toISOString()
        }

        const { error } = await supabaseAdmin
            .from('agents_agendamento_config')
            .upsert(payload, { onConflict: 'user_id' })

        if (error) {
            console.error("Error saving google tokens to supabase:", error)
            throw error
        }

        // Redirect back to agents dashboard
        return NextResponse.redirect(`${host}/agente?google_success=true`)

    } catch (error) {
        console.error('Error during Google Auth Callback:', error)
        return NextResponse.redirect(`${host}/agente?google_error=true`)
    }
}
