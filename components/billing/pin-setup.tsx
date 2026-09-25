"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, ShieldAlert, Lock, Unlock } from "lucide-react";

export function PinSetup({ hasPin }: { hasPin: boolean }) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [oldPin, setOldPin] = useState("");
  const [isRemoving, setIsRemoving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSetup = async () => {
    if (pin.length < 4) {
      toast.error("O PIN deve ter pelo menos 4 dígitos");
      return;
    }
    
    setIsLoading(true);
    try {
      const res = await fetch("/api/invoices/setup-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      
      const data = await res.json();
      if (res.ok) {
        toast.success("PIN configurado com sucesso!");
        setPin("");
        router.refresh();
      } else {
        toast.error(data.error || "Erro ao configurar PIN");
      }
    } catch (e) {
      toast.error("Erro interno");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async () => {
    if (oldPin.length < 4) {
      toast.error("Digite seu PIN atual para remover a proteção");
      return;
    }
    
    setIsLoading(true);
    try {
      const res = await fetch("/api/invoices/setup-pin", { 
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: oldPin }),
      });
      const data = await res.json();
      
      if (res.ok) {
        toast.success("Proteção removida com sucesso!");
        setOldPin("");
        setIsRemoving(false);
        router.refresh();
      } else {
        toast.error(data.error || "Erro ao remover PIN");
      }
    } catch (e) {
      toast.error("Erro interno");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-muted/50 border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {hasPin ? <Shield className="h-5 w-5 text-green-500" /> : <ShieldAlert className="h-5 w-5 text-yellow-500" />}
          Segurança da Fatura
        </CardTitle>
        <CardDescription>
          {hasPin 
            ? "Suas faturas estão protegidas. Será necessário um PIN para visualizá-las."
            : "Adicione um PIN de 4 dígitos para proteger suas faturas contra acessos não autorizados."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasPin ? (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="Digite o PIN (mínimo 4 dígitos)"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                maxLength={8}
              />
              <Button onClick={handleSetup} disabled={isLoading || pin.length < 4}>
                <Lock className="w-4 h-4 mr-2" />
                Salvar PIN
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-4 bg-background rounded-lg border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-green-500" />
                <div>
                  <p className="font-medium text-sm">PIN Ativado</p>
                  <p className="text-xs text-muted-foreground">Faturas protegidas</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsRemoving(!isRemoving)} 
                className="text-red-500 hover:text-red-600"
              >
                <Unlock className="w-4 h-4 mr-2" />
                {isRemoving ? "Cancelar" : "Remover"}
              </Button>
            </div>
            
            {isRemoving && (
              <div className="flex gap-2 mt-2 pt-4 border-t border-dashed">
                <Input
                  type="password"
                  placeholder="Digite seu PIN atual para confirmar"
                  value={oldPin}
                  onChange={(e) => setOldPin(e.target.value)}
                  maxLength={8}
                />
                <Button 
                  onClick={handleRemove} 
                  disabled={isLoading || oldPin.length < 4}
                  variant="destructive"
                >
                  Confirmar
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
