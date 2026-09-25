"use client"

import { useState, useEffect } from "react"
import { getDashboardMetrics } from "@/lib/actions/dashboard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, TrendingUp, TrendingDown, Users, UserPlus, UserMinus, DollarSign, AlertCircle, Smartphone, BrainCircuit, Clock } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

export function AdminDashboard() {
  const [period, setPeriod] = useState<'current_month' | 'last_month' | 'last_30_days' | 'last_6_months'>('current_month')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    getDashboardMetrics(period).then(res => {
      if (mounted) {
        if (res.success) {
          setData(res.data)
        }
        setLoading(false)
      }
    })
    return () => { mounted = false }
  }, [period])

  if (loading && !data) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (!data) return <div className="p-4 text-red-500">Erro ao carregar dados do dashboard.</div>

  const fCurrent = data.financials.current
  const fPrev = data.financials.prev
  const c = data.clients

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  const TrendIndicator = ({ current, prev, isNegativeGood = false, isCurrency = false }: { current: number, prev: number, isNegativeGood?: boolean, isCurrency?: boolean }) => {
    const diff = current - prev
    if (diff === 0) return <span className="text-xs text-muted-foreground ml-2">Sem alteração</span>
    
    const isUp = diff > 0
    // If it's something bad like overdue, then UP is bad (red), DOWN is good (green).
    const isGood = isNegativeGood ? !isUp : isUp
    const color = isGood ? 'text-emerald-400' : 'text-red-400'
    const Icon = isUp ? TrendingUp : TrendingDown
    const formattedDiff = isCurrency ? formatCurrency(Math.abs(diff)) : Math.abs(diff)

    return (
      <span className={`text-xs flex items-center ml-2 ${color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {isUp ? '+' : '-'}{formattedDiff} vs Anterior
      </span>
    )
  }

  const pieData = [
    { name: 'Ativos', value: c.active, color: '#34d399' },
    { name: 'Vencidos', value: c.overdue, color: '#fb923c' },
    { name: 'Cancelados', value: c.cancelled, color: '#ef4444' }
  ].filter(item => item.value > 0)

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-500">
      
      {/* HEADER & FILTERS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/10">
        <div>
          <h2 className="text-xl font-bold text-white">Visão Geral</h2>
          <p className="text-sm text-muted-foreground">Monitore a saúde do seu negócio em tempo real.</p>
        </div>
        <Select value={period} onValueChange={(val: any) => setPeriod(val)}>
          <SelectTrigger className="w-[180px] bg-black border-white/20">
            <SelectValue placeholder="Selecione o período" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-950 border-white/20">
            <SelectItem value="current_month">Mês Atual</SelectItem>
            <SelectItem value="last_month">Mês Passado</SelectItem>
            <SelectItem value="last_30_days">Últimos 30 dias</SelectItem>
            <SelectItem value="last_6_months">Últimos 6 meses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* FINANCE CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-black/40 border-emerald-500/30 backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-emerald-400">Total Recebido</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{formatCurrency(fCurrent.recebido)}</div>
            <div className="flex items-center mt-1">
              <TrendIndicator current={fCurrent.recebido} prev={fPrev.recebido} isCurrency={true} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-blue-500/30 backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-blue-400">A Receber (Pendente)</CardTitle>
            <Clock className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{formatCurrency(fCurrent.aReceber)}</div>
            <div className="flex items-center mt-1">
              <TrendIndicator current={fCurrent.aReceber} prev={fPrev.aReceber} isCurrency={true} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-red-500/30 backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-red-400">Inadimplência</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{formatCurrency(fCurrent.inadimplencia)}</div>
            <div className="flex items-center mt-1">
              <TrendIndicator current={fCurrent.inadimplencia} prev={fPrev.inadimplencia} isNegativeGood={true} isCurrency={true} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CLIENT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-black/40 border-white/10 backdrop-blur-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Clientes</p>
                <h3 className="text-2xl font-bold text-white mt-1">{c.total}</h3>
              </div>
              <div className="p-3 bg-white/5 rounded-full"><Users className="w-5 h-5 text-gray-300" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-white/10 backdrop-blur-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Novos Clientes</p>
                <h3 className="text-2xl font-bold text-emerald-400 mt-1">+{c.newCurrent}</h3>
              </div>
              <div className="p-3 bg-emerald-500/10 rounded-full"><UserPlus className="w-5 h-5 text-emerald-400" /></div>
            </div>
            <div className="mt-2"><TrendIndicator current={c.newCurrent} prev={c.newPrev} /></div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-white/10 backdrop-blur-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Conexões WPP</p>
                <h3 className="text-2xl font-bold text-blue-400 mt-1">{c.wppConnected} <span className="text-sm text-gray-500">/ {c.total}</span></h3>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-full"><Smartphone className="w-5 h-5 text-blue-400" /></div>
            </div>
            <div className="mt-2 w-full bg-gray-800 rounded-full h-1.5">
              <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${c.total > 0 ? (c.wppConnected / c.total) * 100 : 0}%` }}></div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-white/10 backdrop-blur-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">IA Ativas</p>
                <h3 className="text-2xl font-bold text-purple-400 mt-1">{c.iaActive}</h3>
              </div>
              <div className="p-3 bg-purple-500/10 rounded-full"><BrainCircuit className="w-5 h-5 text-purple-400" /></div>
            </div>
            <div className="mt-2 w-full bg-gray-800 rounded-full h-1.5">
              <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${c.total > 0 ? (c.iaActive / c.total) * 100 : 0}%` }}></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-black/40 border-white/10 backdrop-blur-md lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Evolução de Receita</CardTitle>
          </CardHeader>
          <CardContent>
            {data.chartData.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <XAxis dataKey="label" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis 
                      stroke="#888" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                      tickFormatter={(value) => `R$ ${value}`} 
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#111', borderColor: '#333', borderRadius: '8px' }}
                      itemStyle={{ color: '#fff' }}
                      formatter={(value: any) => [formatCurrency(value), 'Receita']}
                    />
                    <Line type="monotone" dataKey="receita" stroke="#34d399" strokeWidth={3} dot={{ r: 4, fill: '#34d399', strokeWidth: 2, stroke: '#000' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Nenhuma receita registrada neste período.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-white/10 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-lg">Status das Assinaturas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center">
            {pieData.length > 0 ? (
              <div className="h-[250px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#111', borderColor: '#333', borderRadius: '8px' }}
                      itemStyle={{ color: '#fff' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground mt-4">
                Sem assinaturas
              </div>
            )}
            
            <div className="flex flex-wrap justify-center gap-4 mt-4 w-full">
              {pieData.map((item, i) => (
                <div key={i} className="flex items-center text-sm">
                  <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: item.color }}></div>
                  <span className="text-gray-300">{item.name}: <strong className="text-white">{item.value}</strong></span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      
    </div>
  )
}
