"use client"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { UserPlus, Check, Lock, Brain } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

// Helper for color interpolation
function lerp(start: number, end: number, t: number) {
    return start * (1 - t) + end * t
}

function DataNetworkBackground({ isSuccess, isError }: { isSuccess: boolean, isError: boolean }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    // Check if we are in a special state
    const isSpecial = isSuccess || isError

    // Multi-factor interpolation: 
    // We can use a single factor `stateFactor` where 0=normal, 1=success, -1=error (or separate vars)
    // For simplicity with lerp, we'll assume only one active at a time.

    // We will use targetColors.
    const progress = useRef(0)

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

            // Colors definition
            const normalBg = { r: 10, g: 10, b: 18 } // #0a0a12
            const successBg = { r: 5, g: 20, b: 10 }   // Dark Green
            const errorBg = { r: 26, g: 5, b: 5 }   // Dark Red

            const normalNode = { r: 147, g: 51, b: 234 } // Purple
            const successNode = { r: 16, g: 185, b: 129 }   // Emerald 500
            const errorNode = { r: 220, g: 38, b: 38 }   // Red

            const normalLine = { r: 59, g: 130, b: 246 } // Blue
            const successLine = { r: 16, g: 185, b: 129 }   // Emerald 500
            const errorLine = { r: 220, g: 38, b: 38 }   // Red

            // Determine Target based on props
            let targetBg = normalBg
            let targetNode = normalNode
            let targetLine = normalLine

            if (isSuccess) {
                targetBg = successBg
                targetNode = successNode
                targetLine = successLine
            } else if (isError) {
                targetBg = errorBg
                targetNode = errorNode
                targetLine = errorLine
            }

            // We implement a simple "current" color storage to smoothly transition
            // Ideally we'd store currentR, currentG, currentB for everything, but let's approximate by lerping the *factor* if we just had 2 states.
            // Since we have 3, we should lerp individual channels or just use a transition factor towards the active target.
            // For now, let's just do a direct channel lerp approach which is cleaner but more verbose state-wise.
            // Actually, notice the React component re-renders when props change. 
            // We can just trust a persistent color state reference if we want super smooth multi-way transitions,
            // OR just hardcode the transition in CSS for the canvas container opacity? No, we need to draw.

            // Let's use a simpler approach: 
            // We always interpolate `currentColors` towards `targetColors`.

            // Note: In the previous successful code, I used a 0->1 factor. 
            // Let's stick effectively to that pattern but allow switching targets.
            // We'll trust the loop to converge.
        }
        // ... (Re-using simpler logic that worked well previously, adapted for 3 states needs more state vars)
    }, [isSuccess, isError])

    // RE-IMPLEMENTATION WITH FULL LOGIC
    // To ensure it works perfectly without complex state overlap managing in a single cleanup ref, 
    // I will use a robust object-based lerp in the frame loop.
    return <CanvasLogic isSuccess={isSuccess} isError={isError} />
}

// Separated logic to keep component clean and hot-reload friendly
function CanvasLogic({ isSuccess, isError }: { isSuccess: boolean, isError: boolean }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    // Store current colors as refs to persist across renders/prop updates
    // Initial: Normal Theme
    const currentColor = useRef({
        bg: { r: 10, g: 10, b: 18 },
        node: { r: 147, g: 51, b: 234 },
        line: { r: 59, g: 130, b: 246 }
    })

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        canvas.width = window.innerWidth
        canvas.height = window.innerHeight

        const nodes: { x: number; y: number; vx: number; vy: number }[] = []
        for (let i = 0; i < 80; i++) {
            nodes.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
            })
        }

        function animate() {
            if (!ctx || !canvas) return

            // Define Targets
            let targetBg = { r: 10, g: 10, b: 18 }
            let targetNode = { r: 147, g: 51, b: 234 }
            let targetLine = { r: 59, g: 130, b: 246 }

            if (isSuccess) {
                targetBg = { r: 5, g: 20, b: 10 }
                targetNode = { r: 16, g: 185, b: 129 }
                targetLine = { r: 16, g: 185, b: 129 }
            } else if (isError) {
                targetBg = { r: 26, g: 5, b: 5 }
                targetNode = { r: 220, g: 38, b: 38 }
                targetLine = { r: 220, g: 38, b: 38 }
            }

            // Lerp current towards target
            const speed = 0.05
            currentColor.current.bg.r = lerp(currentColor.current.bg.r, targetBg.r, speed)
            currentColor.current.bg.g = lerp(currentColor.current.bg.g, targetBg.g, speed)
            currentColor.current.bg.b = lerp(currentColor.current.bg.b, targetBg.b, speed)

            currentColor.current.node.r = lerp(currentColor.current.node.r, targetNode.r, speed)
            currentColor.current.node.g = lerp(currentColor.current.node.g, targetNode.g, speed)
            currentColor.current.node.b = lerp(currentColor.current.node.b, targetNode.b, speed)

            currentColor.current.line.r = lerp(currentColor.current.line.r, targetLine.r, speed)
            currentColor.current.line.g = lerp(currentColor.current.line.g, targetLine.g, speed)
            currentColor.current.line.b = lerp(currentColor.current.line.b, targetLine.b, speed)

            // Draw
            const { bg, node: nColor, line: lColor } = currentColor.current

            ctx.fillStyle = `rgba(${bg.r}, ${bg.g}, ${bg.b}, 0.2)`
            ctx.fillRect(0, 0, canvas.width, canvas.height)

            nodes.forEach((node, i) => {
                node.x += node.vx
                node.y += node.vy
                if (node.x < 0 || node.x > canvas.width) node.vx *= -1
                if (node.y < 0 || node.y > canvas.height) node.vy *= -1

                ctx.beginPath()
                ctx.arc(node.x, node.y, 2, 0, Math.PI * 2)
                ctx.fillStyle = `rgba(${nColor.r}, ${nColor.g}, ${nColor.b}, 0.6)`
                ctx.fill()

                nodes.forEach((otherNode, j) => {
                    if (i === j) return
                    const dx = node.x - otherNode.x
                    const dy = node.y - otherNode.y
                    const dist = Math.sqrt(dx * dx + dy * dy)
                    if (dist < 150) {
                        ctx.beginPath()
                        ctx.moveTo(node.x, node.y)
                        ctx.lineTo(otherNode.x, otherNode.y)
                        ctx.strokeStyle = `rgba(${lColor.r}, ${lColor.g}, ${lColor.b}, ${(1 - dist / 150) * 0.15})`
                        ctx.lineWidth = 0.5
                        ctx.stroke()
                    }
                })
            })
            requestAnimationFrame(animate)
        }
        animate()

        const handleResize = () => {
            if (canvas) {
                canvas.width = window.innerWidth
                canvas.height = window.innerHeight
            }
        }
        window.addEventListener("resize", handleResize)
        return () => window.removeEventListener("resize", handleResize)
    }, [isSuccess, isError])

    return <canvas ref={canvasRef} className="absolute inset-0 transition-colors duration-1000" />
}

function LaserScanner({ isSuccess, isError }: { isSuccess: boolean, isError: boolean }) {
    // Determine color class
    let colorClass = "from-transparent via-blue-400/30 to-transparent"
    if (isSuccess) colorClass = "from-transparent via-green-500/50 to-transparent"
    if (isError) colorClass = "from-transparent via-red-500/50 to-transparent"

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div
                className={`absolute inset-x-0 h-[2px] animate-scan transition-colors duration-500 bg-gradient-to-r ${colorClass}`}
            />
        </div>
    )
}

function UnlockHUD() {
    return (
        <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, type: "spring" }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none"
        >
            <div className="relative">
                <div className="absolute inset-0 bg-green-500/30 blur-2xl rounded-full animate-pulse" />
                <div className="relative z-10 p-6 bg-green-950/40 rounded-full border-2 border-green-500/50 backdrop-blur-md">
                    <Check className="w-16 h-16 text-green-400 shadow-[0_0_15px_rgba(74,222,128,0.8)]" />
                </div>
                <div className="absolute inset-[-20px] rounded-full border border-green-500/30 animate-spin-slow border-t-green-400 border-r-transparent border-b-green-400 border-l-transparent" />
            </div>

            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-8 text-center"
            >
                <p className="text-green-400 font-bold tracking-[0.3em] text-2xl drop-shadow-[0_0_10px_rgba(74,222,128,0.6)]">
                    BEM-VINDO AO SISTEMA!
                </p>
                <p className="text-green-600/80 text-sm tracking-widest mt-2">ACESSO LIBERADO</p>
            </motion.div>
        </motion.div>
    )
}

function LockHUD() {
    return (
        <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{
                scale: [1.5, 1.0],
                opacity: 1,
                rotate: [0, -10, 10, -5, 5, 0]
            }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.5, type: "tween" }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none"
        >
            <div className="relative">
                <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full" />
                <Lock className="w-24 h-24 text-red-500 relative z-10 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]" />
            </div>
            <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 text-red-500 font-bold tracking-[0.2em] text-xl drop-shadow-[0_0_10px_rgba(239,68,68,0.6)]"
            >
                ACESSO NEGADO
            </motion.p>
        </motion.div>
    )
}

export default function RegisterPage() {
    const router = useRouter()
    const [mounted, setMounted] = useState(false)
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        whatsapp: '',
        password: ''
    })
    const [isSuccess, setIsSuccess] = useState(false)
    const [isError, setIsError] = useState(false)

    const handleRegister = async (e: React.MouseEvent | React.FormEvent) => {
        e.preventDefault()

        // Reset states
        setIsSuccess(false)
        setIsError(false)

        try {
            const { data, error } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        full_name: formData.name,
                        whatsapp: formData.whatsapp
                    }
                }
            })

            if (error) {
                throw error
            }

            // Success Animation
            setIsSuccess(true)

            // Redirect after animation
            setTimeout(() => {
                router.push('/dashboard')
            }, 3000)

        } catch (error) {
            console.error('Registration error:', error)
            // Error Animation
            setIsError(true)

            // Reset error state after 2 seconds to allow retry
            setTimeout(() => {
                setIsError(false)
            }, 2000)
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    }

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, "")
        value = value.replace(/^(\d{2})(\d)/g, "($1) $2")
        value = value.replace(/(\d)(\d{4})$/, "$1-$2")
        setFormData(prev => ({ ...prev, whatsapp: value }))
    }

    useEffect(() => {
        setMounted(true)
    }, [])

    // Derived background class
    let bgClass = "bg-[#0a0a12]"
    if (isSuccess) bgClass = "bg-[#050f0a]"
    if (isError) bgClass = "bg-[#1a0505]"

    // Derived gradient class
    let gradientClass = "from-purple-950/30 via-[#0a0a12] to-blue-950/30"
    if (isSuccess) gradientClass = "from-green-950/40 via-transparent to-green-950/40"
    if (isError) gradientClass = "from-red-950/40 via-transparent to-red-950/40"

    // Component Props
    const inputBorderClass = (isErr: boolean) => isErr
        ? "border-red-500/50 focus:border-red-500"
        : "border-white/10 focus:border-cyan-400"

    return (
        <div className={`relative flex min-h-screen items-center justify-center overflow-hidden transition-colors duration-1000 p-4 ${bgClass}`}>

            <DataNetworkBackground isSuccess={isSuccess} isError={isError} />

            <div className={`absolute inset-0 bg-gradient-radial transition-colors duration-1000 ${gradientClass}`} />

            <LaserScanner isSuccess={isSuccess} isError={isError} />

            <AnimatePresence>
                {isSuccess && <UnlockHUD />}
                {isError && <LockHUD />}
            </AnimatePresence>

            <div className={`relative z-10 w-full max-w-md transition-all duration-1000 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>

                {/* Header */}
                <div className={`flex flex-col items-center gap-4 mb-8 transition-all duration-700 delay-100 
                    ${isSuccess ? "opacity-0" : "opacity-100"}
                `}>
                    <div className={`relative flex h-16 w-16 items-center justify-center rounded-2xl shadow-[0_0_40px_rgba(6,182,212,0.6)] transition-colors duration-500
                         ${isError ? "bg-gradient-to-br from-red-600 to-orange-600" : "bg-gradient-to-br from-blue-600 to-cyan-500"}
                    `}>
                        {isError ? <Lock className="h-8 w-8 text-white animate-pulse" /> : <UserPlus className="h-8 w-8 text-white animate-pulse" />}
                        <div className={`absolute inset-0 rounded-2xl border-2 animate-ping opacity-75
                            ${isError ? "border-red-400" : "border-cyan-400"}
                        `} />
                    </div>
                    <h1 className="text-3xl font-bold tracking-wider">
                        Nova
                        <span className={`text-transparent bg-clip-text bg-gradient-to-r transition-colors duration-500
                            ${isError ? "from-red-400 to-orange-500" : "from-cyan-400 to-blue-500"}
                        `}> Conta</span>
                    </h1>
                    <p className="text-sm text-gray-400 tracking-wide text-center">Junte-se à revolução da prospecção com IA</p>
                </div>

                {/* Card */}
                <motion.div
                    animate={isError ? { x: [-10, 10, -10, 10, 0] } : (isSuccess ? { scale: 0.95, opacity: 0 } : { scale: 1, opacity: 1, x: 0 })}
                    transition={{ duration: isError ? 0.4 : 0.5 }}
                    className={`transition-all duration-700 delay-300 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
                >
                    <Card className={`relative backdrop-blur-[20px] bg-white/[0.02] border border-white/[0.05] shadow-2xl overflow-hidden transition-colors duration-500
                         ${isError ? "border-red-500/30" : "border-white/[0.05]"}
                    `}>
                        <div className={`absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent to-transparent transition-colors duration-500
                            ${isError ? "via-red-400/50" : "via-cyan-400/50"}
                        `} />

                        <CardHeader className="space-y-1 pb-4">
                            <CardTitle className="text-xl font-light tracking-wide">Solicitar Acesso</CardTitle>
                            <CardDescription className="text-gray-500">Preencha seus dados para receber sua chave</CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            {/* Inputs */}
                            {[
                                { id: "name", label: "Nome Completo", type: "text", placeholder: "Seu Nome" },
                                { id: "email", label: "E-mail Corporativo", type: "email", placeholder: "voce@empresa.com" },
                                { id: "whatsapp", label: "WhatsApp", type: "text", placeholder: "(11) 99999-9999", max: 15, handler: handlePhoneChange },
                                { id: "password", label: "Senha", type: "password", placeholder: "••••••••" }
                            ].map((field) => (
                                <div key={field.id} className="space-y-2">
                                    <Label htmlFor={field.id} className="text-xs uppercase tracking-widest text-gray-400">
                                        {field.label}
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            id={field.id}
                                            type={field.type}
                                            value={(formData as any)[field.id]}
                                            onChange={field.handler || handleChange}
                                            maxLength={field.max}
                                            placeholder={field.placeholder}
                                            required
                                            className={`border-0 border-b rounded-none bg-transparent focus:ring-0 px-0 text-white placeholder:text-gray-600 transition-all duration-300 ${inputBorderClass(isError)}`}
                                        />
                                    </div>
                                </div>
                            ))}

                            <div className="pt-4">
                                <Button onClick={handleRegister} className={`w-full text-white font-light tracking-wider uppercase text-xs py-6 relative overflow-hidden group transition-all duration-300 
                                     ${isError
                                        ? "bg-red-600 hover:bg-red-700 shadow-[0_0_30px_rgba(220,38,38,0.6)]"
                                        : "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 hover:shadow-[0_0_30px_rgba(6,182,212,0.6)]"}
                                `}>
                                    <span className="relative z-10">{isError ? "Falha no Cadastro" : "Solicitar Minha Chave de Acesso"}</span>
                                    {!isError && <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out" />}
                                </Button>
                            </div>

                            <p className="text-center text-sm text-gray-500 tracking-wide mt-4">
                                Já tem uma chave?{" "}
                                <Link href="/login" className="text-cyan-400 hover:text-cyan-300 transition-colors">
                                    Acessar Sistema
                                </Link>
                            </p>
                        </CardContent>
                    </Card>
                </motion.div>

                <div className={`mt-6 text-center text-xs text-gray-600 tracking-widest transition-all duration-700 delay-1100 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"} ${isSuccess ? "opacity-0" : "opacity-100"}`}>
                    SECURE ENCRYPTED REGISTRATION
                </div>
            </div>

            <style jsx>{`
        @keyframes scan {
          0% { top: -2px; }
          100% { top: 100%; }
        }
        .animate-scan {
          animation: scan 8s linear infinite;
        }
        @keyframes spin-slow {
           from { transform: rotate(0deg); }
           to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
            animation: spin-slow 8s linear infinite;
        }
      `}</style>
        </div>
    )
}
