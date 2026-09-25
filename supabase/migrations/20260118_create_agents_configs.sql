-- Tabela de Configurações dos Agentes
-- Armazena as configurações de cada tipo de agente para cada usuário

CREATE TABLE IF NOT EXISTS public.agents_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  agent_type TEXT NOT NULL, -- 'atendimento', 'prospeccao', etc.
  
  -- Configurações Comuns
  is_active BOOLEAN DEFAULT false,
  agent_name TEXT DEFAULT '',
  
  -- Configurações Específicas (Atendimento/Prospecção)
  personality TEXT DEFAULT '',
  response_interval INT DEFAULT 5, -- Minutos
  target_audience TEXT DEFAULT 'all', -- 'all' ou 'clients_only'
  
  -- Metadados flexíveis para futuro
  meta_data JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Garante apenas uma config por tipo de agente por usuário
  UNIQUE(user_id, agent_type)
);

-- RLS
ALTER TABLE public.agents_configs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own configs" 
ON public.agents_configs FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own configs" 
ON public.agents_configs FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own configs" 
ON public.agents_configs FOR UPDATE 
USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.agents_configs
  FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);
