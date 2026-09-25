import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createClient } from '@/lib/supabase-server'
import crypto from 'crypto'

export async function GET(request: Request) {
    const url = new URL(request.url)
    const host = process.env.NEXT_PUBLIC_APP_URL || url.origin // Garante que a URL base venha da env em produção

    // Pegar o usuário atual da sessão
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.redirect(`${host}/login?error=auth_required`)
    }

    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        `${host}/api/auth/google/callback`
    )

    // Scopes needed for Calendar
    const scopes = [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
    ]

    // 🔒 Assinar o state com HMAC para impedir manipulação de user_id (IDOR)
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || 'fallback-secret'
    const signature = crypto.createHmac('sha256', secret).update(user.id).digest('hex')
    const signedState = `${user.id}.${signature}`

    const authorizationUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline', // Gets refresh token
        scope: scopes,
        prompt: 'consent', // Forces consent screen to always get refresh token
        state: signedState
    })

    return NextResponse.redirect(authorizationUrl)
}
