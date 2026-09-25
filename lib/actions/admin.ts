"use server"

import { createAdminClient } from "@/lib/supabase-admin"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase-server"
import { createAsaasCustomer, createAsaasSubscription, updateAsaasSubscription, createAsaasPayment, getAsaasSubscription } from "@/lib/asaas"

export async function verifyAdmin() {
    const supabaseUser = await createClient()
    const { data: { user } } = await supabaseUser.auth.getUser()
    
    if (!user) throw new Error("Não autenticado")

    const { data: profile } = await supabaseUser
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single()

    if (!profile?.is_admin) {
        throw new Error("Ação não autorizada. Apenas administradores podem realizar esta operação.")
    }
}

export async function getAdminProfiles() {
    try {
        await verifyAdmin()
        const supabaseAdmin = await createAdminClient()

        // 1. Fetch all profiles explicitly without secret fields like invoice_pin
        const { data: profilesData, error: profilesError } = await supabaseAdmin
            .from("profiles")
            .select("id, full_name, email, subscription_status, server_id, is_admin, updated_at, cpf_cnpj")

        if (profilesError) {
            console.error(`Error fetching profiles: [${profilesError.code}] ${profilesError.message}`)
            return { success: false, error: profilesError.message }
        }

        // 2. Fetch all whatsapp_connections
        const { data: waData, error: waError } = await supabaseAdmin
            .from("whatsapp_connections")
            .select("user_id, status")

        if (waError) {
            console.error(`Error fetching whatsapp connections: [${waError.code}] ${waError.message}`)
            // We don't fail the whole request, just log it.
        }

        // 3. Map status to profiles (profiles.id == whatsapp_connections.user_id)
        const processedData = profilesData.map(profile => {
            let waStatus = 'disconnected'
            if (waData) {
                const conn = waData.find(w => w.user_id === profile.id)
                if (conn && conn.status) {
                    waStatus = conn.status
                }
            }
            return {
                ...profile,
                whatsapp_status: waStatus
            }
        })

        return { success: true, data: processedData }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function updateSubscriptionStatus(userId: string, status: string) {
    try {
        await verifyAdmin()
        const supabaseAdmin = await createAdminClient()

        const { error } = await supabaseAdmin
            .from("profiles")
            .update({ subscription_status: status })
            .eq("id", userId)

        if (error) {
            console.error("Error updating subscription status:", error)
            return { success: false, error: error.message }
        }

        revalidatePath("/admin")
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function toggleAdminRole(userId: string, isAdmin: boolean) {
    try {
        await verifyAdmin()
        const supabaseAdmin = await createAdminClient()

        const { error } = await supabaseAdmin
            .from("profiles")
            .update({ is_admin: isAdmin })
            .eq("id", userId)

        if (error) {
            console.error("Error toggling admin role:", error)
            return { success: false, error: error.message }
        }

        revalidatePath("/admin")
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function updateProfileData(
    userId: string, 
    email: string, 
    cpfCnpj: string,
    basePlanName?: string,
    basePlanPrice?: number,
    billingCycle?: string,
    nextDueDate?: string,
    billingType: string = 'PIX'
) {
    try {
        await verifyAdmin()
        const supabaseAdmin = await createAdminClient()

        // Busca perfil atual para ver se já tem asaas_customer_id
        const { data: currentProfile } = await supabaseAdmin.from("profiles").select("*").eq("id", userId).single()
        
        let asaasCustomerId = currentProfile?.asaas_customer_id
        let asaasSubscriptionId = currentProfile?.asaas_subscription_id

        // Integração Asaas (Se tem preço e ciclo definidos, podemos atualizar ou criar assinatura)
        if (basePlanPrice && basePlanPrice > 0 && billingCycle && nextDueDate && cpfCnpj) {
            if (!asaasCustomerId) {
                const customerData = await createAsaasCustomer({
                    name: currentProfile?.full_name || "Cliente sem Nome",
                    email: email,
                    cpfCnpj: cpfCnpj
                })
                asaasCustomerId = customerData.id
            }

            const subscriptionPayload = {
                customer: asaasCustomerId as string,
                billingType: billingType as any,
                value: basePlanPrice,
                nextDueDate: nextDueDate,
                cycle: billingCycle as any,
                description: basePlanName || "Plano Mensal"
            }

            try {
                if (asaasSubscriptionId) {
                    let shouldCreateNew = false;
                    try {
                        const existingSub = await getAsaasSubscription(asaasSubscriptionId);
                        if (existingSub && existingSub.status !== 'DELETED' && existingSub.status !== 'INACTIVE') {
                            await updateAsaasSubscription(asaasSubscriptionId, subscriptionPayload);
                        } else {
                            shouldCreateNew = true;
                        }
                    } catch (e: any) {
                        shouldCreateNew = true;
                    }
                    
                    if (shouldCreateNew) {
                        const subData = await createAsaasSubscription(subscriptionPayload);
                        asaasSubscriptionId = subData.id;
                    }
                } else {
                    const subData = await createAsaasSubscription(subscriptionPayload);
                    asaasSubscriptionId = subData.id;
                }
            } catch (err: any) {
                // Se o cliente foi removido no Asaas, recriamos ele e tentamos de novo
                if (err.message.includes('cliente removido') || err.message.includes('invalid_customer')) {
                    const newCustomerData = await createAsaasCustomer({
                        name: currentProfile?.full_name || "Cliente sem Nome",
                        email: email,
                        cpfCnpj: cpfCnpj
                    });
                    asaasCustomerId = newCustomerData.id;
                    subscriptionPayload.customer = asaasCustomerId;
                    const subData = await createAsaasSubscription(subscriptionPayload);
                    asaasSubscriptionId = subData.id;
                } else {
                    throw err;
                }
            }
        }

        const { error: profileError } = await supabaseAdmin
            .from("profiles")
            .update({ 
                email: email, 
                cpf_cnpj: cpfCnpj,
                asaas_customer_id: asaasCustomerId || null,
                asaas_subscription_id: asaasSubscriptionId || null,
                next_due_date: nextDueDate || null
            })
            .eq("id", userId)

        if (profileError) {
            console.error("Error updating profile data:", profileError)
            return { success: false, error: profileError.message }
        }

        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            email: email,
            email_confirm: true 
        })

        if (authError) {
            console.error("Error updating auth user email:", authError)
        }

        revalidatePath("/admin")
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function deleteAdminUser(userId: string) {
    try {
        await verifyAdmin()
        const supabaseAdmin = await createAdminClient()
        
        // 0. Limpeza do Asaas (Assinatura, Faturas Pendentes, Cliente)
        const { data: profile } = await supabaseAdmin.from("profiles").select("asaas_customer_id, asaas_subscription_id").eq("id", userId).single();
        if (profile) {
            const { asaas_customer_id, asaas_subscription_id } = profile;
            
            if (asaas_subscription_id) {
                try {
                    const { deleteAsaasSubscription } = await import("@/lib/asaas");
                    await deleteAsaasSubscription(asaas_subscription_id);
                } catch (e) {
                    console.error("Falha ao deletar assinatura Asaas:", e);
                }
            }

            if (asaas_customer_id) {
                try {
                    const { listAsaasPayments, deleteAsaasPayment, deleteAsaasCustomer } = await import("@/lib/asaas");
                    
                    // Exclui todas as faturas pendentes ou vencidas para não gerar mais cobrança
                    const paymentsList = await listAsaasPayments(asaas_customer_id);
                    if (paymentsList && paymentsList.data) {
                        for (const payment of paymentsList.data) {
                            if (payment.status === 'PENDING' || payment.status === 'OVERDUE') {
                                try {
                                    await deleteAsaasPayment(payment.id);
                                } catch (e) {
                                    console.error("Falha ao deletar fatura pendente Asaas:", payment.id, e);
                                }
                            }
                        }
                    }
                    
                    // Exclui o cliente do Asaas
                    try {
                        await deleteAsaasCustomer(asaas_customer_id);
                    } catch(e) {
                        console.error("Falha ao deletar cliente Asaas:", e);
                    }
                } catch (e) {
                    console.error("Falha ao processar exclusão de dados do Asaas:", e);
                }
            }
        }

        // 1. Limpeza do WhatsApp (Deleta a instância na API se existir)
        const { data: existingConn } = await supabaseAdmin
            .from("whatsapp_connections")
            .select("instance_name")
            .eq("user_id", userId)
            .single()

        if (existingConn?.instance_name) {
            const { deleteWhatsappInstance } = await import("@/lib/actions/whatsapp")
            await deleteWhatsappInstance(existingConn.instance_name)
        }

        // 2. Limpeza forçada de tabelas dependentes (Evita erro de Foreign Key constraint caso falte ON DELETE CASCADE no banco)
        await supabaseAdmin.from("whatsapp_connections").delete().eq("user_id", userId)
        await supabaseAdmin.from("profiles").delete().eq("id", userId)

        // 3. Deleta o usuário da tabela de autenticação
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
        
        if (error) {
            console.error("Error deleting user:", error)
            return { success: false, error: error.message }
        }

        revalidatePath("/admin")
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function createAdminUser(data: { 
    email: string, 
    password?: string, 
    fullName: string, 
    whatsapp?: string, 
    cpf?: string,
    planName?: string,
    planPrice?: number,
    billingType?: string,
    billingCycle?: string,
    nextDueDate?: string
}) {
    try {
        await verifyAdmin()
        const supabaseAdmin = await createAdminClient()
        
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: data.email,
            password: data.password || "Temporaria123!",
            email_confirm: true,
            user_metadata: {
                full_name: data.fullName,
                whatsapp: data.whatsapp || "",
                subscription_status: "active"
            }
        })
        
        if (authError || !authData.user) {
            console.error("Error creating auth user:", authError)
            return { success: false, error: authError?.message || "Erro desconhecido" }
        }
        
        // Wait briefly for Supabase trigger to create the profile row
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Create Asaas customer and subscription if billing data is provided
        if (data.cpf && data.planPrice && data.billingCycle && data.nextDueDate) {
            await updateProfileData(
                authData.user.id,
                data.email,
                data.cpf,
                data.planName,
                data.planPrice,
                data.billingCycle,
                data.nextDueDate,
                data.billingType || 'UNDEFINED'
            )
        }

        revalidatePath("/admin")
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function getAdminWhatsappConnection(userId: string) {
    try {
        await verifyAdmin()
        const supabaseAdmin = await createAdminClient()

        const { data, error } = await supabaseAdmin
            .from("whatsapp_connections")
            .select("instance_name, instance_key, status")
            .eq("user_id", userId)
            .single()

        if (error) {
            console.error("Error fetching whatsapp connection:", error)
            return { success: false, error: error.message }
        }

        return { success: true, data }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function adminCreateWhatsappInstanceForUser(userId: string) {
    try {
        await verifyAdmin()
        const supabaseAdmin = await createAdminClient()

        // 1. ZOMBIE CLEANUP
        const { data: existingConn } = await supabaseAdmin
            .from("whatsapp_connections")
            .select("instance_name, instance_key")
            .eq("user_id", userId)
            .single()

        if (existingConn?.instance_name) {
            const { deleteWhatsappInstance } = await import("@/lib/actions/whatsapp")
            await deleteWhatsappInstance(existingConn.instance_name)
            await supabaseAdmin.from("whatsapp_connections").delete().eq("user_id", userId)
        }

        // 2. WEBHOOK TOKEN
        const { data: profile } = await supabaseAdmin.from("profiles").select("webhook_token").eq("id", userId).single()
        let currentWebhookToken = profile?.webhook_token
        if (!currentWebhookToken) {
            currentWebhookToken = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0
                const v = c === 'x' ? r : (r & 0x3 | 0x8)
                return v.toString(16)
            })
            await supabaseAdmin.from('profiles').update({ webhook_token: currentWebhookToken }).eq('id', userId)
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const webhookUrl = `${appUrl}/api/webhook/${currentWebhookToken}`

        // 3. CREATE INSTANCE
        const shortId = userId.slice(0, 3).toUpperCase()
        const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase()
        const newInstanceName = `LEG-${shortId}-${randomSuffix}`

        const payload = {
            name: newInstanceName,
            systemName: "apilocal",
            fingerprintProfile: "chrome",
            browser: "chrome",
            webhook: webhookUrl,
            webhookEvents: ["messages.upsert", "messages.update", "message", "MESSAGES_UPSERT"],
            webhookByEvents: false,
        }

        const { initWhatsappInstance } = await import("@/lib/actions/whatsapp")
        const res = await initWhatsappInstance(payload)
        const data = res.data

        let token = ""
        if (res.ok && data.token) token = data.token
        else if (data.hash && data.hash.token) token = data.hash.token
        else token = data.token || "ERRO"

        if (res.ok && token !== "ERRO") {
            const { error: dbError } = await supabaseAdmin.from("whatsapp_connections").upsert({
                user_id: userId,
                instance_name: newInstanceName,
                instance_key: token,
                status: "connecting",
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' })

            if (dbError) throw dbError

            return { success: true, instance_name: newInstanceName, instance_key: token }
        } else {
            return { success: false, error: data.message || "Erro desconhecido na UazAPI" }
        }

    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function createAsaasInvoice(userId: string, description: string, amount: number, dueDate: string, billingType: string = 'PIX') {
    try {
        await verifyAdmin()
        const supabaseAdmin = await createAdminClient()

        const { data: profile } = await supabaseAdmin.from("profiles").select("*").eq("id", userId).single()
        if (!profile) return { success: false, error: "Usuário não encontrado." }

        let asaasCustomerId = profile.asaas_customer_id

        if (!asaasCustomerId) {
            if (!profile.cpf_cnpj) return { success: false, error: "CPF/CNPJ obrigatório." }
            const customerData = await createAsaasCustomer({
                name: profile.full_name || "Cliente sem Nome",
                email: profile.email,
                cpfCnpj: profile.cpf_cnpj
            })
            asaasCustomerId = customerData.id
            await supabaseAdmin.from("profiles").update({ asaas_customer_id: asaasCustomerId }).eq("id", userId)
        }

        try {
            await createAsaasPayment({
                customer: asaasCustomerId,
                billingType: billingType as any,
                value: amount,
                dueDate: dueDate,
                description: description
            })
        } catch (err: any) {
            if (err.message.includes('cliente removido') || err.message.includes('invalid_customer')) {
                if (!profile.cpf_cnpj) return { success: false, error: "CPF/CNPJ obrigatório para recriar cliente." }
                const newCustomerData = await createAsaasCustomer({
                    name: profile.full_name || "Cliente sem Nome",
                    email: profile.email,
                    cpfCnpj: profile.cpf_cnpj
                })
                asaasCustomerId = newCustomerData.id
                await supabaseAdmin.from("profiles").update({ asaas_customer_id: asaasCustomerId }).eq("id", userId)
                
                await createAsaasPayment({
                    customer: asaasCustomerId,
                    billingType: billingType as any,
                    value: amount,
                    dueDate: dueDate,
                    description: description
                })
            } else {
                throw err;
            }
        }

        return { success: true }
    } catch (error: any) {
        console.error("Erro ao gerar avulso Asaas:", error)
        return { success: false, error: error.message }
    }
}

export async function fetchUserSubscription(userId: string) {
    try {
        await verifyAdmin()
        const supabaseAdmin = await createAdminClient()
        
        const { data: profile } = await supabaseAdmin.from("profiles").select("asaas_subscription_id").eq("id", userId).single()
        
        if (profile?.asaas_subscription_id) {
            const { getAsaasSubscription } = await import("@/lib/asaas")
            const sub = await getAsaasSubscription(profile.asaas_subscription_id)
            if (sub) {
                return { 
                    success: true, 
                    data: {
                        planName: sub.description,
                        planPrice: sub.value,
                        billingCycle: sub.cycle,
                        nextDueDate: sub.nextDueDate,
                        billingType: sub.billingType
                    }
                }
            }
        }
        return { success: true, data: null }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function postponeInvoice(userId: string, daysToAdd: number) {
    try {
        await verifyAdmin()
        const supabaseAdmin = await createAdminClient()
        
        // 1. Get user profile
        const { data: profile } = await supabaseAdmin.from("profiles").select("asaas_customer_id, subscription_status").eq("id", userId).single()
        if (!profile?.asaas_customer_id) {
            return { success: false, error: "Usuário não possui conta no Asaas." }
        }

        // 2. Fetch payments from Asaas
        const { listAsaasPayments, updateAsaasPayment } = await import("@/lib/asaas")
        const payments = await listAsaasPayments(profile.asaas_customer_id)
        
        if (!payments || !payments.data) {
            return { success: false, error: "Nenhuma fatura encontrada." }
        }

        // 3. Find earliest PENDING or OVERDUE invoice
        const activeInvoices = payments.data.filter((p: any) => p.status === 'PENDING' || p.status === 'OVERDUE')
        if (activeInvoices.length === 0) {
            return { success: false, error: "Nenhuma fatura pendente ou vencida encontrada." }
        }

        activeInvoices.sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
        const targetInvoice = activeInvoices[0]

        // 4. Calculate new date
        const [year, month, day] = targetInvoice.dueDate.split('-')
        const newDate = new Date(Number(year), Number(month) - 1, Number(day))
        newDate.setDate(newDate.getDate() + daysToAdd)
        
        const newDateStr = newDate.toISOString().split('T')[0]

        // 5. Update invoice in Asaas
        await updateAsaasPayment(targetInvoice.id, { dueDate: newDateStr })

        // 6. Atualiza o banco local com a nova data (e desbloqueia se estava vencida)
        await supabaseAdmin.from("profiles").update({ 
            subscription_status: profile.subscription_status === 'vencida' ? 'active' : profile.subscription_status,
            next_due_date: newDateStr
        }).eq("id", userId)

        revalidatePath("/admin")
        return { success: true }
    } catch (error: any) {
        console.error("Erro ao adiar fatura:", error)
        return { success: false, error: error.message }
    }
}

export async function fetchInvoiceDueDate(customerId: string) {
    try {
        await verifyAdmin()
        const { listAsaasPayments } = await import("@/lib/asaas")
        const payments = await listAsaasPayments(customerId)
        if (!payments || !payments.data) return null
        
        const activeInvoices = payments.data.filter((p: any) => p.status === 'PENDING' || p.status === 'OVERDUE')
        if (activeInvoices.length === 0) return null

        activeInvoices.sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
        return activeInvoices[0].dueDate
    } catch (err) {
        return null
    }
}

export async function linkAsaasAccount(userId: string) {
    try {
        await verifyAdmin()
        const supabaseAdmin = await createAdminClient()
        
        const { data: profile } = await supabaseAdmin.from('profiles').select('email, cpf_cnpj').eq('id', userId).single()
        if (!profile) return { success: false, error: 'Usuário não encontrado.' }

        const { ASAAS_API_URL, ASAAS_API_KEY } = await import('@/lib/asaas')
        const headers = { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' }

        // Try searching by email first
        let customer = null
        if (profile.email) {
            const emailRes = await fetch(`${ASAAS_API_URL}/customers?email=${encodeURIComponent(profile.email)}`, { headers })
            const emailData = await emailRes.json()
            if (emailData.data && emailData.data.length > 0) {
                customer = emailData.data[0]
            }
        }

        // Try by CPF/CNPJ if not found by email
        if (!customer && profile.cpf_cnpj) {
            const cpfClean = profile.cpf_cnpj.replace(/[^0-9]/g, '')
            const cpfRes = await fetch(`${ASAAS_API_URL}/customers?cpfCnpj=${cpfClean}`, { headers })
            const cpfData = await cpfRes.json()
            if (cpfData.data && cpfData.data.length > 0) {
                customer = cpfData.data[0]
            }
        }

        if (!customer) {
            return { success: false, error: 'Nenhum cliente encontrado no Asaas com o email ou CPF deste usuário.' }
        }

        // Find active subscription
        let subscriptionId = null
        const subRes = await fetch(`${ASAAS_API_URL}/subscriptions?customer=${customer.id}`, { headers })
        const subData = await subRes.json()
        
        if (subData.data && subData.data.length > 0) {
            // Get the first active subscription if any
            const activeSub = subData.data.find((s: any) => s.status === 'ACTIVE')
            subscriptionId = activeSub ? activeSub.id : subData.data[0].id
        }

        // Save to Supabase
        await supabaseAdmin.from('profiles').update({
            asaas_customer_id: customer.id,
            asaas_subscription_id: subscriptionId || null
        }).eq('id', userId)

        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}
