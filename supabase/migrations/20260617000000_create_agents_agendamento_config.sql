-- Migration to create the agents_agendamento_config table

CREATE TABLE IF NOT EXISTS public.agents_agendamento_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    prompt_agendamento TEXT,
    google_access_token TEXT,
    google_refresh_token TEXT,
    google_token_expiry TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.agents_agendamento_config ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own agendamento config" 
ON public.agents_agendamento_config FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own agendamento config" 
ON public.agents_agendamento_config FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own agendamento config" 
ON public.agents_agendamento_config FOR UPDATE 
USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.agents_agendamento_config
  FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);
