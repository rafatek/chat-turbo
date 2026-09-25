"use client"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Link2,
  BrainCircuit,
  User,
  HelpCircle,
  FolderKanban,
  LogOut,
  Megaphone,
  MessageSquare,
  Target,
  Lock,
  Webhook,
  ShieldAlert,
  X,
  Zap,
  CalendarClock,
  FileText,
} from "lucide-react"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "CRM/Kanban", href: "/crm", icon: FolderKanban },
  { name: "Atendimento", href: "/atendimento", icon: MessageSquare },
  { name: "Agendamentos", href: "/agendamentos", icon: CalendarClock },
  { name: "Faturas", href: "/faturas", icon: FileText },
  { name: "Disparos", href: "/campanhas", icon: Megaphone },
  { name: "Remarketing", href: "/remarketing", icon: Target },
  { name: "Conexões", href: "/conexoes", icon: Link2 },
  { name: "Automações", href: "/automacoes", icon: Webhook },
  { name: "Gatilhos", href: "/gatilhos", icon: Zap },
  { name: "Agente IA", href: "/agente", icon: BrainCircuit },
  { name: "Minha Conta", href: "/conta", icon: User },
  { name: "Suporte", href: "/suporte", icon: HelpCircle },
]

interface AppSidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export function AppSidebar({ isOpen = false, onClose }: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [userName, setUserName] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  // Fecha a sidebar ao mudar de rota no mobile
  useEffect(() => {
    onClose?.()
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, is_admin')
            .eq('id', user.id)
            .single()

          setUserName(profile?.full_name || user.email?.split('@')[0] || "Usuário")
          setIsAdmin(profile?.is_admin || false)
        }
      } catch (error) {
        console.error("Error fetching user details", error)
      } finally {
        setLoading(false)
      }
    }
    fetchUser()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace("/login")
  }

  const sidebarContent = (
    <div className="flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Logo + Botão fechar (só mobile) */}
      <div className="flex h-40 items-center justify-center border-b border-sidebar-border px-6 relative">
        <div className="relative flex items-center justify-center w-full">
          <img
            src="/apple-icon.png"
            alt="Legado"
            className="h-28 w-auto object-contain drop-shadow-[0_0_15px_rgba(0,163,255,0.4)]"
          />
        </div>
        <button
          onClick={onClose}
          className="md:hidden absolute top-3 right-3 p-1.5 rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          aria-label="Fechar menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4 custom-scrollbar">
        {navigation.map((item) => {
          const isActive = pathname === item.href

          if (item.locked) {
            return (
              <div
                key={item.name}
                className="flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-black uppercase tracking-widest text-sidebar-foreground/50 bg-sidebar-accent/50 cursor-not-allowed opacity-80"
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-4 w-4 text-gray-700" />
                  <span className="opacity-60">{item.name}</span>
                </div>
                <div className="flex items-center gap-1 bg-sidebar-accent px-1.5 py-0.5 rounded-sm border border-sidebar-border">
                  <Lock className="h-2.5 w-2.5 text-sidebar-foreground/50" />
                  <span className="text-[8px] text-sidebar-foreground/50 tracking-normal normal-case">Em breve</span>
                </div>
              </div>
            )
          }

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-black uppercase tracking-widest transition-all duration-200",
                isActive
                  ? "bg-[#00A3FF]/10 text-[#00A3FF] border border-[#00A3FF]/20"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )}
            >
              <item.icon className={cn("h-4 w-4", isActive ? "text-[#00A3FF]" : "text-sidebar-foreground/50")} />
              {item.name}
            </Link>
          )
        })}

        {isAdmin && (
          <Link
            href="/admin"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-black uppercase tracking-widest transition-all duration-200 mt-4",
              pathname === "/admin"
                ? "bg-red-500/10 text-red-500 border border-red-500/20"
                : "text-red-500/70 hover:bg-red-500/10 hover:text-red-500",
            )}
          >
            <ShieldAlert className={cn("h-4 w-4", pathname === "/admin" ? "text-red-500" : "text-red-500/70")} />
            Administração
          </Link>
        )}
      </nav>

      <div className="border-t border-sidebar-border p-4 space-y-3 bg-sidebar/50">
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00A3FF]/20 border border-[#00A3FF]/30">
            <User className="h-4 w-4 text-[#00A3FF]" />
          </div>
          <div className="flex-1 overflow-hidden">
            {loading ? (
              <div className="h-3 w-20 bg-white/5 rounded animate-pulse" />
            ) : (
              <p className="text-xs font-black truncate text-sidebar-foreground uppercase tracking-wider">
                {userName}
              </p>
            )}
            <p className="text-[9px] text-sidebar-foreground/50 uppercase tracking-tighter font-bold">Administrador</p>
          </div>
        </div>

        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start gap-3 text-sidebar-foreground/60 hover:text-red-500 hover:bg-red-500/10 h-9 px-2"
        >
          <LogOut className="h-4 w-4" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Sair</span>
        </Button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop: sidebar fixa, invisível em mobile */}
      <div className="hidden md:flex h-screen flex-shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile: drawer com overlay */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Overlay escuro */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          {/* Sidebar deslizando da esquerda */}
          <div className="relative flex h-full animate-in slide-in-from-left duration-300">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  )
}