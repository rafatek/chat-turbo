"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CreditCard, Loader2, Save, User, Smartphone, Mail, ShieldCheck, Zap, CheckCircle2, FileText } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

export default function ContaPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<{
    full_name: string
    whatsapp: string
    cpf_cnpj: string
    subscription_status: string
    asaas_customer_id: string
    [key: string]: any
  }>({
    full_name: "",
    whatsapp: "",
    cpf_cnpj: "",
    subscription_status: "active",
    asaas_customer_id: "",
  })

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const { data: { user }, error: userError } = await supabase.auth.getUser()

        if (userError) throw userError
        if (!user) return

        setUser(user)

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('full_name, whatsapp, cpf_cnpj, subscription_status, asaas_customer_id')
          .eq('id', user.id)
          .single()

        if (profileError && profileError.code !== 'PGRST116') {
          console.error("Error fetching profile:", profileError)
        }

        if (profile) {
          setProfile({
            full_name: profile.full_name || "",
            whatsapp: profile.whatsapp || "",
            cpf_cnpj: profile.cpf_cnpj || "",
            subscription_status: profile.subscription_status || "active",
            asaas_customer_id: profile.asaas_customer_id || "",
          })
        }
      } catch (error) {
        console.error("Error loading data:", error)
        toast({
          variant: "destructive",
          title: "Erro ao carregar",
          description: "Não foi possível carregar suas informações.",
        })
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [toast])

  const handleSave = async () => {
    if (!user) return

    try {
      setSaving(true)

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profile.full_name,
          whatsapp: profile.whatsapp,
          cpf_cnpj: profile.cpf_cnpj || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error

      toast({
        title: "Sucesso!",
        description: (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <span className="text-green-500 font-medium">Dados atualizados com sucesso</span>
          </div>
        ),
        duration: 3000,
        className: "bg-black/90 border-green-500/50 shadow-[0_0_20px_rgba(34,197,94,0.2)] text-green-500",
      })
    } catch (error) {
      console.error("Error saving profile:", error)
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: "Tente novamente mais tarde.",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto p-1">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Minha Conta</h1>
          <p className="text-muted-foreground mt-1">Gerencie suas credenciais e assinatura</p>
        </div>
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
          <User className="h-5 w-5 text-primary" />
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Profile Settings */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-primary/10 bg-card/50 backdrop-blur-sm shadow-lg">
            <CardHeader className="border-b border-border/50 pb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <CardTitle>Informações Pessoais</CardTitle>
              </div>
              <CardDescription>Mantenha seus dados de contato atualizados</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid gap-6">
                <div className="space-y-2 group">
                  <Label htmlFor="name" className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Nome Completo</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      id="name"
                      value={profile.full_name}
                      onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                      placeholder="Seu nome completo"
                      className="pl-10 bg-background/50 border-primary/10 focus-visible:ring-primary/20 transition-all duration-300"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={user?.email || ""}
                      disabled
                      className="pl-10 bg-muted/50 border-primary/5 text-muted-foreground"
                    />
                  </div>
                </div>

                <div className="space-y-2 group">
                  <Label htmlFor="phone" className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">WhatsApp</Label>
                  <div className="relative">
                    <Smartphone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      id="phone"
                      value={profile.whatsapp}
                      onChange={(e) => setProfile({ ...profile, whatsapp: e.target.value })}
                      placeholder="+55 11 99999-9999"
                      className="pl-10 bg-background/50 border-primary/10 focus-visible:ring-primary/20 transition-all duration-300"
                    />
                  </div>
                </div>

                <div className="space-y-2 group">
                  <Label htmlFor="cpf" className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">CPF / CNPJ</Label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      id="cpf"
                      value={profile.cpf_cnpj}
                      onChange={(e) => setProfile({ ...profile, cpf_cnpj: e.target.value })}
                      placeholder="000.000.000-00"
                      className="pl-10 bg-background/50 border-primary/10 focus-visible:ring-primary/20 transition-all duration-300"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground min-w-[150px] transition-all duration-300 shadow-md hover:shadow-primary/20"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Salvar Alterações
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Plan Info */}
        <div className="space-y-6">
          <Card className="border-primary/20 bg-gradient-to-b from-card/50 to-primary/5 backdrop-blur-sm shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none" />

            <CardHeader className="pb-4 border-b border-primary/10">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary filled" />
                <CardTitle>Assinatura & Faturamento</CardTitle>
              </div>
              <CardDescription>Detalhes da sua conta integrada ao Asaas</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-background/40 border border-primary/5">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge className={
                    profile.subscription_status === 'active' 
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 px-3 py-1 text-sm font-medium"
                      : profile.subscription_status === 'vencida'
                      ? "bg-red-500/20 text-red-400 border-red-500/30 px-3 py-1 text-sm font-medium"
                      : "bg-amber-500/20 text-amber-400 border-amber-500/30 px-3 py-1 text-sm font-medium"
                  }>
                    {profile.subscription_status === 'active' ? 'Ativo' : profile.subscription_status === 'vencida' ? 'Fatura Vencida' : 'Inativo'}
                  </Badge>
                </div>

                {profile.asaas_customer_id && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-background/40 border border-primary/5">
                    <span className="text-sm text-muted-foreground">ID Cliente Asaas</span>
                    <span className="text-xs font-mono text-muted-foreground">{profile.asaas_customer_id}</span>
                  </div>
                )}

                <div className="p-4 rounded-lg bg-primary/10 border border-primary/10">
                  <p className="text-sm text-primary/90 leading-relaxed font-medium">
                    {profile.subscription_status === 'active'
                      ? "✨ Acesso liberado ao Chat Turbo IA com cobrança gerenciada via Asaas."
                      : "⚠️ Sua assinatura requer atenção. Verifique suas faturas pendentes."}
                  </p>
                </div>
              </div>

              <Link
                href="/faturas"
                className="w-full block"
              >
                <Button variant="outline" className="w-full border-primary/20 hover:bg-primary/10 hover:text-primary transition-all duration-300 group">
                  <FileText className="mr-2 h-4 w-4 group-hover:scale-110 transition-transform" />
                  Ver Faturas & Pagamentos
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
