CREATE TABLE public.agendamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    contact_phone TEXT NOT NULL,
    content TEXT NOT NULL,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own agendamentos" 
    ON public.agendamentos FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own agendamentos" 
    ON public.agendamentos FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own agendamentos" 
    ON public.agendamentos FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own agendamentos" 
    ON public.agendamentos FOR DELETE 
    USING (auth.uid() = user_id);
