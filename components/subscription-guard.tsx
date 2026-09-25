"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Lock, Zap, Loader2 } from "lucide-react"
import { toast } from "sonner"

// Rotas que são permitidas mesmo sem assinatura ativa
const ALLOWED_ROUTES = ["/conta", "/suporte", "/login", "/faturas"]

export function SubscriptionGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const pathname = usePathname()
    const [loading, setLoading] = useState(true)
    const [hasAccess, setHasAccess] = useState(false)
    const [checkoutUrl, setCheckoutUrl] = useState<string>("")

    useEffect(() => {
        async function checkSubscription() {
            try {
                const { data: { user } } = await supabase.auth.getUser()

                if (!user) {
                    router.replace("/login")
                    return
                }

                // Verifica status da assinatura e dados do perfil
                // CRITICAL: Table name MUST be 'profiles' and column 'subscription_status'
                // Retry logic for profile fetching to handle race conditions
                let profile: any = null
                let fetchError = null

                for (let i = 0; i < 3; i++) {
                    const { data, error } = await supabase
                        .from("profiles")
                        .select("subscription_status, full_name, server_id")
                        .eq("id", user.id)
                        .single()

                    if (!error && data) {
                        profile = data
                        fetchError = null
                        break
                    }

                    fetchError = error
                    // Wait 1s before retrying if not found/error
                    if (i < 2) await new Promise(resolve => setTimeout(resolve, 1000))
                }

                // EMERGENCY BYPASS (Lançamento 04/01)
                // Se for o suporte, ignora verificação do DB e define status como active
                const isSupport = user.email === 'turbodigital.suporte@gmail.com'
                if (isSupport) {
                    // Mock profile data only if missing, forcing active status logic below
                    if (!profile) profile = { full_name: 'Suporte', subscription_status: 'active' }
                }

                if ((fetchError || !profile) && !isSupport) {
                    // Log apenas ERRO REAL se não for suporte
                    console.error("ERRO REAL:", fetchError)
                    setHasAccess(false)
                } else {
                    // --- SERVER IDENTITY LOGIC ---
                    const currentServerId = process.env.NEXT_PUBLIC_SERVER_ID
                    const userServerId = profile?.server_id

                    if (!userServerId && currentServerId) {
                        // LGICA DE STAMP: Primeiro acesso, grava o servidor atual
                        console.log("Creating Server Identity Stamp:", currentServerId)
                        const { error: updateError } = await supabase
                            .from('profiles')
                            .update({ server_id: currentServerId })
                            .eq('id', user.id)

                        if (updateError) console.error("Error stamping server_id:", updateError)
                    } else if (userServerId && currentServerId && userServerId !== currentServerId) {
                        // LGICA DE REDIRECT (TRAVA): Servidor errado
                        const targetUrl = `https://${userServerId}.prospektia.com/dashboard`
                        const isLocal = window.location.hostname === 'localhost' || window.location.hostname.includes('192.168.')

                        if (isLocal) {
                            toast.warning(`Simulao de Redirecionamento: Voc seria enviado para ${userServerId}`, {
                                description: "Em produo voc seria redirecionado.",
                                duration: 8000
                            })
                        } else {
                            window.location.href = targetUrl
                            return // Stop execution
                        }
                    }
                    // -----------------------------
                    // ... (rest of logic)

                    const status = isSupport ? 'active' : profile?.subscription_status?.toLowerCase()
                    const isActive = status === 'active'
                    const isAllowedRoute = ALLOWED_ROUTES.some(route => pathname?.startsWith(route))

                    setHasAccess(isActive || isAllowedRoute)
                }
            } catch (error) {
                console.error("ERRO REAL:", error)
                setHasAccess(false)
            } finally {
                // Wait for the minimum delay to prevent flickering
                await new Promise(resolve => setTimeout(resolve, 800))
                setLoading(false)
            }
        }

        checkSubscription()
    }, [pathname, router])

    if (loading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!hasAccess) {
        return (
            <div className="flex h-full w-full flex-col items-center justify-center p-6 animate-in fade-in zoom-in duration-500">
                <div className="relative max-w-md w-full">
                    {/* Background Glow Effect */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl blur opacity-20 pointer-events-none" />

                    <Card className="relative border-red-500/20 shadow-2xl overflow-hidden backdrop-blur-sm bg-background/95">
                        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-500 to-orange-500" />

                        <CardHeader className="text-center pb-2">
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
                                <Lock className="h-8 w-8 text-red-500" />
                            </div>
                            <CardTitle className="text-2xl font-bold tracking-tight">Assinatura Necessária</CardTitle>
                            <CardDescription className="text-base mt-2">
                                Seu acesso às ferramentas está temporariamente bloqueado.
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-6 text-center">
                            <div className="rounded-lg bg-secondary/50 p-4 text-sm text-muted-foreground">
                                Para continuar utilizando nossos agentes de IA e ferramentas de extração, por favor, atualize ou renove sua assinatura.
                            </div>

                            <div className="grid gap-3">
                                <Button
                                    asChild
                                    size="lg"
                                    className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-medium shadow-lg hover:shadow-red-500/25 transition-all duration-300"
                                >
                                    <a href="/faturas">
                                        <Zap className="mr-2 h-4 w-4" />
                                        Atualizar Assinatura
                                    </a>
                                </Button>

                                <Button
                                    asChild
                                    variant="ghost"
                                    className="w-full text-muted-foreground hover:text-foreground"
                                >
                                    <a
                                        href={process.env.NEXT_PUBLIC_SUPORTE_URL || "#"}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        Falar com Suporte
                                    </a>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        )
    }

    return <>{children}</>
}
