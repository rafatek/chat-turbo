"use client"

import { useState, useEffect } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Bot, MessageSquare, Megaphone, Settings2, Power, Loader2, Calendar, Sparkles } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { AtendimentoConfigSheet } from "@/components/agents/atendimento-config-sheet"
import { AgendamentoConfigSheet } from "@/components/agents/agendamento-config-sheet"
import { AssistenteConfigSheet } from "@/components/agents/assistente-config-sheet"

// Type for card summary data
interface AgentSummary {
  is_active: boolean
  agent_name: string
}

export default function AgentsHubPage() {
  const [isAtendimentoSheetOpen, setIsAtendimentoSheetOpen] = useState(false)
  const [isAgendamentoSheetOpen, setIsAgendamentoSheetOpen] = useState(false)
  const [isAssistenteSheetOpen, setIsAssistenteSheetOpen] = useState(false)

  // Local state for dashboard cards (to show active status without opening sheet)
  const [atendimentoSummary, setAtendimentoSummary] = useState<AgentSummary | null>(null)
  const [agendamentoSummary, setAgendamentoSummary] = useState<AgentSummary | null>(null)
  const [assistenteSummary, setAssistenteSummary] = useState<AgentSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchSummaries = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('agents_configs')
        .select('agent_type, is_active, agent_name')
        .eq('user_id', user.id)

      // Parse result
      const atendimento = data?.find((a: any) => a.agent_type === 'atendimento')
      if (atendimento) {
        setAtendimentoSummary({
          is_active: atendimento.is_active,
          agent_name: atendimento.agent_name || "Agente de Atendimento"
        })
      }

      // Fetch agendamento status
      const { data: agendamentoData } = await supabase
        .from('agents_agendamento_config')
        .select('is_active')
        .eq('user_id', user.id)
        .single()
        
      if (agendamentoData) {
        setAgendamentoSummary({
          is_active: agendamentoData.is_active,
          agent_name: "Agente de Agendamento"
        })
      }

      // Fetch assistente status
      const { data: assistenteData } = await supabase
        .from('agents_assist')
        .select('is_active')
        .eq('user_id', user.id)
        .single()

      if (assistenteData) {
        setAssistenteSummary({
          is_active: assistenteData.is_active,
          agent_name: "Assistente de Mensagem"
        })
      }
    } catch (error) {
      console.error("Error fetching summaries", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSummaries()
  }, [isAtendimentoSheetOpen, isAgendamentoSheetOpen, isAssistenteSheetOpen]) // Re-fetch when sheet closes to update status

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
          Central de Agentes
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Gerencie sua equipe de inteligência artificial. Ative, configure e monitore seus agentes autônomos.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">

        {/* === CARD AGENTE ATENDIMENTO === */}
        <Card className="relative overflow-hidden border-indigo-500/20 bg-gradient-to-b from-card to-card/50 transition-all hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/5">
          <div className="absolute top-0 right-0 p-4">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Badge variant={atendimentoSummary?.is_active ? "default" : "secondary"} className={atendimentoSummary?.is_active ? "bg-green-500/15 text-green-400 hover:bg-green-500/25" : ""}>
                {atendimentoSummary?.is_active ? "Ativo" : "Pausado"}
              </Badge>
            )}
          </div>

          <CardHeader className="flex flex-row items-start gap-4 space-y-0">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
              <Bot className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <CardTitle>Atendimento</CardTitle>
              <CardDescription className="line-clamp-2">
                Responde clientes no WhatsApp, tira dúvidas e qualifica leads 24/7.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <div className="flex items-center gap-4 text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/50">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                <span>WhatsApp</span>
              </div>
              <div className="h-4 w-[1px] bg-border" />
              <span>{atendimentoSummary?.agent_name || "Não configurado"}</span>
            </div>
          </CardContent>

          <CardFooter>
            <Button
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-900/20"
              onClick={() => setIsAtendimentoSheetOpen(true)}
            >
              <Settings2 className="mr-2 h-4 w-4" />
              Configurar Agente
            </Button>
          </CardFooter>
        </Card>

        {/* === CARD AGENTE AGENDAMENTO === */}
        <Card className="relative overflow-hidden border-blue-500/20 bg-gradient-to-b from-card to-card/50 transition-all hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/5">
          <div className="absolute top-0 right-0 p-4">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Badge variant={agendamentoSummary?.is_active ? "default" : "secondary"} className={agendamentoSummary?.is_active ? "bg-green-500/15 text-green-400 hover:bg-green-500/25" : ""}>
                {agendamentoSummary?.is_active ? "Ativo" : "Pausado"}
              </Badge>
            )}
          </div>

          <CardHeader className="flex flex-row items-start gap-4 space-y-0">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
              <Calendar className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <CardTitle>Agendamento</CardTitle>
              <CardDescription className="line-clamp-2">
                Gerencia marcações integradas diretamente com seu Google Agenda.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <div className="flex items-center gap-4 text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/50">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>Google Agenda</span>
              </div>
            </div>
          </CardContent>

          <CardFooter>
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-900/20"
              onClick={() => setIsAgendamentoSheetOpen(true)}
            >
              <Settings2 className="mr-2 h-4 w-4" />
              Configurar Agente
            </Button>
          </CardFooter>
        </Card>

        {/* === CARD ASSISTENTE DE MENSAGEM === */}
        <Card className="relative overflow-hidden border-emerald-500/20 bg-gradient-to-b from-card to-card/50 transition-all hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5">
          <div className="absolute top-0 right-0 p-4">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Badge variant={assistenteSummary?.is_active ? "default" : "secondary"} className={assistenteSummary?.is_active ? "bg-green-500/15 text-green-400 hover:bg-green-500/25" : ""}>
                {assistenteSummary?.is_active ? "Ativo" : "Pausado"}
              </Badge>
            )}
          </div>

          <CardHeader className="flex flex-row items-start gap-4 space-y-0">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <CardTitle>Assistente de Mensagem</CardTitle>
              <CardDescription className="line-clamp-2">
                Auxilia na composição inteligente, reescrita e sugestões de respostas.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <div className="flex items-center gap-4 text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/50">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-400" />
                <span>Copiloto de Chat</span>
              </div>
            </div>
          </CardContent>

          <CardFooter>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-900/20"
              onClick={() => setIsAssistenteSheetOpen(true)}
            >
              <Settings2 className="mr-2 h-4 w-4" />
              Configurar Agente
            </Button>
          </CardFooter>
        </Card>

      </div>

      {/* Sheets / Modals */}
      <AtendimentoConfigSheet
        open={isAtendimentoSheetOpen}
        onOpenChange={setIsAtendimentoSheetOpen}
      />
      <AgendamentoConfigSheet
        open={isAgendamentoSheetOpen}
        onOpenChange={setIsAgendamentoSheetOpen}
      />
      <AssistenteConfigSheet
        open={isAssistenteSheetOpen}
        onOpenChange={setIsAssistenteSheetOpen}
      />
    </div>
  )
}
