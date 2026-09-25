import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { formatBrazilianPhone } from '@/lib/utils/phone'
import { checkRateLimit } from '@/lib/utils/rate-limit'

// Initializing Supabase Client with Service Role Key to bypass RLS for token lookup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseServiceKey) {
  console.error("FATAL: SUPABASE_SERVICE_ROLE_KEY is missing. Webhooks require this key to bypass RLS.")
}

const supabase = createClient(supabaseUrl, supabaseServiceKey || "")

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  console.log("Webhook POST received")
  try {
    const { token } = await params
    console.log("Token received:", token)

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400, headers: corsHeaders })
    }

    // Rate Limiting Check (100 requests per minute for messaging webhooks)
    const { success, remaining, resetAt } = checkRateLimit(`webhook_${token}`, { maxRequests: 100 })
    if (!success) {
      console.warn(`[RATE LIMIT] Blocked message webhook token: ${token}. Reset at ${new Date(resetAt).toISOString()}`)
      return NextResponse.json({ error: 'Too Many Requests', retryAfter: new Date(resetAt).toISOString() }, { status: 429, headers: corsHeaders })
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn("WARNING: Using ANON KEY for Webhook. This will likely fail RLS checks.")
    }

    const body = await req.json()
    console.log("\n================ WEBHOOK PAYLOAD INICIO ================")
    console.log("Token:", token)
    console.log(JSON.stringify(body, null, 2))
    console.log("================ WEBHOOK PAYLOAD FIM ================\n")

    // =============================================
    // CASE A: Incoming WhatsApp MESSAGE via UazAPI or n8n
    // Detect by presence of 'event', 'source', or message-like structure
    // =============================================
    const isIncomingMessage =
      body.event === 'messages.upsert' ||
      body.event === 'message' ||
      body.source === 'n8n' ||
      (body.data?.message && body.data?.key && !body.data?.key?.fromMe) ||
      (body.message && body.remoteJid) ||
      (body.phone && body.message)

    if (isIncomingMessage) {
      console.log("Detected: Incoming WhatsApp message (UazAPI/n8n)")
      await handleIncomingMessage(token, body)
      return NextResponse.json({ success: true, type: 'message' }, { headers: corsHeaders })
    }

    // =============================================
    // CASE B: Lead Extraction Webhook (original)
    // =============================================
    const leadsToInsert: any[] = []
    const items = Array.isArray(body) ? body : (body.items || [body])

    for (const item of items) {
      let normalizedLead: any = null

      if (item.nome_empresa || item.address || item.category) {
        normalizedLead = {
          full_name: item.nome_empresa || "Sem nome",
          whatsapp: item.telefone || item.phone || null,
          company_name: item.nome_empresa || null,
          origin: "Google Maps"
        }
      } else if (item.razao_social || item.cnpj) {
        normalizedLead = {
          full_name: item.razao_social || item.nome_fantasia || "Sem Razão Social",
          whatsapp: item.telefone || item.celular || null,
          company_name: item.nome_fantasia || item.razao_social || null,
          origin: "Extração CNPJ"
        }
      } else if (item.username || item.full_name || item.biography) {
        normalizedLead = {
          full_name: item.full_name || item.username || "Sem nome",
          whatsapp: item.phone || item.contato || item.whatsapp || null,
          company_name: item.category_name || item.biography || null,
          origin: "Instagram"
        }
      } else {
        normalizedLead = {
          full_name: item.name || item.nome || "Lead Desconhecido",
          whatsapp: item.phone || item.telefone || item.whatsapp || null,
          company_name: item.company || item.empresa || null,
          origin: "Outros"
        }
      }

      if (normalizedLead.whatsapp) {
        normalizedLead.whatsapp = formatBrazilianPhone(normalizedLead.whatsapp)
      }

      if (normalizedLead) {
        leadsToInsert.push({
          full_name: normalizedLead.full_name,
          whatsapp: normalizedLead.whatsapp,
          company_name: normalizedLead.company_name,
          origin: normalizedLead.origin,
        })
      }
    }

    if (leadsToInsert.length === 0) {
      console.warn("No leads found in payload")
      return NextResponse.json({ message: 'No valid leads found in body' }, { status: 400, headers: corsHeaders })
    }

    const rpcPayload = leadsToInsert.map(l => ({
      full_name: l.full_name,
      whatsapp: l.whatsapp,
      company_name: l.company_name,
      origin: l.origin
    }))

    const { data: rpcData, error: rpcError } = await supabase.rpc('process_webhook_leads', {
      p_token: token,
      p_leads: rpcPayload
    })

    if (rpcError) {
      console.error('RPC Error:', rpcError)
      return NextResponse.json({ error: 'Database Error' }, { status: 500, headers: corsHeaders })
    }

    if (rpcData && !rpcData.success) {
      console.error('RPC logic failed:', rpcData.error)
      return NextResponse.json({ error: rpcData.error }, { status: 403, headers: corsHeaders })
    }

    console.log(`Success! Inserted ${rpcData?.count || 0} leads via RPC.`)
    return NextResponse.json({ success: true, count: rpcData?.count }, { headers: corsHeaders })

  } catch (err: any) {
    console.error('Fatal Webhook Error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: corsHeaders })
  }
}

// =============================================
// Handle incoming WhatsApp messages
// =============================================

/**
 * Returns true if the name is generic/invalid (should be healed).
 * A "good" name is non-empty, not just digits, not the phone number itself,
 * and not a known placeholder string from UazAPI/n8n.
 */
function isGenericName(name: string, phone?: string): boolean {
  if (!name || name.trim().length === 0) return true
  const n = name.trim().toLowerCase()
  if (phone && n === phone.toLowerCase()) return true
  if (/^\d+$/.test(n)) return true
  if (n.includes('lead whatsapp')) return true
  if (n.includes('lead externo')) return true
  if (n === 'sem nome') return true
  return false
}

async function handleIncomingMessage(token: string, body: any) {
  try {
    // 1. Find user by webhook_token
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('webhook_token', token)
      .single()

    if (profileError || !profile) {
      console.error("Invalid token for incoming message:", token)
      return
    }

    const userId = profile.id

    // 2. Extract message data from different UazAPI event formats
    let senderPhone = ''
    let senderName = ''
    let messageContent = ''
    let messageId = ''
    let fromMe = false

    // Format 1: UazAPI standard event
    if (body.data?.key) {
      const key = body.data.key
      fromMe = key.fromMe === true || String(key.fromMe) === 'true'
      senderPhone = formatBrazilianPhone((key.remoteJid || '').replace('@s.whatsapp.net', ''))
      messageId = key.id || ''

      const msg = body.data.message
      messageContent =
        msg?.conversation ||
        msg?.extendedTextMessage?.text ||
        msg?.imageMessage?.caption ||
        msg?.documentMessage?.caption ||
        '[Mídia]'

      senderName = body.data?.pushName || body.data?.notifyName || senderPhone
    }
    // Format 2: simpler structure
    else if (body.remoteJid) {
      fromMe = body.fromMe === true || String(body.fromMe) === 'true'
      senderPhone = formatBrazilianPhone(body.remoteJid.replace('@s.whatsapp.net', ''))
      senderName = body.pushName || senderPhone
      messageContent = body.message?.conversation || body.text || '[Mensagem]'
      messageId = body.id || ''
    }
    // Format 3: n8n Custom Subflow Webhook
    else if (body.source === 'n8n' || body.phone) {
      fromMe = body.fromMe === true || String(body.fromMe) === 'true' || body.direction === 'outbound'
      senderPhone = formatBrazilianPhone(body.phone || body.contact_phone || '')
      senderName = body.name || body.contact_name || senderPhone
      messageContent = body.message || body.text || body.content || '[Mensagem]'
      messageId = body.messageId || body.id || `n8n_${Date.now()}`
    }

    if (!senderPhone || (!messageContent && !body.data?.message)) {
      console.log("Skipping: missing data")
      return
    }

    // ── Name healing logic ──────────────────────────────────────────────────
    // incoming name is "good" (real, non-generic)?
    const incomingNameIsGood = !isGenericName(senderName, senderPhone)

    // Check existing conversation to decide which name to persist
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id, contact_name')
      .eq('user_id', userId)
      .eq('contact_phone', senderPhone)
      .maybeSingle()

    const existingNameIsGood = existingConv ? !isGenericName(existingConv.contact_name, senderPhone) : false

    // Decision:
    //   incoming good  → always use it (heals bad stored names)
    //   incoming bad + stored good → keep stored (protect against regression)
    //   incoming bad + stored bad  → keep incoming (can't do better)
    const contactNameToUse = incomingNameIsGood
      ? senderName
      : existingNameIsGood
        ? existingConv!.contact_name
        : senderName

    console.log(`Name resolution: incoming="${senderName}" (good=${incomingNameIsGood}), stored="${existingConv?.contact_name}" (good=${existingNameIsGood}) → using "${contactNameToUse}"`)
    // ────────────────────────────────────────────────────────────────────────

    // 3. Upsert conversation (Inbox)
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .upsert(
        {
          user_id: userId,
          contact_phone: senderPhone,
          contact_name: contactNameToUse,
          last_message: messageContent,
          last_message_at: new Date().toISOString(),
          unread_count: 1,
          is_open: true,
        },
        {
          onConflict: 'user_id,contact_phone',
          ignoreDuplicates: false,
        }
      )
      .select()
      .single()

    if (convError || !conversation) {
      console.error("Error upserting conversation:", convError)
      return
    }

    // Increment unread_count
    await supabase.rpc('increment_unread', { conv_id: conversation.id })

    // =============================================
    // 4. CRM Integration: Link lead ↔ conversation
    // =============================================

    // Normalize phone for comparison (digits only, strip country code if 13 digits starting with 55)
    const normalizedPhone = senderPhone.length === 13 && senderPhone.startsWith('55')
      ? senderPhone.slice(2)  // remove country code for BR numbers
      : senderPhone

    // Lookup existing lead by whatsapp number (try with and without country code)
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id, whatsapp, conversation_id, full_name')
      .eq('user_id', userId)
      .or(`whatsapp.eq.${senderPhone},whatsapp.eq.${normalizedPhone}`)
      .maybeSingle()

    let leadId: string | null = null

    if (existingLead) {
      // Lead already exists → update last_message, timestamp, and heal name if needed
      leadId = existingLead.id

      const leadUpdate: Record<string, any> = {
        last_message: messageContent,
        last_message_at: new Date().toISOString(),
        conversation_id: conversation.id,
        updated_at: new Date().toISOString(),
      }

      // Heal the lead's name: only overwrite if stored name is generic AND incoming is real
      if (incomingNameIsGood && isGenericName(existingLead.full_name, senderPhone)) {
        leadUpdate.full_name = senderName
        console.log(`CRM: Healing lead ${leadId} name: "${existingLead.full_name}" → "${senderName}"`)
      }

      await supabase
        .from('leads')
        .update(leadUpdate)
        .eq('id', leadId)

      console.log(`CRM: Updated existing lead ${leadId} with last_message`)

    } else {
      // New contact → create lead in "Novos Leads" (position = 0)
      const { data: firstColumn } = await supabase
        .from('kanban_columns')
        .select('id')
        .eq('user_id', userId)
        .eq('position', 0)
        .single()

      if (firstColumn) {
        const { data: newLead, error: leadError } = await supabase
          .from('leads')
          .insert({
            user_id: userId,
            column_id: firstColumn.id,
            full_name: contactNameToUse,
            whatsapp: normalizedPhone,
            origin: 'WhatsApp',
            message_sent: false,
            last_message: messageContent,
            last_message_at: new Date().toISOString(),
            conversation_id: conversation.id,
          })
          .select('id')
          .single()

        if (!leadError && newLead) {
          leadId = newLead.id
          console.log(`CRM: Created new lead ${leadId} for ${senderPhone} in "Novos Leads"`)
        } else {
          console.error("CRM: Failed to create lead:", leadError)
        }
      } else {
        console.warn("CRM: No column with position=0 found for user", userId)
      }
    }

    // 5. Link lead_id back into conversation (if not already set)
    if (leadId && conversation.lead_id !== leadId) {
      await supabase
        .from('conversations')
        .update({ lead_id: leadId })
        .eq('id', conversation.id)
    }

    // 6. Check for duplicate before saving (Deduplication)
    if (messageId) {
      const { data: existingMsg } = await supabase
        .from('messages')
        .select('id')
        .eq('whatsapp_message_id', messageId)
        .eq('user_id', userId)
        .maybeSingle()

      if (existingMsg) {
        console.log(`Deduplication: Message ${messageId} already exists in DB. Skipping.`)
        return
      }
    }

    // 7. Save message with lead_id linked
    await supabase.from('messages').insert({
      conversation_id: conversation.id,
      user_id: userId,
      content: messageContent,
      from_me: fromMe,
      whatsapp_message_id: messageId,
      status: fromMe ? 'sent' : 'received',
      lead_id: leadId,
    })

    console.log(`Message from ${senderPhone} saved → conversation ${conversation.id} → lead ${leadId}`)

  } catch (err) {
    console.error("Error handling incoming message:", err)
  }
}

