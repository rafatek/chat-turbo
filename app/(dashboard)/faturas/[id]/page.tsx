import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { InvoiceDetailsClient } from "./invoice-details-client";

export default async function FaturaDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const invoiceId = resolvedParams.id;
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  // Busca se o usuário tem PIN configurado
  const { data: profile } = await supabase
    .from("profiles")
    .select("invoice_pin")
    .eq("id", session.user.id)
    .single();

  const hasPin = !!profile?.invoice_pin;
  let isAuthorized = true;

  if (hasPin) {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const deviceIdCookie = cookieStore.get("device_id")?.value;
    
    if (!deviceIdCookie) {
      isAuthorized = false;
    } else {
      const { data: pinSession } = await supabase
        .from("invoice_pin_sessions")
        .select("expires_at")
        .eq("user_id", session.user.id)
        .eq("device_id", deviceIdCookie)
        .single();

      if (!pinSession || new Date(pinSession.expires_at) < new Date()) {
        isAuthorized = false;
      }
    }
  }

  // Busca os dados da fatura (mesmo se não autorizado, passamos null para o client e ele lida com o bloqueio)
  let invoice = null;
  let items = [];

  if (isAuthorized) {
    const { data: inv } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .eq("user_id", session.user.id)
      .single();
    
    invoice = inv;

    if (invoice) {
      const { data: itms } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", invoice.id);
      items = itms || [];
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto w-full">
      <InvoiceDetailsClient 
        initialAuthorized={isAuthorized} 
        hasPin={hasPin} 
        invoice={invoice} 
        items={items} 
        invoiceId={invoiceId}
      />
    </div>
  );
}
