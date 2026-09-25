"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Loader2 } from "lucide-react";

export function PinUnlock() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (pin.length < 4) {
      toast.error("O PIN deve ter pelo menos 4 dígitos");
      return;
    }
    
    setIsLoading(true);
    try {
      const res = await fetch("/api/invoices/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        toast.success("Acesso Liberado!");
        // Limpar o campo e forçar o re-render do servidor
        setPin("");
        router.refresh();
      } else {
        toast.error(data.error || "PIN Incorreto");
        setPin(""); // Limpa para tentar novamente
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro ao validar PIN");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-[80vh] w-full items-center justify-center p-6 animate-in fade-in zoom-in duration-500">
      <div className="relative max-w-md w-full">
        {/* Background Glow Effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl blur opacity-20 pointer-events-none" />

        <Card className="relative border-blue-500/20 shadow-2xl overflow-hidden backdrop-blur-sm bg-background/95">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 to-purple-500" />

          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10">
              <Lock className="h-8 w-8 text-blue-500" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Área Protegida</CardTitle>
            <CardDescription className="text-base mt-2">
              Esta seção contém informações financeiras confidenciais.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleUnlock} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Digite seu PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  maxLength={8}
                  className="text-center text-2xl tracking-widest h-14 bg-black/50"
                  autoFocus
                />
              </div>
              <Button
                type="submit"
                disabled={isLoading || pin.length < 4}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium text-lg"
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Desbloquear Faturas"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
