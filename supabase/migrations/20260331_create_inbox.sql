-- =============================================
-- INBOX: Conversations & Messages
-- =============================================

-- Tabela de Conversas
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_name TEXT DEFAULT '',
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  last_message TEXT DEFAULT '',
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  unread_count INT DEFAULT 0,
  is_open BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, contact_phone)
);

-- Tabela de Mensagens
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  content TEXT NOT NULL,
  from_me BOOLEAN DEFAULT false,
  whatsapp_message_id TEXT,
  media_url TEXT,
  media_type TEXT,
  status TEXT DEFAULT 'sent', -- sent, delivered, read, failed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON public.conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);

-- RLS: Conversas
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own conversations"
ON public.conversations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own conversations"
ON public.conversations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own conversations"
ON public.conversations FOR UPDATE
USING (auth.uid() = user_id);

-- RLS: Mensagens
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own messages"
ON public.messages FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own messages"
ON public.messages FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Service role bypass (para webhook)
CREATE POLICY "Service role bypass conversations"
ON public.conversations FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role bypass messages"
ON public.messages FOR ALL
USING (true)
WITH CHECK (true);

-- Trigger updated_at em conversations
CREATE TRIGGER handle_conversations_updated_at BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);

-- Habilitar Realtime nas tabelas
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
