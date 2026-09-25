"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
interface PinPromptProps {
  isOpen: boolean;
  onSuccess: () => void;
  onCancel?: () => void;
}

export function PinPrompt({ isOpen, onSuccess, onCancel }: PinPromptProps) {
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Pega o device_id do localStorage ou gera um novo
      let deviceId = localStorage.getItem("billing_device_id");
      if (!deviceId) {
        // Usa a API nativa do navegador para gerar o UUID
        deviceId = typeof crypto !== 'undefined' && crypto.randomUUID 
          ? crypto.randomUUID() 
          : Math.random().toString(36).substring(2) + Date.now().toString(36);
        localStorage.setItem("billing_device_id", deviceId);
      }

      const res = await fetch("/api/invoices/verify-pin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pin, device_id: deviceId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao validar PIN");
      }

      // Sucesso
      setPin("");
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && onCancel) onCancel() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Acesso Restrito</DialogTitle>
          <DialogDescription>
            Digite o seu PIN de segurança para acessar os detalhes da fatura.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col space-y-2">
            <Input
              type="password"
              placeholder="Digite seu PIN..."
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="text-center text-lg tracking-widest"
              maxLength={6}
              required
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                Cancelar
              </Button>
            )}
            <Button type="submit" disabled={isLoading || pin.length < 4}>
              {isLoading ? "Validando..." : "Acessar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
