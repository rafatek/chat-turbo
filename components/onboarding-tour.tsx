"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { X, Sparkles } from "lucide-react"

interface OnboardingTourProps {
    onComplete: () => void
}

export function OnboardingTour({ onComplete }: OnboardingTourProps) {
    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-start justify-end p-6 bg-black/60 backdrop-blur-[2px]"
            >
                <div className="absolute inset-0 z-0" onClick={onComplete} />

                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: 0.2, type: "spring" }}
                    className="relative z-10 w-full max-w-sm mt-20 mr-4"
                >
                    {/* Connecting Line/Arrow to the button */}
                    <div className="absolute -top-16 right-8 flex flex-col items-center">
                        <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 40 }}
                            transition={{ delay: 0.5, duration: 0.5 }}
                            className="w-0.5 bg-gradient-to-b from-[#00A3FF] to-transparent"
                        />
                        <motion.div
                            animate={{ y: [0, -5, 0] }}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                        >
                            <div className="w-3 h-3 rounded-full bg-[#00A3FF] shadow-[0_0_15px_rgba(0,163,255,1)]" />
                        </motion.div>
                    </div>

                    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0A0A0C]/90 shadow-2xl backdrop-blur-xl">
                        {/* Animated Border Gradient */}
                        <div className="absolute inset-0 bg-gradient-to-r from-[#00A3FF]/20 via-blue-500/10 to-[#00A3FF]/20 animate-gradient-xy opacity-50" />

                        <div className="relative p-6 space-y-4">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 rounded-lg bg-[#00A3FF]/10 border border-[#00A3FF]/20">
                                        <Sparkles className="w-5 h-5 text-[#00A3FF]" />
                                    </div>
                                    <h3 className="font-bold text-lg text-white tracking-tight">
                                        Bem-vindo ao <span className="text-[#00A3FF]">Legado</span>
                                    </h3>
                                </div>
                                <button
                                    onClick={onComplete}
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-2">
                                <p className="text-sm text-gray-300 leading-relaxed">
                                    Preparamos um material exclusivo para você dominar nossa ferramenta de inteligência.
                                </p>
                                <p className="text-sm text-gray-400">
                                    Sempre que tiver dúvidas sobre uma tela, clique em <strong className="text-white">Tutorial da Página</strong> para assistir a um guia prático.
                                </p>
                            </div>

                            <div className="pt-2">
                                <Button
                                    onClick={onComplete}
                                    className="w-full bg-[#00A3FF] hover:bg-[#0082CC] text-white border-0 shadow-lg shadow-blue-900/20 font-bold uppercase text-[10px] tracking-[0.2em]"
                                >
                                    Começar Operação
                                </Button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}