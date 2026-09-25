import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import { cookies } from "next/headers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PinSetup } from "@/components/billing/pin-setup";
import { PinUnlock } from "@/components/billing/pin-unlock";
import { FileText, CreditCard } from "lucide-react";
import { listAsaasPayments } from "@/lib/asaas";

export default async function FaturasPage() {
  const supabase = await createClient();

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("asaas_customer_id, invoice_pin")
    .eq("id", session.user.id)
    .single();

  const hasPin = !!profile?.invoice_pin;
  let isUnlocked = !hasPin;

  // Lógica Zero Trust: Verifica a sessão do PIN se ele existir
  if (hasPin) {
    const cookieStore = await cookies();
    const deviceId = cookieStore.get('device_id')?.value;
    
    if (deviceId) {
      // Verifica se a sessão existe e não expirou
      const { data: pinSession } = await supabase
        .from('invoice_pin_sessions')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('device_id', deviceId)
        .gt('expires_at', new Date().toISOString())
        .single();
        
      if (pinSession) {
        isUnlocked = true;
      }
    }
  }

  // Se tem PIN mas não está desbloqueado, interrompe e mostra o bloqueio
  if (hasPin && !isUnlocked) {
    return (
      <div className="flex flex-col gap-6 p-6 h-full">
        <div className="flex flex-col gap-2 mb-4">
          <h1 className="text-3xl font-bold tracking-tight">Faturas & Pagamentos</h1>
          <p className="text-muted-foreground">Área protegida por PIN.</p>
        </div>
        <PinUnlock />
      </div>
    );
  }

  let invoices: any[] = [];
  if (profile?.asaas_customer_id) {
    try {
      const res = await listAsaasPayments(profile.asaas_customer_id);
      if (res.data) invoices = res.data;
    } catch (e) {
      console.error("Erro ao buscar faturas no Asaas:", e);
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "RECEIVED": 
      case "CONFIRMED":
        return <Badge className="bg-green-500">Paga</Badge>;
      case "PENDING": return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Pendente</Badge>;
      case "OVERDUE": return <Badge variant="destructive">Atrasada</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const pendingInvoices = invoices.filter(i => i.status === 'PENDING' || i.status === 'OVERDUE');
  const paidInvoices = invoices.filter(i => i.status === 'RECEIVED' || i.status === 'CONFIRMED');

  const pendingSubscription = pendingInvoices.filter(i => i.subscription);
  const pendingAvulsas = pendingInvoices.filter(i => !i.subscription);

  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto custom-scrollbar pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Faturas & Pagamentos</h1>
        <p className="text-muted-foreground">
          Gerencie suas cobranças e pague suas faturas geradas no Asaas.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Sessão de Segurança PIN */}
        <PinSetup hasPin={hasPin} />

        <Card className="bg-muted/50 border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" /> Formas de Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Você pode pagar suas faturas através do Pix direto no QR Code ou Copia e Cola.
            Pagamentos via Cartão de Crédito irão redirecioná-lo para um ambiente 100% seguro da nossa processadora Asaas.
          </CardContent>
        </Card>
      </div>
      
      <div className="mt-8 space-y-10">
        
        {/* ASSINATURA PENDENTE */}
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-500" /> Assinatura Mensal (A Pagar)
          </h2>
          {pendingSubscription.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma fatura de assinatura pendente no momento.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pendingSubscription.map((invoice: any) => (
                <Card key={invoice.id} className="border-blue-500/30 hover:border-blue-500/60 transition-colors bg-blue-500/5">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg flex items-center gap-2">
                        Fatura #{invoice.invoiceNumber || invoice.id.split('_')[1] || invoice.id.substring(0, 8)}
                      </CardTitle>
                      {getStatusBadge(invoice.status)}
                    </div>
                    <CardDescription className="mt-2 text-xs truncate">
                      {invoice.description || "Plano Base"}
                    </CardDescription>
                    <CardDescription className="mt-1">
                      Vencimento: {format(new Date(invoice.dueDate), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold mb-4 text-blue-400">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(invoice.value)}
                    </p>
                    <Link href={invoice.invoiceUrl} target="_blank">
                      <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                        Pagar Assinatura
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* COBRANÇAS AVULSAS PENDENTES */}
        {pendingAvulsas.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-purple-500" /> Cobranças Avulsas (A Pagar)
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pendingAvulsas.map((invoice: any) => (
                <Card key={invoice.id} className="border-purple-500/30 hover:border-purple-500/60 transition-colors bg-purple-500/5">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg flex items-center gap-2">
                        Fatura #{invoice.invoiceNumber || invoice.id.split('_')[1] || invoice.id.substring(0, 8)}
                      </CardTitle>
                      {getStatusBadge(invoice.status)}
                    </div>
                    <CardDescription className="mt-2 text-xs truncate">
                      {invoice.description || "Pagamento Adicional"}
                    </CardDescription>
                    <CardDescription className="mt-1">
                      Vencimento: {format(new Date(invoice.dueDate), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold mb-4 text-purple-400">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(invoice.value)}
                    </p>
                    <Link href={invoice.invoiceUrl} target="_blank">
                      <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                        Pagar Fatura Avulsa
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* HISTÓRICO DE PAGOS */}
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-green-500" /> Histórico de Pagamentos (Pagos)
          </h2>
          {paidInvoices.length === 0 ? (
            <div className="text-center p-8 border rounded-lg bg-muted/20">
              <p className="text-muted-foreground">Nenhum histórico de pagamento encontrado.</p>
            </div>
          ) : (
            <div className="rounded-md border border-white/10 bg-card/50 overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-white/5 text-gray-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Vencimento</th>
                    <th className="px-4 py-3 font-medium">Descrição</th>
                    <th className="px-4 py-3 font-medium">Tipo</th>
                    <th className="px-4 py-3 font-medium">Valor</th>
                    <th className="px-4 py-3 font-medium text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {paidInvoices.map((invoice: any) => (
                    <tr key={invoice.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {format(new Date(invoice.dueDate), "dd/MM/yyyy")}
                      </td>
                      <td className="px-4 py-3 truncate max-w-[200px]" title={invoice.description}>
                        {invoice.description || (invoice.subscription ? "Plano Base" : "Avulso")}
                      </td>
                      <td className="px-4 py-3">
                        {invoice.subscription ? (
                          <span className="text-blue-400 text-xs bg-blue-500/10 px-2 py-1 rounded">Assinatura</span>
                        ) : (
                          <span className="text-purple-400 text-xs bg-purple-500/10 px-2 py-1 rounded">Avulsa</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-green-400">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(invoice.value)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={invoice.invoiceUrl} target="_blank">
                          <Button variant="ghost" size="sm" className="h-8 text-xs hover:bg-white/10">Ver Recibo</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
