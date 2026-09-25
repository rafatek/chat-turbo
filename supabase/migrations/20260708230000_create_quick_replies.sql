CREATE TABLE public.quick_replies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.quick_replies ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own quick replies" 
    ON public.quick_replies FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own quick replies" 
    ON public.quick_replies FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own quick replies" 
    ON public.quick_replies FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own quick replies" 
    ON public.quick_replies FOR DELETE 
    USING (auth.uid() = user_id);
