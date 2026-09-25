"use client"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Brain, Lock, ArrowLeft, Mail } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from "framer-motion"

// Helper for color interpolation
function lerp(start: number, end: number, t: number) {
    return start * (1 - t) + end * t
}

function DataNetworkBackground({ isError }: { isError: boolean }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    // Ref to store current interpolation state (0 = normal, 1 = error)
    const errorFactor = useRef(0)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext("2d")
        if (!ctx) return

        canvas.width = window.innerWidth
        canvas.height = window.innerHeight

        const nodes: { x: number; y: number; vx: number; vy: number }[] = []
        const nodeCount = 80

        // Create nodes (leads)
        for (let i = 0; i < nodeCount; i++) {
            nodes.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
            })
        }

        function animate() {
            if (!ctx || !canvas) return

            // Smoothly interpolate error factor towards target (0 or 1)
            const targetFactor = isError ? 1 : 0
            errorFactor.current = lerp(errorFactor.current, targetFactor, 0.1)

            // Base colors
            const normalBg = { r: 10, g: 10, b: 18 } // #0a0a12
            const errorBg = { r: 26, g: 5, b: 5 }   // Dark Red

            const normalNode = { r: 147, g: 51, b: 234 } // Purple
            const errorNode = { r: 220, g: 38, b: 38 }   // Red

            const normalLine = { r: 59, g: 130, b: 246 } // Blue
            const errorLine = { r: 220, g: 38, b: 38 }   // Red

            // Calculate current colors based on errorFactor
            const rBg = lerp(normalBg.r, errorBg.r, errorFactor.current)
            const gBg = lerp(normalBg.g, errorBg.g, errorFactor.current)
            const bBg = lerp(normalBg.b, errorBg.b, errorFactor.current)

            const rNode = lerp(normalNode.r, errorNode.r, errorFactor.current)
            const gNode = lerp(normalNode.g, errorNode.g, errorFactor.current)
            const bNode = lerp(normalNode.b, errorNode.b, errorFactor.current)

            const rLine = lerp(normalLine.r, errorLine.r, errorFactor.current)
            const gLine = lerp(normalLine.g, errorLine.g, errorFactor.current)
            const bLine = lerp(normalLine.b, errorLine.b, errorFactor.current)

            // Clear/Fill background
            ctx.fillStyle = `rgba(${rBg}, ${gBg}, ${bBg}, 0.2)`
            ctx.fillRect(0, 0, canvas.width, canvas.height)

            // Update and draw nodes
            nodes.forEach((node, i) => {
                node.x += node.vx
                node.y += node.vy

                // Bounce off edges
                if (node.x < 0 || node.x > canvas.width) node.vx *= -1
                if (node.y < 0 || node.y > canvas.height) node.vy *= -1

                // Draw node
                ctx.beginPath()
                ctx.arc(node.x, node.y, 2, 0, Math.PI * 2)
                ctx.fillStyle = `rgba(${rNode}, ${gNode}, ${bNode}, 0.6)`
                ctx.fill()

                // Draw connections
                nodes.forEach((otherNode, j) => {
                    if (i === j) return
                    const dx = node.x - otherNode.x
                    const dy = node.y - otherNode.y
                    const distance = Math.sqrt(dx * dx + dy * dy)

                    if (distance < 150) {
                        ctx.beginPath()
                        ctx.moveTo(node.x, node.y)
                        ctx.lineTo(otherNode.x, otherNode.y)
                        const opacity = (1 - distance / 150) * 0.15
                        ctx.strokeStyle = `rgba(${rLine}, ${gLine}, ${bLine}, ${opacity})`
                        ctx.lineWidth = 0.5
                        ctx.stroke()
                    }
                })
            })

            requestAnimationFrame(animate)
        }

        animate()

        const handleResize = () => {
            canvas.width = window.innerWidth
            canvas.height = window.innerHeight
        }

        window.addEventListener("resize", handleResize)
        return () => window.removeEventListener("resize", handleResize)
    }, [isError])

    return <canvas ref={canvasRef} className="absolute inset-0 transition-colors duration-1000" />
}

function LaserScanner({ isError }: { isError: boolean }) {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div
                className={`absolute inset-x-0 h-[2px] animate-scan transition-colors duration-500 
          ${isError ? "bg-gradient-to-r from-transparent via-red-500/50 to-transparent" : "bg-gradient-to-r from-transparent via-blue-400/30 to-transparent"}
        `}
            />
        </div>
    )
}

export default function ForgotPasswordPage() {
    const [mounted, setMounted] = useState(false)
    const [email, setEmail] = useState('')
    const [isError, setIsError] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [message, setMessage] = useState('')

    const handleReset = async (e: React.MouseEvent | React.FormEvent) => {
        e.preventDefault()
        setIsError(false)
        setIsSuccess(false)
        setMessage('')
        setIsLoading(true)

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
            })

            if (error) {
                setIsError(true)
                setMessage(error.message)
            } else {
                setIsSuccess(true)
                setMessage('Verifique seu e-mail para continuar a redefinição.')
            }
        } catch (err) {
            setIsError(true)
            setMessage('Ocorreu um erro inesperado.')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        setMounted(true)
    }, [])

    return (
        <div className={`relative flex min-h-screen items-center justify-center overflow-hidden transition-colors duration-500 p-4 
      ${isError ? "bg-[#1a0505]" : "bg-[#0a0a12]"}`}
        >
            <DataNetworkBackground isError={isError} />

            <div
                className={`absolute inset-0 bg-gradient-radial transition-colors duration-500
        ${isError
                        ? "from-red-950/40 via-transparent to-red-950/40"
                        : "from-purple-950/30 via-[#0a0a12] to-blue-950/30"
                    }`}
            />

            <LaserScanner isError={isError} />

            <div
                className={`relative z-10 w-full max-w-md transition-all duration-1000 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                    }`}
            >
                <div
                    className={`flex flex-col items-center gap-4 mb-8 transition-all duration-700 delay-100 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                        }`}
                >
                    <div className={`relative flex h-16 w-16 items-center justify-center rounded-2xl shadow-[0_0_40px_rgba(147,51,234,0.6)] transition-colors duration-500
            ${isError ? "bg-gradient-to-br from-red-600 to-orange-600" : "bg-gradient-to-br from-blue-600 to-purple-600"}
          `}>
                        <Mail className="h-9 w-9 text-white" />

                        <div className={`absolute inset-0 rounded-2xl border-2 animate-ping opacity-75 transition-colors duration-500
              ${isError ? "border-red-400" : "border-blue-400"}
            `} />
                    </div>
                    <h1 className="text-3xl font-bold tracking-wider">
                        Recuperar
                        <span className={`transition-colors duration-500 text-transparent bg-clip-text 
              ${isError ? "bg-gradient-to-r from-red-400 to-orange-500" : "bg-gradient-to-r from-blue-400 to-purple-500"}
            `}>
                            Senha
                        </span>
                    </h1>
                </div>

                <motion.div
                    animate={isError ? { x: [-10, 10, -10, 10, 0] } : { x: 0 }}
                    transition={{ duration: 0.4 }}
                    className={`transition-all duration-700 delay-300 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                        }`}
                >
                    <Card className={`relative backdrop-blur-[20px] bg-white/[0.02] border transition-colors duration-500 shadow-2xl overflow-hidden
            ${isError ? "border-red-500/30" : "border-white/[0.05]"}
          `}>
                        <div className={`absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent to-transparent transition-colors duration-500
              ${isError ? "via-red-400/50" : "via-blue-400/50"}
            `} />

                        <CardHeader className="space-y-1 pb-4">
                            <CardTitle className="text-xl font-light tracking-wide">Esqueceu sua senha?</CardTitle>
                            <CardDescription className="text-gray-500">
                                Digite seu e-mail para receber um link de redefinição.
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-6">
                            {!isSuccess ? (
                                <>
                                    <form onSubmit={handleReset} className="space-y-6">
                                        <div
                                            className={`space-y-2 transition-all duration-700 delay-500 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                                                }`}
                                        >
                                            <Label htmlFor="email" className="text-xs uppercase tracking-widest text-gray-400">
                                                E-mail
                                            </Label>
                                            <div className="relative">
                                                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                                                    id="email"
                                                    placeholder="seu@email.com"
                                                    required
                                                    className={`border-0 border-b rounded-none bg-transparent focus:ring-0 px-0 text-white placeholder:text-gray-600 transition-all duration-300
                            ${isError ? "border-red-500/50 focus:border-red-500" : "border-white/10 focus:border-blue-400"}
                            `}
                                                />
                                            </div>
                                        </div>

                                        {message && (
                                            <div className={`text-sm ${isError ? "text-red-400" : "text-green-400"}`}>
                                                {message}
                                            </div>
                                        )}

                                        <div
                                            className={`transition-all duration-700 delay-900 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                                                }`}
                                        >
                                            <Button type="submit" disabled={isLoading} className={`w-full text-white font-light tracking-wider uppercase text-sm py-6 relative overflow-hidden group transition-all duration-300 
                        ${isError
                                                    ? "bg-red-600 hover:bg-red-700 shadow-[0_0_30px_rgba(220,38,38,0.6)]"
                                                    : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 hover:shadow-[0_0_30px_rgba(59,130,246,0.6)]"}
                        `}>
                                                <span className="relative z-10">{isLoading ? "Enviando..." : "Enviar Link de Recuperação"}</span>
                                                {!isError && (
                                                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out" />
                                                )}
                                            </Button>
                                        </div>
                                    </form>
                                </>
                            ) : (
                                <div className="text-center space-y-4">
                                    <div className="text-green-400 text-sm">{message}</div>
                                    <Button asChild variant="ghost" className="text-gray-400 hover:text-white">
                                        <Link href="/login">Voltar para o Login</Link>
                                    </Button>
                                </div>
                            )}

                            <div className="flex justify-center pt-2">
                                <Link href="/login" className="flex items-center text-xs text-gray-500 hover:text-blue-400 transition-colors gap-2">
                                    <ArrowLeft className="w-3 h-3" /> Voltar para Login
                                </Link>
                            </div>

                        </CardContent>
                    </Card>
                </motion.div>
            </div>

            <style jsx>{`
        @keyframes scan {
          0% {
            top: -2px;
          }
          100% {
            top: 100%;
          }
        }
        .animate-scan {
          animation: scan 8s linear infinite;
        }
      `}</style>
        </div>
    )
}
