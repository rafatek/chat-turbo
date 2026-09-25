-- 1. Add PIN to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS invoice_pin text;

-- 2. Sessions
CREATE TABLE IF NOT EXISTS public.invoice_pin_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    device_id text NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoice_pin_sessions_user_device ON public.invoice_pin_sessions(user_id, device_id);

-- 3. Billing cycles
CREATE TABLE IF NOT EXISTS public.billing_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status text NOT NULL DEFAULT 'open', -- open, closed
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Invoices
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    cycle_id UUID REFERENCES public.billing_cycles(id) ON DELETE SET NULL,
    asaas_invoice_id text,
    asaas_payment_link text,
    pix_qr_code text,
    pix_copy_paste text,
    amount NUMERIC(10,2) NOT NULL,
    status text NOT NULL DEFAULT 'pending', -- pending, paid, overdue, failed
    due_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Invoice items
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
    cycle_id UUID REFERENCES public.billing_cycles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    description text NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.invoice_pin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- Políticas (Policies)
CREATE POLICY "Users can manage their own pin sessions" ON public.invoice_pin_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own billing cycles" ON public.billing_cycles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own invoices" ON public.invoices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own invoice items" ON public.invoice_items FOR SELECT USING (auth.uid() = user_id);
