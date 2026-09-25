"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Shield, ShieldAlert, MoreHorizontal, User, Check, X, ShieldCheck, Mail, Power, Edit, Trash2, Plus, QrCode, RefreshCw, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { updateSubscriptionStatus, toggleAdminRole, updateProfileData, deleteAdminUser, createAdminUser, createAsaasInvoice, fetchUserSubscription, postponeInvoice, fetchInvoiceDueDate, linkAsaasAccount } from "@/lib/actions/admin"
import { AdminDashboard } from "./admin-dashboard"
import { Smartphone, Clock, Link as LinkIcon, LayoutDashboard, List } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type Profile = {
  id: string
  full_name: string | null
  email: string | null
  subscription_status: string | null
  server_id: string | null
  is_admin: boolean | null
  updated_at: string | null
  whatsapp_status?: string
  cpf_cnpj?: string | null
  base_plan_name?: string | null
  base_plan_price?: number | null
  billing_cycle?: string | null
  next_due_date?: string | null
}

function DueDateCell({ customerId, localDate }: { customerId?: string | null, localDate?: string | null }) {
  const [date, setDate] = useState<string | null>(localDate || null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!customerId) return
    let mounted = true
    setLoading(true)
    fetchInvoiceDueDate(customerId).then(res => {
      if (mounted) {
        if (res) setDate(res)
        setLoading(false)
      }
    })
    return () => { mounted = false }
  }, [customerId])

  if (!customerId && !date) return <span className="text-muted-foreground italic">Não informado</span>
  if (loading) return <span className="text-muted-foreground animate-pulse">Buscando...</span>
  
  if (date) {
    // Avoid timezone shift by passing local parts
    const [year, month, day] = date.split('T')[0].split('-')
    const localDate = new Date(Number(year), Number(month) - 1, Number(day))
    return <span>{format(localDate, "dd 'de' MMM, yyyy", { locale: ptBR })}</span>
  }
  
  return <span className="text-muted-foreground italic">Sem fatura pendente</span>
}

export function AdminClient({ initialProfiles }: { initialProfiles: Profile[] }) {
  const router = useRouter()
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles)
  const [isPending, startTransition] = useTransition()
  const [searchTerm, setSearchTerm] = useState("")
  const [viewMode, setViewMode] = useState<'table' | 'dashboard'>('table')
  
  useEffect(() => {
    setProfiles(initialProfiles)
  }, [initialProfiles])

  // Profile edit state
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [newEmail, setNewEmail] = useState("")
  const [newCpf, setNewCpf] = useState("")
  const [newPlanName, setNewPlanName] = useState("")
  const [newPlanPrice, setNewPlanPrice] = useState("")
  const [newBillingCycle, setNewBillingCycle] = useState("")
  const [newNextDueDate, setNewNextDueDate] = useState("")
  const [newBillingType, setNewBillingType] = useState("UNDEFINED")
  const [isFetchingSub, setIsFetchingSub] = useState(false)

  // Create user state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [createData, setCreateData] = useState({
    fullName: "",
    email: "",
    whatsapp: "",
    cpf: "",
    planName: "",
    planPrice: "",
    billingType: "UNDEFINED",
    billingCycle: "MONTHLY",
    nextDueDate: "",
    password: ""
  })

  // WhatsApp Support Connection
  const [connectDialogUser, setConnectDialogUser] = useState<Profile | null>(null)
  const [connectInstance, setConnectInstance] = useState<{name: string, token: string} | null>(null)
  const [connectQr, setConnectQr] = useState<string | null>(null)
  const [connectPhone, setConnectPhone] = useState("")
  const [connectPairingCode, setConnectPairingCode] = useState<string | null>(null)
  const [connectLoading, setConnectLoading] = useState(false)
  const [connectStatus, setConnectStatus] = useState("disconnected")

  // Billing states
  const [billingDialogUser, setBillingDialogUser] = useState<Profile | null>(null)
  const [newItemDesc, setNewItemDesc] = useState("")
  const [newItemAmount, setNewItemAmount] = useState("")
  const [newItemDueDate, setNewItemDueDate] = useState("")
  const [newItemBillingType, setNewItemBillingType] = useState("UNDEFINED")
  const [isBillingLoading, setIsBillingLoading] = useState(false)

  const handleOpenBilling = (profile: Profile) => {
    setBillingDialogUser(profile)
    setNewItemDesc("")
    setNewItemAmount("")
    setNewItemDueDate("")
    setNewItemBillingType("UNDEFINED")
  }

  const handleAddInvoiceItem = async () => {
    if (!newItemDesc || !newItemAmount || !newItemDueDate || !billingDialogUser) return
    setIsBillingLoading(true)
    try {
      const res = await createAsaasInvoice(billingDialogUser.id, newItemDesc, parseFloat(newItemAmount), newItemDueDate, newItemBillingType)
      if (res.success) {
        toast.success("Cobrança Avulsa criada no Asaas com sucesso!")
        setBillingDialogUser(null)
      } else {
        toast.error("Erro: " + res.error)
      }
    } catch(e) {
      toast.error("Erro ao criar fatura")
    } finally {
      setIsBillingLoading(false)
    }
  }

  const handlePostponeInvoice = (userId: string, userName: string) => {
    if (!window.confirm(`Tem certeza que deseja conceder +3 dias de prazo na fatura atual do usuário ${userName}? Isso não altera os vencimentos dos próximos meses.`)) return

    startTransition(async () => {
      const { success, error } = await postponeInvoice(userId, 3)
      if (success) {
        toast.success("Prazo estendido com sucesso! A conta foi reativada se estivesse bloqueada.")
        router.refresh()
      } else {
        toast.error("Erro ao adiar fatura: " + error)
      }
    })
  }

  const handleLinkAsaas = (userId: string) => {
    startTransition(async () => {
      const { success, error } = await linkAsaasAccount(userId)
      if (success) {
        toast.success("Conta sincronizada com o Asaas com sucesso!")
        router.refresh()
      } else {
        toast.error("Erro: " + error)
      }
    })
  }

  const handleOpenConnect = async (profile: Profile) => {
    setConnectDialogUser(profile)
    setConnectLoading(true)
    setConnectQr(null)
    setConnectPairingCode(null)
    setConnectPhone("")
    setConnectStatus("disconnected")

    // Fetch instance info safely
    const { getAdminWhatsappConnection, adminCreateWhatsappInstanceForUser } = await import("@/lib/actions/admin")
    let connData = null

    const { success, data } = await getAdminWhatsappConnection(profile.id)

    if (success && data && data.instance_name && data.instance_key) {
      connData = data
    } else {
      toast.info("Criando nova instância. Aguarde...")
      const createRes = await adminCreateWhatsappInstanceForUser(profile.id)
      if (createRes.success) {
         connData = { instance_name: createRes.instance_name, instance_key: createRes.instance_key, status: 'connecting' }
      } else {
         toast.error("Falha ao criar instância: " + createRes.error)
         setConnectDialogUser(null)
         setConnectLoading(false)
         return
      }
    }

    if (connData) {
      setConnectInstance({ name: connData.instance_name, token: connData.instance_key })
      setConnectStatus(connData.status || 'disconnected')
      
      // Fetch QR Code immediately
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_UAZAPI_URL || ''}/instance/connect`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "token": connData.instance_key },
          body: JSON.stringify({})
        })
        const qData = await res.json()
        const qrBase64 = qData?.instance?.qrcode || qData?.qrcode || qData?.base64 || qData?.instance?.base64
        if (qrBase64) setConnectQr(qrBase64)
      } catch(e) {
        toast.error("Erro ao puxar QR Code")
      }
    }
    setConnectLoading(false)
  }

  const handleGeneratePairingCode = async () => {
    if (!connectInstance || !connectPhone) return
    setConnectLoading(true)
    try {
      const cleanPhone = connectPhone.replace(/\D/g, '')
      const res = await fetch(`${process.env.NEXT_PUBLIC_UAZAPI_URL || ''}/instance/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "token": connectInstance.token },
        body: JSON.stringify({ 
           browser: "auto",
           systemName: "rafael turbo",
           proxy_managed_country: "br",
           proxy_managed_state: "sp",
           proxy_managed_city: "campinas",
           phone: cleanPhone 
        })
      })
      
      const rawText = await res.text()
      console.log("[Pairing Code Raw Response]:\n", rawText)

      let data: any = {}
      try {
        data = JSON.parse(rawText)
      } catch (err) {
        console.error("Não foi possível converter para JSON")
      }
      
      const code = data?.instance?.paircode || data?.paircode || data?.code || data?.pairingCode || data?.instance?.pairingCode || data?.data?.pairingCode
      if (code) {
        setConnectPairingCode(code)
      } else {
        toast.error(`Erro da API: ${data?.message || data?.error || 'Olhe o Console (F12)'}`)
      }
    } catch(e: any) {
      toast.error(`Erro ao chamar API: ${e.message}`)
    }
    setConnectLoading(false)
  }

  // Polling for Connect Dialog
  useEffect(() => {
    if (!connectDialogUser || !connectInstance || connectStatus === 'connected') return
    
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_UAZAPI_URL || ''}/instance/status`, {
          headers: { "token": connectInstance.token }
        })
        const data = await res.json()
        const isConnectedApi = data?.connected === true || data?.state === "open" || data?.instance?.state === "open"
        
        if (isConnectedApi) {
          setConnectStatus("connected")
          toast.success(`WhatsApp conectado com sucesso para ${connectDialogUser.full_name || 'Usuário'}!`)
          
          setProfiles(prev => prev.map(p => p.id === connectDialogUser.id ? { ...p, whatsapp_status: 'connected' } : p))
          
          setTimeout(() => {
             setConnectDialogUser(null)
          }, 2000)
        }
      } catch(e) {}
    }, 4000)

    return () => clearInterval(interval)
  }, [connectDialogUser, connectInstance, connectStatus])

  const handleUpdateStatus = (userId: string, newStatus: string) => {
    startTransition(async () => {
      setProfiles(prev => prev.map(p => p.id === userId ? { ...p, subscription_status: newStatus } : p))
      
      const { success, error } = await updateSubscriptionStatus(userId, newStatus)
      if (success) {
        toast.success(`Status atualizado para ${newStatus}`)
      } else {
        toast.error("Erro ao atualizar status: " + error)
      }
    })
  }

  const handleToggleAdmin = (userId: string, currentIsAdmin: boolean) => {
    const newStatus = !currentIsAdmin
    startTransition(async () => {
      setProfiles(prev => prev.map(p => p.id === userId ? { ...p, is_admin: newStatus } : p))
      
      const { success, error } = await toggleAdminRole(userId, newStatus)
      if (success) {
        toast.success(newStatus ? "Privilégios de admin concedidos" : "Privilégios de admin removidos")
      } else {
        toast.error("Erro ao alterar privilégios: " + error)
      }
    })
  }

  const handleUpdateProfile = () => {
    if (!editingUser) return
    startTransition(async () => {
      const price = newPlanPrice ? parseFloat(newPlanPrice) : null;
      setProfiles(prev => prev.map(p => p.id === editingUser.id ? { 
        ...p, email: newEmail, cpf_cnpj: newCpf, base_plan_name: newPlanName, base_plan_price: price,
        billing_cycle: newBillingCycle, next_due_date: newNextDueDate 
      } : p))
      
      const { success, error } = await updateProfileData(
        editingUser.id, newEmail, newCpf,
        newPlanName, price || undefined,
        newBillingCycle || undefined, newNextDueDate || undefined,
        newBillingType
      )
      if (success) {
        toast.success("Perfil atualizado com sucesso!")
        setEditingUser(null)
      } else {
        toast.error("Erro ao atualizar perfil: " + error)
      }
    })
  }

  const handleDeleteUser = (userId: string, userName: string) => {
    if (!window.confirm(`Tem certeza que deseja EXCLUIR permanentemente o usuário ${userName}? Esta ação não pode ser desfeita e removerá todos os dados atrelados a ele.`)) return

    startTransition(async () => {
      const { success, error } = await deleteAdminUser(userId)
      if (success) {
        toast.success("Usuário excluído com sucesso!")
        setProfiles(prev => prev.filter(p => p.id !== userId))
        router.refresh()
      } else {
        toast.error("Erro ao excluir usuário: " + error)
      }
    })
  }

  const handleCreateUser = () => {
    if (!createData.email || !createData.fullName) {
      toast.error("Nome e Email são obrigatórios")
      return
    }

    startTransition(async () => {
      const price = createData.planPrice ? parseFloat(createData.planPrice) : undefined;
      const { success, error } = await createAdminUser({
        email: createData.email,
        password: createData.password || undefined,
        fullName: createData.fullName,
        whatsapp: createData.whatsapp || undefined,
        cpf: createData.cpf || undefined,
        planName: createData.planName || undefined,
        planPrice: price,
        billingType: createData.billingType,
        billingCycle: createData.billingCycle || undefined,
        nextDueDate: createData.nextDueDate || undefined
      })
      if (success) {
        toast.success("Usuário criado com sucesso!")
        setIsCreateDialogOpen(false)
        setCreateData({
          fullName: "",
          email: "",
          whatsapp: "",
          cpf: "",
          planName: "",
          planPrice: "",
          billingType: "UNDEFINED",
          billingCycle: "MONTHLY",
          nextDueDate: "",
          password: ""
        })
        router.refresh()
      } else {
        toast.error("Erro ao criar usuário: " + error)
      }
    })
  }

  const filteredProfiles = profiles.filter(p => 
    p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-zinc-900/50 p-3 rounded-lg border border-zinc-800">
        <div className="flex items-center bg-black rounded-lg p-1 border border-zinc-800">
          <button
            onClick={() => setViewMode('table')}
            className={cn(
              "flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all",
              viewMode === 'table' ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
            )}
          >
            <List className="w-4 h-4 mr-2" />
            Usuários
          </button>
          <button
            onClick={() => setViewMode('dashboard')}
            className={cn(
              "flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all",
              viewMode === 'dashboard' ? "bg-blue-600 text-white shadow-sm" : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
            )}
          >
            <LayoutDashboard className="w-4 h-4 mr-2" />
            Dashboard
          </button>
        </div>

        {viewMode === 'table' && (
          <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-4">
            <div className="relative w-full sm:w-[300px]">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg className="w-4 h-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
                  <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/>
                </svg>
              </div>
              <input 
                type="text" 
                className="bg-black border border-zinc-800 text-white text-sm rounded-full focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 p-2.5" 
                placeholder="Pesquisar por nome ou email..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <Button onClick={() => setIsCreateDialogOpen(true)} className="w-full sm:w-auto rounded-full bg-[#00A3FF] hover:bg-[#00A3FF]/80 text-white font-bold transition-all duration-300 shadow-[0_0_15px_rgba(0,163,255,0.4)] hover:shadow-[0_0_25px_rgba(0,163,255,0.6)]">
              <Plus className="mr-2 h-4 w-4" /> Novo Usuário
            </Button>
          </div>
        )}
      </div>

      {viewMode === 'dashboard' ? (
        <AdminDashboard />
      ) : (
        <div className="rounded-md border border-border bg-card/50 backdrop-blur-md">
          <Table>
            <TableHeader>
          <TableRow className="border-b border-white/10 hover:bg-transparent">
            <TableHead className="text-xs font-black uppercase tracking-wider text-gray-400">Usuário</TableHead>
            <TableHead className="text-xs font-black uppercase tracking-wider text-gray-400">Server ID</TableHead>
            <TableHead className="text-xs font-black uppercase tracking-wider text-gray-400">WhatsApp</TableHead>
            <TableHead className="text-xs font-black uppercase tracking-wider text-gray-400">Status Assinatura</TableHead>
            <TableHead className="text-xs font-black uppercase tracking-wider text-gray-400">Próximo Vencimento</TableHead>
            <TableHead className="text-right text-xs font-black uppercase tracking-wider text-gray-400">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredProfiles.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                Nenhum usuário encontrado.
              </TableCell>
            </TableRow>
          ) : (
            filteredProfiles.map((profile) => (
              <TableRow key={profile.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                <TableCell className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00A3FF]/10 border border-[#00A3FF]/20">
                      {profile.is_admin ? (
                        <ShieldAlert className="h-5 w-5 text-red-500" />
                      ) : (
                        <User className="h-5 w-5 text-[#00A3FF]" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">
                        {profile.full_name || "Usuário Sem Nome"}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">
                        {profile.email || `ID: ${profile.id.substring(0, 8)}...`}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {profile.server_id ? (
                    <Badge variant="outline" className="font-mono text-xs border-[#00A3FF]/30 text-[#00A3FF] bg-[#00A3FF]/5">
                      {profile.server_id}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs italic">N/A</span>
                  )}
                </TableCell>
                <TableCell>
                  {profile.whatsapp_status === 'connected' ? (
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 gap-1.5 pl-1.5 pr-2">
                      <Smartphone className="h-3 w-3" /> Conectado
                    </Badge>
                  ) : profile.whatsapp_status === 'connecting' ? (
                    <Badge variant="outline" className="border-yellow-500/30 text-yellow-400 bg-yellow-500/10 gap-1.5 pl-1.5 pr-2">
                      <Smartphone className="h-3 w-3 animate-pulse" /> Conectando
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-gray-500/30 text-gray-400 bg-gray-500/10 gap-1.5 pl-1.5 pr-2">
                      <Smartphone className="h-3 w-3" /> Desconectado
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {profile.subscription_status === 'active' ? (
                    <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                      Ativo
                    </Badge>
                  ) : profile.subscription_status === 'canceled' ? (
                    <Badge variant="outline" className="text-red-400 border-red-500/30">
                      Cancelado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">
                      {profile.subscription_status || 'Inativo'}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-gray-400">
                  <DueDateCell customerId={profile.asaas_customer_id} localDate={profile.next_due_date} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end items-center gap-2">
                    {/* Botão direto para Bloquear/Desbloquear */}
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className={cn("h-8 w-8 hover:bg-white/10", profile.subscription_status === 'active' ? "text-emerald-500 hover:text-emerald-400" : "text-red-500 hover:text-red-400")}
                      title={profile.subscription_status === 'active' ? "Bloquear Acesso" : "Ativar Acesso"}
                      disabled={isPending}
                      onClick={() => handleUpdateStatus(profile.id, profile.subscription_status === 'active' ? 'canceled' : 'active')}
                    >
                      <Power className="h-4 w-4" />
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-white/10">
                        <span className="sr-only">Abrir menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover border-border">
                      <DropdownMenuLabel className="font-bold text-xs uppercase tracking-wider text-gray-400">Ações do Usuário</DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-white/10" />
                      
                      {/* Subscription Actions */}
                      {profile.subscription_status !== 'active' ? (
                        <DropdownMenuItem 
                          className="cursor-pointer text-emerald-400 focus:bg-emerald-500/10 focus:text-emerald-400"
                          onClick={() => handleUpdateStatus(profile.id, 'active')}
                          disabled={isPending}
                        >
                          <Check className="mr-2 h-4 w-4" />
                          Ativar Assinatura
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem 
                          className="cursor-pointer text-red-400 focus:bg-red-500/10 focus:text-red-400"
                          onClick={() => handleUpdateStatus(profile.id, 'canceled')}
                          disabled={isPending}
                        >
                          <X className="mr-2 h-4 w-4" />
                          Bloquear Acesso
                        </DropdownMenuItem>
                      )}

                      <DropdownMenuSeparator className="bg-white/10" />

                      {/* Billing Action */}
                      <DropdownMenuItem 
                        className="cursor-pointer text-blue-400 focus:bg-blue-500/10 focus:text-blue-400"
                        onClick={() => handleOpenBilling(profile)}
                      >
                        <QrCode className="mr-2 h-4 w-4" />
                        Criar Cobrança Avulsa
                      </DropdownMenuItem>

                      <DropdownMenuSeparator className="bg-white/10" />

                      {/* WhatsApp Connect Action */}
                      <DropdownMenuItem 
                        className="cursor-pointer text-purple-400 focus:bg-purple-500/10 focus:text-purple-400"
                        onClick={() => handleOpenConnect(profile)}
                      >
                        <Smartphone className="mr-2 h-4 w-4" />
                        Conectar WhatsApp (Suporte)
                      </DropdownMenuItem>

                      <DropdownMenuSeparator className="bg-white/10" />

                      <DropdownMenuSeparator className="bg-white/10" />

                      {/* Asaas Link Action */}
                      <DropdownMenuItem 
                        className="cursor-pointer text-blue-400 focus:bg-blue-500/10 focus:text-blue-400"
                        onClick={() => handleLinkAsaas(profile.id)}
                        disabled={isPending}
                      >
                        <LinkIcon className="mr-2 h-4 w-4" />
                        Sincronizar com Asaas
                      </DropdownMenuItem>

                      {/* Postpone Invoice Action */}
                      <DropdownMenuItem 
                        className="cursor-pointer text-orange-400 focus:bg-orange-500/10 focus:text-orange-400"
                        onClick={() => handlePostponeInvoice(profile.id, profile.full_name || profile.email || 'Usuário')}
                        disabled={isPending}
                      >
                        <Clock className="mr-2 h-4 w-4" />
                        Adiar Fatura Atual (+3 dias)
                      </DropdownMenuItem>

                      <DropdownMenuSeparator className="bg-white/10" />

                      {/* Admin Role Actions */}
                      <DropdownMenuItem 
                        className="cursor-pointer text-[#00A3FF] focus:bg-[#00A3FF]/10 focus:text-[#00A3FF]"
                        onClick={() => handleToggleAdmin(profile.id, !!profile.is_admin)}
                        disabled={isPending}
                      >
                        {profile.is_admin ? (
                          <>
                            <Shield className="mr-2 h-4 w-4" />
                            Remover Admin
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="mr-2 h-4 w-4" />
                            Tornar Admin
                          </>
                        )}
                      </DropdownMenuItem>

                      {/* Edit Profile Action */}
                      <DropdownMenuItem 
                        className="cursor-pointer text-gray-300 focus:bg-white/10 focus:text-white"
                        onClick={async () => {
                          setEditingUser(profile)
                          setNewEmail(profile.email || "")
                          setNewCpf(profile.cpf_cnpj || "")
                          setNewPlanName("")
                          setNewPlanPrice("")
                          setNewBillingCycle("MONTHLY")
                          setNewNextDueDate("")
                          setNewBillingType("UNDEFINED")
                          
                          setIsFetchingSub(true)
                          const res = await fetchUserSubscription(profile.id)
                          if (res.success && res.data) {
                            setNewPlanName(res.data.planName || "")
                            setNewPlanPrice(res.data.planPrice ? res.data.planPrice.toString() : "")
                            setNewBillingCycle(res.data.billingCycle || "MONTHLY")
                            setNewNextDueDate(res.data.nextDueDate || "")
                            setNewBillingType(res.data.billingType || "UNDEFINED")
                          }
                          setIsFetchingSub(false)
                        }}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Editar Dados, CPF e Plano
                      </DropdownMenuItem>

                      <DropdownMenuSeparator className="bg-white/10" />

                      {/* Delete User Action */}
                      <DropdownMenuItem 
                        className="cursor-pointer text-red-500 focus:bg-red-500/10 focus:text-red-500 font-medium"
                        onClick={() => handleDeleteUser(profile.id, profile.full_name || profile.email || 'Usuário')}
                        disabled={isPending}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir Usuário permanentemente
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={!!editingUser} onOpenChange={(o) => !o && setEditingUser(null)}>
        <DialogContent className="bg-[#0A0A12] border border-white/10 text-white sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Perfil</DialogTitle>
          </DialogHeader>
          {isFetchingSub ? (
            <div className="flex flex-col items-center justify-center p-8 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-[#00A3FF]" />
              <p className="text-sm text-gray-400">Buscando assinatura no Asaas...</p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                <div className="grid gap-2">
              <Label htmlFor="email" className="text-gray-400">
                Email de {editingUser?.full_name || 'Usuário'}
              </Label>
              <Input
                id="email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="bg-black/50 border-white/10 text-white"
                placeholder="exemplo@email.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cpf" className="text-gray-400">
                CPF / CNPJ
              </Label>
              <Input
                id="cpf"
                type="text"
                value={newCpf}
                onChange={(e) => setNewCpf(e.target.value)}
                className="bg-black/50 border-white/10 text-white"
                placeholder="Apenas números"
              />
            </div>
            
            <div className="border-t border-white/10 pt-4 mt-2">
              <Label className="text-white font-medium mb-4 block">Configuração do Plano Base</Label>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="planName" className="text-gray-400">Nome do Plano (Ex: Plano Mensal Start)</Label>
                  <Input
                    id="planName"
                    type="text"
                    value={newPlanName}
                    onChange={(e) => setNewPlanName(e.target.value)}
                    className="bg-black/50 border-white/10 text-white"
                    placeholder="Nome do plano"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="planPrice" className="text-gray-400">Valor do Plano Base (R$)</Label>
                    <Input
                      id="planPrice"
                      type="number"
                      step="0.01"
                      value={newPlanPrice}
                      onChange={(e) => setNewPlanPrice(e.target.value)}
                      className="bg-black/50 border-white/10 text-white"
                      placeholder="Ex: 900.00"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="billingType" className="text-gray-400">Forma de Pagamento</Label>
                    <select
                      id="billingType"
                      value={newBillingType}
                      onChange={(e) => setNewBillingType(e.target.value)}
                      className="flex h-10 w-full items-center justify-between rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-white focus:outline-none"
                    >
                      <option value="PIX">Pix</option>
                      <option value="BOLETO">Boleto</option>
                      <option value="CREDIT_CARD">Cartão de Crédito</option>
                      <option value="UNDEFINED">Híbrido (Cliente Escolhe)</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="grid gap-4 grid-cols-2 mt-4">
                <div className="grid gap-2">
                  <Label htmlFor="billingCycle" className="text-gray-400">Periodicidade</Label>
                  <select
                    id="billingCycle"
                    value={newBillingCycle}
                    onChange={(e) => setNewBillingCycle(e.target.value)}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-white focus:outline-none"
                  >
                    <option value="">Selecione...</option>
                    <option value="WEEKLY">Semanal</option>
                    <option value="MONTHLY">Mensal</option>
                    <option value="QUARTERLY">Trimestral</option>
                    <option value="SEMIANNUALLY">Semestral</option>
                    <option value="YEARLY">Anual</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="nextDueDate" className="text-gray-400">Primeiro Vencimento</Label>
                  <Input
                    id="nextDueDate"
                    type="date"
                    value={newNextDueDate}
                    onChange={(e) => setNewNextDueDate(e.target.value)}
                    className="bg-black/50 border-white/10 text-white"
                  />
                </div>
              </div>
            </div>
          </div>
            </>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingUser(null)} disabled={isPending || isFetchingSub}>Cancelar</Button>
            <Button 
              className="bg-[#00A3FF] hover:bg-[#00A3FF]/80 text-white" 
              onClick={handleUpdateProfile}
              disabled={isPending || isFetchingSub || (!newEmail && !newCpf)}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="bg-[#0A0A12] border border-white/10 text-white sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
            <div className="grid gap-2">
              <Label htmlFor="fullName" className="text-gray-400">Nome Completo *</Label>
              <Input
                id="fullName"
                value={createData.fullName}
                onChange={(e) => setCreateData({...createData, fullName: e.target.value})}
                className="bg-black/50 border-white/10 text-white"
                placeholder="Ex: João Silva"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="newEmail" className="text-gray-400">Email *</Label>
              <Input
                id="newEmail"
                type="email"
                value={createData.email}
                onChange={(e) => setCreateData({...createData, email: e.target.value})}
                className="bg-black/50 border-white/10 text-white"
                placeholder="exemplo@email.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-whatsapp" className="text-gray-400">WhatsApp (Opcional)</Label>
              <Input
                id="create-whatsapp"
                type="text"
                value={createData.whatsapp}
                onChange={(e) => setCreateData({ ...createData, whatsapp: e.target.value })}
                className="bg-black/50 border-white/10 text-white"
                placeholder="Ex: 5511999999999"
              />
            </div>
            
            <div className="border-t border-white/10 pt-4 mt-2">
              <Label className="text-white font-medium mb-4 block">Configuração do Plano Base (Asaas)</Label>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="create-cpf" className="text-gray-400">CPF / CNPJ *</Label>
                  <Input
                    id="create-cpf"
                    type="text"
                    value={createData.cpf}
                    onChange={(e) => setCreateData({ ...createData, cpf: e.target.value })}
                    className="bg-black/50 border-white/10 text-white"
                    placeholder="Apenas números"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="create-planName" className="text-gray-400">Nome do Plano (Ex: Plano Mensal Start)</Label>
                  <Input
                    id="create-planName"
                    type="text"
                    value={createData.planName}
                    onChange={(e) => setCreateData({ ...createData, planName: e.target.value })}
                    className="bg-black/50 border-white/10 text-white"
                    placeholder="Nome do plano"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="create-planPrice" className="text-gray-400">Valor (R$)</Label>
                    <Input
                      id="create-planPrice"
                      type="number"
                      step="0.01"
                      value={createData.planPrice}
                      onChange={(e) => setCreateData({ ...createData, planPrice: e.target.value })}
                      className="bg-black/50 border-white/10 text-white"
                      placeholder="Ex: 900.00"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="create-billingType" className="text-gray-400">Forma de Pagto</Label>
                    <select
                      id="create-billingType"
                      value={createData.billingType}
                      onChange={(e) => setCreateData({ ...createData, billingType: e.target.value })}
                      className="flex h-10 w-full items-center justify-between rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-white focus:outline-none"
                    >
                      <option value="PIX">Pix</option>
                      <option value="BOLETO">Boleto</option>
                      <option value="CREDIT_CARD">Cartão</option>
                      <option value="UNDEFINED">Híbrido (Escolhe)</option>
                    </select>
                  </div>
                </div>
                <div className="grid gap-4 grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="create-billingCycle" className="text-gray-400">Periodicidade</Label>
                    <select
                      id="create-billingCycle"
                      value={createData.billingCycle}
                      onChange={(e) => setCreateData({ ...createData, billingCycle: e.target.value })}
                      className="flex h-10 w-full items-center justify-between rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-white focus:outline-none"
                    >
                      <option value="WEEKLY">Semanal</option>
                      <option value="BIWEEKLY">Quinzenal</option>
                      <option value="MONTHLY">Mensal</option>
                      <option value="QUARTERLY">Trimestral</option>
                      <option value="SEMIANNUALLY">Semestral</option>
                      <option value="YEARLY">Anual</option>
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="create-nextDueDate" className="text-gray-400">Primeiro Vencimento</Label>
                    <Input
                      id="create-nextDueDate"
                      type="date"
                      value={createData.nextDueDate}
                      onChange={(e) => setCreateData({ ...createData, nextDueDate: e.target.value })}
                      className="bg-black/50 border-white/10 text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 pt-4 mt-2">
              <div className="grid gap-2">
                <Label htmlFor="create-password" className="text-gray-400">Senha (Opcional)</Label>
                <Input
                  id="create-password"
                  type="password"
                  value={createData.password}
                  onChange={(e) => setCreateData({ ...createData, password: e.target.value })}
                  className="bg-black/50 border-white/10 text-white"
                  placeholder="Deixe em branco para senha padrão"
                />
                <p className="text-xs text-gray-500 mt-1">Se deixado em branco, a senha padrão "Temporaria123!" será usada.</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCreateDialogOpen(false)} disabled={isPending}>Cancelar</Button>
            <Button 
              className="bg-[#00A3FF] hover:bg-[#00A3FF]/80 text-white" 
              onClick={handleCreateUser}
              disabled={isPending || !createData.email || !createData.fullName}
            >
              <Plus className="mr-2 h-4 w-4" />
              Criar Usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gerenciar Faturas Dialog */}
      <Dialog open={!!billingDialogUser} onOpenChange={(o) => !o && setBillingDialogUser(null)}>
        <DialogContent className="bg-[#0A0A12] border border-white/10 text-white sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Cobrança Avulsa: {billingDialogUser?.full_name || 'Usuário'}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-6">
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Criar Cobrança Avulsa (Direto no Asaas)</h4>
              <div className="grid grid-cols-4 gap-2">
                <Input 
                  placeholder="Descrição (Ex: Arte Extra)" 
                  className="bg-black/50 border-white/10 col-span-4"
                  value={newItemDesc}
                  onChange={e => setNewItemDesc(e.target.value)}
                />
                <Input 
                  type="number"
                  placeholder="Valor (R$)" 
                  className="bg-black/50 border-white/10"
                  value={newItemAmount}
                  onChange={e => setNewItemAmount(e.target.value)}
                />
                <select
                  value={newItemBillingType}
                  onChange={(e) => setNewItemBillingType(e.target.value)}
                  className="flex h-10 w-full items-center justify-between rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-white focus:outline-none col-span-2"
                >
                  <option value="PIX">Pix</option>
                  <option value="BOLETO">Boleto</option>
                  <option value="CREDIT_CARD">Cartão</option>
                  <option value="UNDEFINED">Híbrido (Escolhe)</option>
                </select>
                <Input 
                  type="date"
                  className="bg-black/50 border-white/10"
                  value={newItemDueDate}
                  onChange={e => setNewItemDueDate(e.target.value)}
                  title="Data de Vencimento"
                />
                <Button className="col-span-4 mt-2" onClick={handleAddInvoiceItem} disabled={isBillingLoading || !newItemDesc || !newItemAmount || !newItemDueDate}>
                  {isBillingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                  Cobrar
                </Button>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 text-center text-sm text-gray-400">
              <p>A assinatura base é cobrada automaticamente pelo Asaas na data do vencimento. <br/>As cobranças avulsas que você cria aqui vão gerar faturas separadas lá no Asaas para o cliente pagar.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Connect WhatsApp Dialog */}
      <Dialog open={!!connectDialogUser} onOpenChange={(o) => !o && setConnectDialogUser(null)}>
        <DialogContent className="bg-[#0A0A12] border border-white/10 text-white sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Conexão Assistida</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center space-y-6 py-4">
            {connectLoading && !connectQr && !connectPairingCode ? (
              <div className="flex flex-col items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-[#00A3FF]" />
                <p className="mt-4 text-sm text-gray-400">Carregando dados da instância...</p>
              </div>
            ) : connectStatus === 'connected' ? (
              <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 animate-in fade-in zoom-in">
                <div className="h-16 w-16 bg-emerald-500/10 rounded-full flex items-center justify-center">
                  <Check className="h-8 w-8 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-emerald-500 font-bold text-lg">Conectado com Sucesso!</h3>
                  <p className="text-sm text-gray-400 mt-2">A instância do WhatsApp de <strong>{connectDialogUser?.full_name || 'Usuário'}</strong> já está operante e pronta para uso.</p>
                </div>
              </div>
            ) : (
              <>
                {/* QR Code Section */}
                <div className="w-full flex flex-col items-center justify-center bg-white/5 border border-white/10 rounded-xl p-4">
                  <h3 className="text-sm font-medium mb-4 flex items-center gap-2 text-gray-300">
                    <QrCode className="h-4 w-4 text-[#00A3FF]" />
                    Ler QR Code
                  </h3>
                  {connectQr ? (
                    <div className="bg-white p-2 rounded-lg">
                      <img src={connectQr} alt="QR Code" className="w-48 h-48 object-contain" />
                    </div>
                  ) : (
                    <div className="w-48 h-48 bg-black/40 flex items-center justify-center rounded-lg border border-white/10">
                      <QrCode className="h-12 w-12 text-gray-600" />
                    </div>
                  )}
                </div>

                <div className="w-full flex items-center justify-center">
                  <div className="h-px bg-white/10 w-full"></div>
                  <span className="px-4 text-xs font-medium text-gray-500 uppercase">Ou</span>
                  <div className="h-px bg-white/10 w-full"></div>
                </div>

                {/* Pairing Code Section */}
                <div className="w-full space-y-4 bg-white/5 border border-white/10 rounded-xl p-4">
                  <h3 className="text-sm font-medium flex items-center gap-2 text-gray-300">
                    <Smartphone className="h-4 w-4 text-[#00A3FF]" />
                    Conectar com Número
                  </h3>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Ex: 5511999999999"
                      value={connectPhone}
                      onChange={(e) => setConnectPhone(e.target.value)}
                      className="bg-black/50 border-white/10 text-white"
                    />
                    <Button 
                      onClick={handleGeneratePairingCode}
                      disabled={connectLoading || !connectPhone}
                      className="bg-[#00A3FF] hover:bg-[#00A3FF]/80 text-white whitespace-nowrap"
                    >
                      {connectLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gerar Código"}
                    </Button>
                  </div>
                  
                  {connectPairingCode && (
                    <div className="mt-4 p-4 bg-black/40 border border-white/10 rounded-lg text-center animate-in fade-in zoom-in">
                      <p className="text-xs text-gray-400 mb-2">Código de Emparelhamento:</p>
                      <p className="text-4xl font-mono font-bold text-emerald-400 tracking-widest">{connectPairingCode.slice(0,4)}-{connectPairingCode.slice(4)}</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      </div>
      )}
    </div>
  )
}
