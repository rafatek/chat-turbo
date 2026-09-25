-- Migração para adicionar campos de notificação aos agentes

ALTER TABLE public.agents_configs 
ADD COLUMN IF NOT EXISTS notification_phones TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS notify_new_messages BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notify_new_leads BOOLEAN DEFAULT false;
