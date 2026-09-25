"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PinPrompt } from "@/components/billing/pin-prompt";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, QrCode } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface InvoiceDetailsClientProps {
  initialAuthorized: boolean;
  hasPin: boolean;
  invoice: any;
  items: any[];
  invoiceId: string;
}

export function InvoiceDetailsClient({ initialAuthorized, hasPin, invoice, items, invoiceId }: InvoiceDetailsClientProps) {
  const [isAuthorized, setIsAuthorized] = useState(initialAuthorized);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    // Se não estiver autorizado e houver PIN, força o refresh dos dados ao autorizar
    if (!initialAuthorized && isAuthorized) {
      router.refresh();
    }
  }, [isAuthorized, initialAuthorized, router]);

  const handleCopyPix = () => {
    if (invoice?.pix_copy_paste) {
      navigator.clipboard.writeText(invoice.pix_copy_paste);
      toast({ title: "Copiado", description: "Código Pix copia e cola copiado para a área de transferência." });
    }
  };

  if (hasPin && !isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <PinPrompt 
          isOpen={true} 
          onSuccess={() => setIsAuthorized(true)} 
          onCancel={() => router.push("/faturas")}
        />
      </div>
    );
  }

  if (!invoice) {
    return <div className="text-center p-8">Carregando detalhes da fatura...</div>;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid": return <Badge className="bg-green-500 text-lg py-1 px-4">Paga</Badge>;
      case "pending": return <Badge variant="outline" className="text-yellow-600 border-yellow-600 text-lg py-1 px-4">Pendente</Badge>;
      case "overdue": return <Badge variant="destructive" className="text-lg py-1 px-4">Atrasada</Badge>;
      default: return <Badge variant="secondary" className="text-lg py-1 px-4">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fatura #{invoice.id.split('-')[0].toUpperCase()}</h1>
          <p className="text-muted-foreground mt-1">
            Vencimento em {format(new Date(invoice.due_date), "dd 'de' MMMM, yyyy", { locale: ptBR })}
          </p>
        </div>
        <div>
          {getStatusBadge(invoice.status)}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Detalhes da Cobrança</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {items.length > 0 ? items.map((item) => (
                  <li key={item.id} className="flex justify-between border-b pb-2">
                    <span>{item.description}</span>
                    <span className="font-medium">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.amount)}
                    </span>
                  </li>
                )) : (
                  <li className="flex justify-between border-b pb-2">
                    <span>Mensalidade / Plano Base</span>
                    <span className="font-medium">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(invoice.amount)}
                    </span>
                  </li>
                )}
                <li className="flex justify-between pt-2 text-xl font-bold">
                  <span>Total</span>
                  <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(invoice.amount)}</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {invoice.status === 'pending' || invoice.status === 'overdue' ? (
            <Card className="border-primary/50 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5" /> Pagamento
                </CardTitle>
                <CardDescription>
                  Escolha como deseja pagar esta fatura.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* PIX AREA */}
                {invoice.pix_qr_code && invoice.pix_copy_paste ? (
                  <div className="space-y-4">
                    <p className="font-medium">Pagar via Pix</p>
                    <div className="flex justify-center p-4 bg-white rounded-lg border">
                      <img src={`data:image/png;base64,${invoice.pix_qr_code}`} alt="QR Code Pix" className="w-48 h-48" />
                    </div>
                    <Button variant="secondary" className="w-full gap-2" onClick={handleCopyPix}>
                      <Copy className="h-4 w-4" /> Copiar Código Pix
                    </Button>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground text-center">Pix indisponível no momento.</div>
                )}
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-primary/5 px-2 text-muted-foreground">ou</span>
                  </div>
                </div>

                {/* CARTÃO DE CRÉDITO / ASAAS LINK */}
                <div>
                  <p className="font-medium mb-4">Cartão de Crédito ou Boleto</p>
                  <Button 
                    className="w-full gap-2" 
                    onClick={() => {
                      if(invoice.asaas_payment_link) {
                        window.open(invoice.asaas_payment_link, "_blank");
                      }
                    }}
                    disabled={!invoice.asaas_payment_link}
                  >
                    <ExternalLink className="h-4 w-4" /> Pagar no ambiente Seguro
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-8 text-center space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-2">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                </div>
                <h3 className="text-2xl font-bold text-green-800">Fatura Paga!</h3>
                <p className="text-green-700">Obrigado pelo seu pagamento.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
