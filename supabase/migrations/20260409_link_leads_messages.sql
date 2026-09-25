-- ============================================================
-- MIGRATION: Ligar Leads ↔ Conversas ↔ Mensagens
-- Aplicar no SQL Editor do Supabase
-- ============================================================

-- 1. Adiciona last_message_at na tabela leads
--    (last_message já existe, só falta o timestamp dedicado)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ;

-- 2. Adiciona conversation_id em leads para link direto com a conversa ativa
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL;

-- 3. Adiciona lead_id em messages para rastrear mensagens por lead no CRM
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL;

-- 4. Índice para o webhook encontrar leads pelo número de WhatsApp rapidamente
CREATE INDEX IF NOT EXISTS idx_leads_whatsapp ON public.leads(whatsapp);
CREATE INDEX IF NOT EXISTS idx_leads_user_whatsapp ON public.leads(user_id, whatsapp);
CREATE INDEX IF NOT EXISTS idx_messages_lead_id ON public.messages(lead_id);
