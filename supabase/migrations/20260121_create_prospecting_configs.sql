-- Tabela de Configurações do Agente de Prospecção
CREATE TABLE IF NOT EXISTS public.prospecting_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  agent_prompt TEXT DEFAULT '', -- Armazena o prompt de sistema em texto livre
  personality TEXT[] DEFAULT '{}', -- Tons de voz (Formal, Informal, etc)
  default_messages JSONB DEFAULT '[]'::jsonb, -- Array de frases personalizadas
  is_active BOOLEAN DEFAULT false, -- Ativado se houver mensagens customizadas
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Garante apenas uma config de prospecção por usuário
  UNIQUE(user_id)
);

-- RLS
ALTER TABLE public.prospecting_configs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own prospecting configs" 
ON public.prospecting_configs FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own prospecting configs" 
ON public.prospecting_configs FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own prospecting configs" 
ON public.prospecting_configs FOR UPDATE 
USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.prospecting_configs
  FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);
