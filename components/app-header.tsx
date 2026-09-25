"use client"

import { Button } from "@/components/ui/button"
import { PlayCircle, X, Menu } from "lucide-react"
import { usePathname } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { useState, useEffect } from "react"
import { OnboardingTour } from "@/components/onboarding-tour"
import { ThemeToggle } from "@/components/theme-toggle"
import { supabase } from "@/lib/supabase"

const TUTORIAL_LINKS: Record<string, string> = {
  "/dashboard": "",
  "/leads": "",
  "/crm": "",
  "/campanhas": "",
  "/conexoes": "",
  "/agente": "",
  "/ferramentas": "",
  "/conta": "",
  "/suporte": "",
}

const getVideoId = (url: string) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
  const match = url.match(regExp)
  return match && match[2].length === 11 ? match[2] : null
}

interface AppHeaderProps {
  onMenuClick?: () => void
}

export function AppHeader({ onMenuClick }: AppHeaderProps) {
  const pathname = usePathname()
  const videoUrl = TUTORIAL_LINKS[pathname] || TUTORIAL_LINKS["/dashboard"]
  const videoId = getVideoId(videoUrl)
  const [showTour, setShowTour] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [daysUntilDue, setDaysUntilDue] = useState<number | null>(null)

  useEffect(() => {
    setMounted(true)
    // Chave de localStorage atualizada para Legado
    const hasSeenTour = localStorage.getItem("legado_tutorial_tour_seen")
    if (!hasSeenTour) {
      const timer = setTimeout(() => {
        setShowTour(true)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    async function checkDueDate() {
      try {
        const res = await fetch('/api/invoices/next-due')
        if (!res.ok) return
        
        const data = await res.json()
        
        if (data?.next_due_date) {
          // Asaas returns YYYY-MM-DD. Split to avoid timezone shift in JavaScript.
          const [year, month, day] = data.next_due_date.split('-')
          const dueDate = new Date(Number(year), Number(month) - 1, Number(day))
          
          const now = new Date()
          
          // Zera as horas para comparar apenas os dias exatos
          dueDate.setHours(0, 0, 0, 0)
          now.setHours(0, 0, 0, 0)
          
          const diffTime = dueDate.getTime() - now.getTime()
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
          
          // Mostra o aviso se faltar 5 dias ou menos (e >= 0 para não mostrar negativo)
          if (diffDays <= 5 && diffDays >= 0) {
            setDaysUntilDue(diffDays)
          }
        }
      } catch (e) {
        // Ignora erro, pois o aviso não é crítico
      }
    }
    checkDueDate()
  }, [])

  const handleTourComplete = () => {
    localStorage.setItem("legado_tutorial_tour_seen", "true")
    setShowTour(false)
  }

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 md:h-16 items-center justify-between px-3 md:px-6">
        {/* Botão hamburguer — só mobile */}
        <button
          onClick={onMenuClick}
          className="md:hidden flex items-center justify-center h-9 w-9 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Spacer no desktop (sem hamburguer) */}
        <div className="hidden md:block" />

        {/* Ações da direita: Tema + Tutorial */}
        <div className="flex items-center gap-3">
          {daysUntilDue !== null && (
            <div className="hidden sm:flex items-center text-red-500 bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/20 mr-1 animate-pulse">
              <span className="text-xs font-bold uppercase tracking-wider">
                {daysUntilDue === 0 
                  ? "Sua fatura vence hoje!" 
                  : `Falta${daysUntilDue > 1 ? 'm' : ''} ${daysUntilDue} dia${daysUntilDue > 1 ? 's' : ''} para vencer!`}
              </span>
            </div>
          )}
          
          <ThemeToggle />
          
          {mounted ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  className={`gap-2 bg-[#00A3FF] hover:bg-[#0082CC] text-white shadow-lg shadow-[#00A3FF]/20 transition-all hover:scale-105 
                    ${showTour ? 'relative z-[60] ring-4 ring-[#00A3FF]/50 ring-offset-2 ring-offset-background' : ''}`}
                >
                  <PlayCircle className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">Tutorial da Página</span>
                </Button>
              </DialogTrigger>
              <DialogContent showCloseButton={false} className="sm:max-w-[800px] p-0 overflow-hidden bg-black/90 border-white/10">
                <DialogHeader className="flex flex-row items-center justify-between p-4 absolute z-10 w-full bg-gradient-to-b from-black/80 to-transparent">
                  <DialogTitle className="text-white text-sm font-bold uppercase tracking-widest">
                    Legado <span className="text-[#00A3FF]">Academy</span>
                  </DialogTitle>
                  <DialogClose className="rounded-full p-1 hover:bg-white/10 transition-colors text-white cursor-pointer z-50">
                    <X className="h-5 w-5" />
                  </DialogClose>
                </DialogHeader>
                <div className="aspect-video w-full bg-black">
                  {videoId ? (
                    <iframe
                      width="100%"
                      height="100%"
                      src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                      title="Tutorial Legado"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full text-zinc-400">
                      Vídeo indisponível
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          ) : (
            <Button
              className={`gap-2 bg-[#00A3FF] hover:bg-[#0082CC] text-white shadow-lg shadow-[#00A3FF]/20 transition-all hover:scale-105`}
            >
              <PlayCircle className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">Tutorial da Página</span>
            </Button>
          )}
        </div>
      </div>
      {showTour && <OnboardingTour onComplete={handleTourComplete} />}
    </header>
  )
}