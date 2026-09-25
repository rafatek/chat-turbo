"use client"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

export function ProspectingConfigSheet({ open, onOpenChange }: any) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-[#0A0A12] border-white/5 text-white sm:max-w-[540px]">
        <SheetHeader>
          <SheetTitle className="text-[#00A3FF] font-bold uppercase tracking-widest">
            Configuração de Prospecção
          </SheetTitle>
          <SheetDescription className="text-gray-500 text-xs">
            Módulo de Inteligência de Prospecção Legado
          </SheetDescription>
        </SheetHeader>
        
        <div className="flex flex-col items-center justify-center h-[400px] border border-dashed border-white/10 rounded-xl mt-8">
          <p className="text-[10px] text-gray-600 uppercase tracking-[0.3em] text-center px-10">
            Aguardando sincronização final de API com o servidor Legado...
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}