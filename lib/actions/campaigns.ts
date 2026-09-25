"use server"

import { createClient } from "@/lib/supabase-server"
import { revalidatePath } from "next/cache"

interface CreateCampaignData {
    name: string
    folder_name: string
    schedule_days: string[]
    schedule_start_time: string
    schedule_end_time: string
    min_interval_seconds: number
    max_interval_seconds: number
    text_campanha?: string
    ia_generation?: boolean
    link_midia?: string
    tipo_midia?: string
    selected_lead_ids?: string[]
}

interface UpdateCampaignData extends CreateCampaignData {
    id: string
}

export async function createCampaign(data: CreateCampaignData) {
    console.log("🚀 [Server Action] createCampaign params:", JSON.stringify(data, null, 2))
    const supabase = await createClient()

    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            console.error("❌ [Server Action] Auth Error:", authError)
            throw new Error("Usuário não autenticado")
        }
        console.log("👤 [Server Action] User:", user.id)

        // 1. Get User Profile & Folder ID
        const { data: profile } = await supabase
            .from('profiles')
            .select('server_id')
            .eq('id', user.id)
            .single()

        const server_id = profile?.server_id || 'app'
        console.log("🆔 [Server Action] Server ID:", server_id)

        // Resolve Folder ID from Name (if provided, still useful for metadata)
        let folder_id = null
        if (data.folder_name && data.folder_name !== "Todas" && data.folder_name !== "Sem pasta") {
            const { data: folder, error: folderError } = await supabase
                .from('folders')
                .select('id')
                .eq('user_id', user.id)
                .eq('name', data.folder_name)
                .single()

            if (folderError) console.error("⚠️ [Server Action] Folder fetch error:", folderError)
            folder_id = folder?.id
            console.log("📂 [Server Action] Folder Resolved:", data.folder_name, "->", folder_id)
        }

        // 2. Map Data to Schema
        const dayMap: Record<string, number> = { "SEG": 1, "TER": 2, "QUA": 3, "QUI": 4, "SEX": 5, "SAB": 6, "DOM": 7 }
        const schedule_days_int = data.schedule_days.map(d => dayMap[d] || 0).filter(d => d !== 0)

        const min_int_min = data.min_interval_seconds
        const max_int_min = data.max_interval_seconds

        console.log("⚙️ [Server Action] Logic Mapped:", {
            schedule_days_int,
            min_int_min,
            max_int_min,
            folder_id
        })

        // 3. Create Campaign
        const campaignPayload = {
            user_id: user.id,
            name: data.name,
            folder_id: folder_id,
            schedule_days: schedule_days_int,
            start_time: data.schedule_start_time,
            end_time: data.schedule_end_time,
            min_interval_min: min_int_min,
            max_interval_min: max_int_min,
            text_campanha: data.text_campanha,
            ia_generation: data.ia_generation ?? false,
            link_midia: data.link_midia,
            tipo_midia: data.tipo_midia,
            server_id: server_id,
            status: 'paused'
        }

        console.log("💾 [Server Action] Inserting Campaign:", campaignPayload)

        const { data: campaign, error: campaignError } = await supabase
            .from('campaigns')
            .insert(campaignPayload)
            .select()
            .single()

        if (campaignError) {
            console.error("❌ [Server Action] DB Insert Error:", JSON.stringify(campaignError, null, 2))
            throw new Error(campaignError.message || "Erro ao criar campanha no banco")
        }
        console.log("✅ [Server Action] Campaign Created:", campaign.id)

        // 4. Populate Leads
        if (data.selected_lead_ids !== undefined) {
            console.log(`📥 [Server Action] Using Manual Selection: ${data.selected_lead_ids.length} leads`)

            if (data.selected_lead_ids.length > 0) {
                const campaignLeads = data.selected_lead_ids.map((leadId) => ({
                    campaign_id: campaign.id,
                    lead_id: leadId,
                    status: 'pending'
                }))

                const { error: insertError } = await supabase
                    .from('campaign_leads')
                    .insert(campaignLeads)

                if (insertError) {
                    console.error("❌ [Server Action] Manual Lead Populate Error:", insertError)
                } else {
                    console.log("✅ [Server Action] Manual Leads Populated Successfully")
                }
            }

            revalidatePath("/campanhas")
            return { success: true, count: data.selected_lead_ids.length }

        } else {
            console.log("📥 [Server Action] Using Folder Strategy (Fallback)")
            let leadsQuery = supabase
                .from('leads')
                .select('id')
                .eq('user_id', user.id)

            if (data.folder_name && data.folder_name !== "Todas") {
                if (data.folder_name === "Sem pasta") {
                    leadsQuery = leadsQuery.is('folder', null)
                } else {
                    leadsQuery = leadsQuery.eq('folder', data.folder_name)
                }
            }

            const { data: leads, error: leadsError } = await leadsQuery

            if (leadsError) console.error("Error fetching leads:", leadsError)

            if (leads && leads.length > 0) {
                console.log(`📥 [Server Action] Populating ${leads.length} leads from folder...`)
                const campaignLeads = leads.map((lead: { id: string }) => ({
                    campaign_id: campaign.id,
                    lead_id: lead.id,
                    status: 'pending'
                }))

                const { error: insertError } = await supabase
                    .from('campaign_leads')
                    .insert(campaignLeads)

                if (insertError) {
                    console.error("❌ [Server Action] Lead Populate Error:", insertError)
                } else {
                    console.log("✅ [Server Action] Leads Populated Successfully")
                }
                revalidatePath("/campanhas")
                return { success: true, count: leads.length }
            } else {
                console.log("⚠️ [Server Action] No leads found to populate.")
                revalidatePath("/campanhas")
                return { success: true, count: 0 }
            }
        }
    } catch (error: any) {
        console.error("🔥 [Server Action] Exception:", error)
        return { success: false, error: error.message || JSON.stringify(error) }
    }
}

export async function getLeadsForSelector(page: number = 1, pageSize: number = 20, folder: string = "Todas", labelId?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { leads: [], total: 0 }

    // Usar outer join caso labelId não exista, inner join caso precise ser exato
    let selectQuery = labelId ? '*, lead_labels!inner(label_id)' : '*'
    
    let query = supabase
        .from('leads')
        .select(`${selectQuery}`, { count: 'exact' })
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1)

    if (folder !== "Todas") {
        if (folder === "Sem pasta") {
            query = query.is('folder', null)
        } else {
            query = query.eq('folder', folder)
        }
    }

    if (labelId) {
        query = query.eq('lead_labels.label_id', labelId)
    }

    const { data: leads, count, error } = await query

    if (error) {
        console.error("Error fetching selector leads:", error)
        return { leads: [], total: 0 }
    }

    return { leads: leads || [], total: count || 0 }
}

export async function getAllLeadIdsForSelector(folder: string = "Todas", labelId?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    let selectQuery = labelId ? 'id, lead_labels!inner(label_id)' : 'id'
    
    let query = supabase
        .from('leads')
        .select(`${selectQuery}`)
        .eq('user_id', user.id)

    if (folder !== "Todas") {
        if (folder === "Sem pasta") {
            query = query.is('folder', null)
        } else {
            query = query.eq('folder', folder)
        }
    }

    if (labelId) {
        query = query.eq('lead_labels.label_id', labelId)
    }

    const { data, error } = await query

    if (error) {
        console.error("Error fetching all lead IDs for selector:", error)
        return []
    }

    return (data || []).map((l: any) => l.id)
}

export async function deleteCampaign(campaignId: string) {
    const supabase = await createClient()
    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("Usuário não autenticado")

        const { error } = await supabase
            .from('campaigns')
            .delete()
            .eq('id', campaignId)
            .eq('user_id', user.id)

        if (error) throw error

        revalidatePath("/campanhas")
        return { success: true }
    } catch (error: any) {
        console.error("Delete Error:", error)
        return { success: false, error: error.message }
    }
}

export async function toggleCampaignStatus(campaignId: string, newStatus: 'active' | 'paused') {
    const supabase = await createClient()
    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("Usuário não autenticado")

        const { error } = await supabase
            .from('campaigns')
            .update({ status: newStatus })
            .eq('id', campaignId)
            .eq('user_id', user.id)

        if (error) throw error

        revalidatePath("/campanhas")
        return { success: true }
    } catch (error: any) {
        console.error("Status Update Error:", error)
        return { success: false, error: error.message }
    }
}

export async function updateCampaign(data: UpdateCampaignData) {
    console.log("🚀 [Server Action] updateCampaign:", data.id)
    const supabase = await createClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("Usuário não autenticado")

        const { data: currentCampaign } = await supabase
            .from('campaigns')
            .select('folder_id')
            .eq('id', data.id)
            .single()

        if (!currentCampaign) throw new Error("Campanha não encontrada")

        let new_folder_id = null
        if (data.folder_name && data.folder_name !== "Todas") {
            const { data: folder } = await supabase
                .from('folders')
                .select('id')
                .eq('user_id', user.id)
                .eq('name', data.folder_name)
                .single()
            new_folder_id = folder?.id
        }

        const dayMap: Record<string, number> = { "SEG": 1, "TER": 2, "QUA": 3, "QUI": 4, "SEX": 5, "SAB": 6, "DOM": 7 }
        const schedule_days_int = data.schedule_days.map(d => dayMap[d] || 0).filter(d => d !== 0)

        const min_int = data.min_interval_seconds
        const max_int = data.max_interval_seconds

        const { error: updateError } = await supabase
            .from('campaigns')
            .update({
                name: data.name,
                folder_id: new_folder_id,
                schedule_days: schedule_days_int,
                start_time: data.schedule_start_time,
                end_time: data.schedule_end_time,
                min_interval_min: min_int,
                max_interval_min: max_int,
                text_campanha: data.text_campanha,
                ia_generation: data.ia_generation ?? false,
                link_midia: data.link_midia,
                tipo_midia: data.tipo_midia,
            })
            .eq('id', data.id)
            .eq('user_id', user.id)

        if (updateError) throw updateError

        // LEAD SYNC LOGIC
        // If selected_lead_ids IS provided (Sync Mode)
        if (data.selected_lead_ids !== undefined) {
            const newIds = new Set(data.selected_lead_ids)

            // Get existing
            const { data: existingRelations } = await supabase
                .from('campaign_leads')
                .select('lead_id, status')
                .eq('campaign_id', data.id)

            const existingMap = new Map() // lead_id -> status
            existingRelations?.forEach(r => existingMap.set(r.lead_id, r.status))

            // 1. Determine IDs to Insert (In newIds but not in existingMap)
            const toInsert = data.selected_lead_ids.filter(id => !existingMap.has(id))

            // 2. Determine IDs to Remove (In existingMap but not in newIds)
            // CRITICAL Constraint: Can only remove 'pending' status. 'sent', 'processing' etc are locked.
            const toRemove = []
            for (const [leadId, status] of existingMap.entries()) {
                if (!newIds.has(leadId)) {
                    if (status === 'pending' || status === 'error') { // Allow removing pending or error
                        toRemove.push(leadId)
                    } else {
                        // Locked. We don't remove, but we should probably warn?
                        // For now, we just silently keep them to ensure integrity.
                    }
                }
            }

            if (toRemove.length > 0) {
                await supabase
                    .from('campaign_leads')
                    .delete()
                    .eq('campaign_id', data.id)
                    .in('lead_id', toRemove)
            }

            if (toInsert.length > 0) {
                const newRecords = toInsert.map(leadId => ({
                    campaign_id: data.id,
                    lead_id: leadId,
                    status: 'pending'
                }))
                await supabase.from('campaign_leads').insert(newRecords)
            }

        } else if (new_folder_id !== currentCampaign.folder_id) {
            // Fallback: If no manual list provided AND folder changed, revert to "All from folder" behavior
            // This preserves old behavior if frontend doesn't send list
            console.log("🔄 [Update] Folder changed & no list. Repopulating queue...")

            const { error: deleteError } = await supabase
                .from('campaign_leads')
                .delete()
                .eq('campaign_id', data.id)
                .eq('status', 'pending')

            if (deleteError) console.error("Error clearing old queue:", deleteError)

            let leadsQuery = supabase
                .from('leads')
                .select('id')
                .eq('user_id', user.id)

            if (data.folder_name !== "Todas") {
                leadsQuery = leadsQuery.eq('folder', data.folder_name)
            }

            const { data: leads } = await leadsQuery

            if (leads && leads.length > 0) {
                const campaignLeads = leads.map((lead: { id: string }) => ({
                    campaign_id: data.id,
                    lead_id: lead.id,
                    status: 'pending'
                }))

                const { error: insertError } = await supabase
                    .from('campaign_leads')
                    .insert(campaignLeads)

                if (insertError) console.error("Error inserting new queue:", insertError)
            }
        }

        revalidatePath("/campanhas")
        return { success: true }
    } catch (error: any) {
        console.error("Update Error:", error)
        return { success: false, error: error.message }
    }
}

export async function getCampaignLeads(campaignId: string) {
    const supabase = await createClient()
    const { data } = await supabase
        .from('campaign_leads')
        .select('lead_id, status')
        .eq('campaign_id', campaignId)

    return data || []
}

export async function getCampaignsWithStats() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data: campaigns, error } = await supabase
        .from('campaigns')
        .select(`
            *,
            folders (name)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (error) {
        console.error("Fetch Error:", error)
        return []
    }

    const campaignsWithStats = await Promise.all(campaigns.map(async (c: any) => {
        const { count: total } = await supabase
            .from('campaign_leads')
            .select('id', { count: 'exact', head: true })
            .eq('campaign_id', c.id)

        const { count: sent } = await supabase
            .from('campaign_leads')
            .select('id', { count: 'exact', head: true })
            .eq('campaign_id', c.id)
            .eq('status', 'sent')

        const { count: failed } = await supabase
            .from('campaign_leads')
            .select('id', { count: 'exact', head: true })
            .eq('campaign_id', c.id)
            .eq('status', 'failed')

        return {
            ...c,
            folder_name: c.folders?.name || 'Todas',
            stats: {
                total: total || 0,
                sent: sent || 0,
                failed: failed || 0
            }
        }
    }))

    return campaignsWithStats
}
