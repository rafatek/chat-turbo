"use client"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"

function lerp(start: number, end: number, t: number) {
  return start * (1 - t) + end * t
}

function DataNetworkBackground({ isError }: { isError: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const errorFactor = useRef(0)
  const requestRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    window.addEventListener("resize", resize)
    resize()

    const nodes: { x: number; y: number; vx: number; vy: number }[] = []
    for (let i = 0; i < 80; i++) {
      nodes.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
      })
    }

    const animate = () => {
      const targetFactor = isError ? 1 : 0
      errorFactor.current = lerp(errorFactor.current, targetFactor, 0.1)

      const rBg = lerp(5, 26, errorFactor.current)
      const gBg = lerp(5, 5, errorFactor.current)
      const bBg = lerp(8, 5, errorFactor.current)

      ctx.fillStyle = `rgba(${rBg}, ${gBg}, ${bBg}, 0.3)`
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      nodes.forEach((node, i) => {
        node.x += node.vx
        node.y += node.vy
        if (node.x < 0 || node.x > canvas.width) node.vx *= -1
        if (node.y < 0 || node.y > canvas.height) node.vy *= -1

        ctx.beginPath()
        ctx.arc(node.x, node.y, 2, 0, Math.PI * 2)
        ctx.fillStyle = isError ? "rgba(220, 38, 38, 0.6)" : "rgba(0, 163, 255, 0.6)"
        ctx.fill()

        for (let j = i + 1; j < nodes.length; j++) {
          const other = nodes[j]
          const dist = Math.sqrt((node.x - other.x) ** 2 + (node.y - other.y) ** 2)
          if (dist < 150) {
            ctx.beginPath()
            ctx.moveTo(node.x, node.y)
            ctx.lineTo(other.x, other.y)
            ctx.strokeStyle = isError 
              ? `rgba(220, 38, 38, ${(1 - dist / 150) * 0.2})` 
              : `rgba(0, 163, 255, ${(1 - dist / 150) * 0.2})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      })
      requestRef.current = requestAnimationFrame(animate)
    }

    animate()
    return () => {
      window.removeEventListener("resize", resize)
      cancelAnimationFrame(requestRef.current)
    }
  }, [isError])

  return <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none" />
}

export default function LoginPage() {
  const [mounted, setMounted] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isError, setIsError] = useState(false)
  const router = useRouter()

  useEffect(() => { setMounted(true) }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsError(false)
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        console.error("Erro ao autenticar:", error.message)
        setIsError(true)
        setTimeout(() => setIsError(false), 2000)
        return
      }

      router.refresh()
      router.push("/dashboard")
    } catch (error) {
      console.error("Erro inesperado:", error)
      setIsError(true)
      setTimeout(() => setIsError(false), 2000)
    }
  }

  if (!mounted) return null

  return (
    <div className={`relative flex min-h-screen flex-col items-center justify-center p-4 transition-colors duration-500 bg-[#050508]`}>
      
      <DataNetworkBackground isError={isError} />
      
      <div className={`fixed inset-0 z-[1] pointer-events-none transition-colors duration-500
        ${isError ? "bg-gradient-to-b from-red-950/20 via-transparent to-red-950/20" : "bg-gradient-to-b from-blue-900/10 via-transparent to-black/80"}`}
      />

      <div className="relative z-10 w-full max-w-md py-12">
        <div className="flex flex-col items-center mb-10 text-center">
          <img 
            src="/apple-icon.png" 
            alt="Legado" 
            className="h-60 w-auto object-contain drop-shadow-[0_0_35px_rgba(0,163,255,0.5)]"
          />
          <p className="text-[11px] text-white font-black uppercase tracking-[0.6em] mt-2">
            Performance em Integrações & Escala
          </p>
        </div>

        <motion.div animate={isError ? { x: [-10, 10, -10, 10, 0] } : { x: 0 }} transition={{ duration: 0.4 }}>
          <Card className={`backdrop-blur-3xl bg-white/[0.01] border transition-colors duration-500 shadow-2xl
            ${isError ? "border-red-500/30" : "border-white/[0.06]"}`}>
            
            <CardHeader className="text-center border-b border-white/[0.05]">
              <CardTitle className="text-xl font-light tracking-widest text-white uppercase">Acesso Restrito</CardTitle>
              <CardDescription className="text-gray-500 text-[9px] uppercase tracking-[0.3em]">Operação Legado Performance Digital</CardDescription>
            </CardHeader>

            <CardContent className="space-y-6 pt-8">
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold ml-1">ID de Acesso</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ADMIN@LEGADO.DIGITAL" required
                    className="border-0 border-b rounded-none bg-transparent focus:ring-0 px-0 text-white border-white/10 focus:border-[#00A3FF] uppercase" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold ml-1">Chave Mestra</Label>
                    <Link href="/forgot-password" title="Recuperar" className="text-[9px] uppercase tracking-widest text-[#00A3FF] hover:text-white transition-colors">Esqueceu?</Link>
                  </div>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required
                    className="border-0 border-b rounded-none bg-transparent focus:ring-0 px-0 text-white border-white/10 focus:border-[#00A3FF]" />
                </div>

                <Button type="submit" className={`w-full h-12 text-[11px] font-black uppercase tracking-[0.3em] transition-all duration-300 
                  ${isError ? "bg-red-600 shadow-[0_4px_20px_rgba(220,38,38,0.3)]" : "bg-[#00A3FF] hover:bg-[#0082CC] shadow-[0_4px_30px_rgba(0,163,255,0.4)]"}`}>
                  {isError ? "ACESSO NEGADO" : "CONECTAR AO SISTEMA"}
                </Button>
              </form>

              <div className="pt-4 text-center">
                 <p className="text-[9px] text-white/40 uppercase tracking-widest font-black">
                    Legado Performance Digital © 2026
                 </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="fixed inset-0 pointer-events-none z-[5] overflow-hidden">
        <div className={`absolute inset-x-0 h-[1px] opacity-10 animate-scan ${isError ? "bg-red-500" : "bg-[#00A3FF]"}`} />
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scan { 0% { top: -5% } 100% { top: 105% } }
        .animate-scan { animation: scan 8s linear infinite; }
      `}} />
    </div>
  )
}