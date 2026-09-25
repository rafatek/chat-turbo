"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Users, MessageSquare, Zap, Smartphone, CheckCircle2, XCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts"

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [loadingName, setLoadingName] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [fullName, setFullName] = useState<string | null>(null)

  const [metrics, setMetrics] = useState({
    totalLeads: 0,
    activeCampaigns: 0,
    totalMessagesSent: 0,
    connectionStatus: "disconnected",
    connectionInstance: ""
  })

  const [funnelData, setFunnelData] = useState<any[]>([])
  const [sourceData, setSourceData] = useState<any[]>([])

  const COLORS = ['#00A3FF', '#0066FF', '#00CCFF', '#0044BB', '#0082CC']

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.replace("/login")
          return
        }
        setUser(user)

        // EXIBE O NOME IMEDIATAMENTE do user_metadata (sem esperar o banco)
        if (user.user_metadata?.full_name) {
          setFullName(user.user_metadata.full_name)
          setLoadingName(false)
        }

        // BUSCA NO PERFIL em paralelo (atualiza se vier diferente)
        supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single()
          .then(({ data: profile }: { data: { full_name: string } | null }) => {
            if (profile?.full_name) {
              setFullName(profile.full_name)
            } else if (!user.user_metadata?.full_name) {
              setFullName("Usuário")
            }
            setLoadingName(false)
          })

        fetchDashboardData(user.id)
      } catch (error) {
        console.error("Error checking auth:", error)
        router.replace("/login")
      }
    }
    checkUser()
  }, [router])

  const fetchDashboardData = async (userId: string) => {
    try {
      setLoading(true)
      const { data: conn } = await supabase.from("whatsapp_connections").select("status, instance_name").eq("user_id", userId).single()
      const { count: activeCampaignsCount } = await supabase.from("campaigns").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("status", "active")
      const { data: userCampaigns } = await supabase.from("campaigns").select("id").eq("user_id", userId)

      let totalMessages = 0
      if (userCampaigns && userCampaigns.length > 0) {
        const campaignIds = userCampaigns.map((c: any) => c.id)
        const { count: msgCount } = await supabase.from("campaign_leads").select("*", { count: "exact", head: true }).in("campaign_id", campaignIds).eq("status", "sent")
        totalMessages = msgCount || 0
      }

      const { data: allLeads, count: totalLeadsCount } = await supabase.from("leads").select("id, origin, column_id", { count: 'exact' }).eq("user_id", userId)
      const { data: columns } = await supabase.from("kanban_columns").select("id, title, position").eq("user_id", userId).order("position")

      const sourcesMap: Record<string, number> = {}
      allLeads?.forEach((lead: any) => {
        const origin = lead.origin || "Outros"
        sourcesMap[origin] = (sourcesMap[origin] || 0) + 1
      })

      setMetrics({
        totalLeads: totalLeadsCount || 0,
        activeCampaigns: activeCampaignsCount || 0,
        totalMessagesSent: totalMessages,
        connectionStatus: conn?.status === "connected" ? "connected" : "disconnected",
        connectionInstance: conn?.instance_name || ""
      })

      setSourceData(Object.keys(sourcesMap).map(key => ({ name: key, value: sourcesMap[key] })).sort((a, b) => b.value - a.value))
      
      setFunnelData(columns?.map((col: any) => ({
        name: col.title,
        leads: allLeads?.filter((l: any) => l.column_id === col.id).length || 0
      })) || [])

    } catch (error) {
      console.error("Error fetching dashboard:", error)
    } finally {
      setLoading(false)
    }
  }

  const hora = new Date().getHours()
  const saudacao = hora >= 5 && hora < 12 ? "Bom dia" : hora >= 12 && hora < 18 ? "Boa tarde" : "Boa noite"

  return (
    <div className="space-y-6 pb-10 bg-background min-h-screen text-foreground">
      <div>
        <h1 className="text-3xl font-black tracking-tight uppercase italic flex items-center gap-2">
          Olá,&nbsp;
          {loadingName ? (
            <span className="inline-block h-8 w-28 bg-white/10 rounded animate-pulse align-middle" />
          ) : (
            <span>{fullName?.split(' ')[0]}</span>
          )}
          <span className="text-[#00A3FF]">!</span>&nbsp;{saudacao}<span className="text-[#00A3FF]">.</span>
        </h1>
        <p className="text-gray-600 uppercase text-[10px] font-bold tracking-[0.4em] mt-1">Legado Performance Digital • Dashboard</p>
      </div>

      {metrics.connectionStatus !== "connected" && !loading && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center justify-between backdrop-blur-md">
          <div className="flex items-center gap-3">
            <XCircle className="h-6 w-6 text-red-500" />
            <div>
              <h3 className="text-sm font-bold text-red-500 uppercase tracking-widest">WhatsApp Offline</h3>
              <p className="text-[10px] text-red-400/80 uppercase tracking-wider">Atenção: Os disparos automáticos estão pausados.</p>
            </div>
          </div>
          <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold uppercase tracking-widest" onClick={() => router.push("/conexoes")}>
            Reconectar
          </Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Total de Leads", value: metrics.totalLeads, icon: Users },
          { title: "Disparos Ativos", value: metrics.activeCampaigns, icon: Zap },
          { title: "Mensagens Enviadas", value: metrics.totalMessagesSent, icon: MessageSquare },
        ].map((item, i) => (
          <Card key={i} className="bg-card border-border backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[10px] uppercase tracking-[0.2em] font-black text-gray-600">{item.title}</CardTitle>
              <item.icon className="h-4 w-4 text-[#00A3FF]" />
            </CardHeader>
            <CardContent>
              {loading ? <div className="h-8 w-20 bg-accent rounded animate-pulse" /> : <div className="text-3xl font-black tracking-tight text-foreground">{item.value}</div>}
            </CardContent>
          </Card>
        ))}

        <Card className="bg-card border-border backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] uppercase tracking-[0.2em] font-black text-gray-600">Status Conexão</CardTitle>
            <Smartphone className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            {loading ? <div className="h-6 w-24 bg-accent rounded animate-pulse" /> : (
              <div className="space-y-1">
                <div className={`flex items-center gap-2 font-black uppercase text-xs tracking-widest ${metrics.connectionStatus === 'connected' ? 'text-green-500' : 'text-red-500'}`}>
                  {metrics.connectionStatus === 'connected' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  {metrics.connectionStatus === 'connected' ? 'Online' : 'Offline'}
                </div>
                {metrics.connectionStatus === 'connected' && (
                  <p className="text-[9px] text-gray-700 uppercase tracking-tighter truncate font-bold">
                    Instância: {metrics.connectionInstance.toLowerCase().includes('prospekt') ? 'Legado_Master' : metrics.connectionInstance}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        <Card className="col-span-4 bg-card border-border backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest text-[#00A3FF]">Funil de Vendas</CardTitle>
            <CardDescription className="text-[10px] uppercase text-gray-700 tracking-wider font-bold">Distribuição por etapa do CRM</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] w-full">
              {funnelData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                    <XAxis dataKey="name" stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#444" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#050508', border: '1px solid #ffffff10', borderRadius: '8px' }} itemStyle={{ color: '#00A3FF', fontWeight: '900', textTransform: 'uppercase', fontSize: '10px' }} cursor={{ fill: '#ffffff05' }} />
                    <Bar dataKey="leads" fill="#00A3FF" radius={[4, 4, 0, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="h-full flex items-center justify-center text-[10px] uppercase tracking-widest text-gray-800">Sincronizando...</div>}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3 bg-card border-border backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest text-[#00A3FF]">Origem dos Leads</CardTitle>
            <CardDescription className="text-[10px] uppercase text-gray-700 tracking-wider font-bold">Principais canais de entrada</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {sourceData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sourceData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={8} dataKey="value">
                      {sourceData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} stroke="none" />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#050508', border: '1px solid #ffffff10', borderRadius: '8px' }} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '2px', color: '#444', fontWeight: 'bold' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="h-full flex items-center justify-center text-[10px] uppercase tracking-widest text-gray-800">Sem fontes</div>}
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-[10px] text-gray-800 uppercase tracking-[0.5em] mt-8 font-black">
        Legado Performance Digital © 2026
      </p>
    </div>
  )
}