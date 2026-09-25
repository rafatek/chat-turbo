import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Admin client para validações de segurança
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    // 1. Validar autenticação do usuário
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '').trim()

    if (!token) {
      return NextResponse.json({ error: 'Token de autenticação ausente' }, { status: 401 })
    }

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !user) {
      return NextResponse.json({ error: 'Sessão inválida ou expirada' }, { status: 401 })
    }

    // 2. Extrair dados da requisição
    const body = await req.json().catch(() => ({}))
    const { lead_id, conversation_id } = body

    if (!lead_id && !conversation_id) {
      return NextResponse.json({ error: 'lead_id ou conversation_id é obrigatório' }, { status: 400 })
    }

    let finalLeadId = lead_id

    // 3. Se não tiver lead_id direto, buscar pelo conversation_id pertencente ao usuário
    if (!finalLeadId && conversation_id) {
      const { data: leadData } = await supabaseAdmin
        .from('leads')
        .select('id')
        .eq('conversation_id', conversation_id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (leadData) {
        finalLeadId = leadData.id
      }
    }

    if (!finalLeadId) {
      return NextResponse.json({ error: 'Lead não encontrado para esta conversa.' }, { status: 404 })
    }

    // 4. Obter a URL do Webhook do N8N
    const n8nWebhookUrl = process.env.N8N_IA_ASSISTENT_WEBHOOK_URL
    if (!n8nWebhookUrl) {
      console.error('[assist_api] N8N_IA_ASSISTENT_WEBHOOK_URL não configurada no .env')
      return NextResponse.json({ error: 'Webhook do Assistente de IA não configurado no servidor.' }, { status: 500 })
    }

    console.log(`[assist_api] Solicitando sugestões ao n8n para lead_id: ${finalLeadId}`)

    // 5. Enviar requisição para o N8N com timeout de segurança
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 25000) // 25s timeout

    let n8nResponse: Response
    try {
      n8nResponse = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lead_id: finalLeadId,
          user_id: user.id,
          conversation_id: conversation_id || null,
        }),
        signal: controller.signal,
      })
    } catch (fetchErr: any) {
      clearTimeout(timeoutId)
      if (fetchErr.name === 'AbortError') {
        return NextResponse.json({ error: 'Tempo limite excedido ao aguardar resposta da IA.' }, { status: 504 })
      }
      throw fetchErr
    } finally {
      clearTimeout(timeoutId)
    }

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text()
      console.error(`[assist_api] Erro retornado pelo n8n (HTTP ${n8nResponse.status}):`, errorText)
      return NextResponse.json({
        error: 'Erro no processamento do assistente de IA no n8n.',
        details: errorText.slice(0, 300)
      }, { status: 502 })
    }

    const rawData = await n8nResponse.json()
    console.log('[assist_api] Resposta recebida do n8n:', JSON.stringify(rawData, null, 2))

    // 6. Normalizar as 3 respostas sugeridas
    const suggestions: string[] = []

    // Caso A: Array [{ output: { resposta_1, resposta_2, resposta_3 } }]
    let outputObj: any = null

    if (Array.isArray(rawData) && rawData.length > 0) {
      outputObj = rawData[0]?.output || rawData[0]
    } else if (typeof rawData === 'object' && rawData !== null) {
      outputObj = rawData.output || rawData
    }

    if (outputObj && typeof outputObj === 'object') {
      if (outputObj.resposta_1) suggestions.push(String(outputObj.resposta_1).trim())
      if (outputObj.resposta_2) suggestions.push(String(outputObj.resposta_2).trim())
      if (outputObj.resposta_3) suggestions.push(String(outputObj.resposta_3).trim())

      // Fallback: se vier como array dentro de suggestions ou opções
      if (suggestions.length === 0 && Array.isArray(outputObj.sugestoes || outputObj.suggestions)) {
        const list = outputObj.sugestoes || outputObj.suggestions
        list.forEach((item: any) => {
          if (typeof item === 'string' && item.trim()) suggestions.push(item.trim())
          else if (item?.texto || item?.text) suggestions.push(String(item.texto || item.text).trim())
        })
      }
    }

    // Se ainda estiver vazio, tentar varrer valores de strings
    if (suggestions.length === 0 && outputObj && typeof outputObj === 'object') {
      Object.values(outputObj).forEach(val => {
        if (typeof val === 'string' && val.trim().length > 5) {
          suggestions.push(val.trim())
        }
      })
    }

    if (suggestions.length === 0) {
      return NextResponse.json({
        error: 'O assistente de IA não retornou sugestões válidas.',
        raw: rawData
      }, { status: 422 })
    }

    return NextResponse.json({
      success: true,
      suggestions: suggestions.slice(0, 3), // Máximo 3 sugestões
    })

  } catch (err: any) {
    console.error('[assist_api] Erro inesperado:', err)
    return NextResponse.json({
      error: 'Erro interno ao processar sugestões do assistente.',
      details: err?.message || err
    }, { status: 500 })
  }
}
