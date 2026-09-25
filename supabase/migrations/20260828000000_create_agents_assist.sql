-- Migration to create the agents_assist table

CREATE TABLE IF NOT EXISTS public.agents_assist (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    prompt TEXT,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.agents_assist ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own agents_assist" 
ON public.agents_assist FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own agents_assist" 
ON public.agents_assist FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own agents_assist" 
ON public.agents_assist FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own agents_assist" 
ON public.agents_assist FOR DELETE 
USING (auth.uid() = user_id);

-- Trigger para updated_at automático
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

CREATE TRIGGER handle_updated_at_agents_assist BEFORE UPDATE ON public.agents_assist
  FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);
