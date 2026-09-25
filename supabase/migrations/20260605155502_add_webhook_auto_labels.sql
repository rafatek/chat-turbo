-- Adicionar suporte a múltiplas etiquetas nos Webhooks
ALTER TABLE public.capture_webhooks
  ADD COLUMN IF NOT EXISTS auto_labels UUID[] DEFAULT '{}';
