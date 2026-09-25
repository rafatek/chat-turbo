CREATE TABLE public.gatilhos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    trigger_text TEXT NOT NULL,
    label_id UUID NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE public.gatilhos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own gatilhos" ON public.gatilhos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own gatilhos" ON public.gatilhos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own gatilhos" ON public.gatilhos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own gatilhos" ON public.gatilhos FOR DELETE USING (auth.uid() = user_id);

-- FUNCTION TO APPLY GATILHOS ON FIRST MESSAGE
CREATE OR REPLACE FUNCTION apply_gatilhos()
RETURNS TRIGGER AS $$
DECLARE
    v_lead_id UUID;
    v_gatilho RECORD;
    v_message_text TEXT;
BEGIN
    -- Only process incoming messages (from_me = false)
    IF NEW.from_me = true THEN
        RETURN NEW;
    END IF;
    
    -- Get the lead_id from the conversation
    SELECT lead_id INTO v_lead_id FROM public.conversations WHERE id = NEW.conversation_id;
    
    IF v_lead_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Check if it's the first incoming message for this conversation
    IF EXISTS (
        SELECT 1 FROM public.messages 
        WHERE conversation_id = NEW.conversation_id 
        AND id != NEW.id 
        AND from_me = false
    ) THEN
        RETURN NEW; -- Not the first incoming message
    END IF;

    -- Prepare message text for case-insensitive comparison
    v_message_text := LOWER(NEW.content);
    
    -- Loop through all triggers for this user
    FOR v_gatilho IN (SELECT label_id, trigger_text FROM public.gatilhos WHERE user_id = NEW.user_id) LOOP
        -- Check if message contains the trigger text (case-insensitive)
        IF v_message_text LIKE '%' || LOWER(v_gatilho.trigger_text) || '%' THEN
            -- Apply the label to the lead
            BEGIN
                INSERT INTO public.lead_labels (lead_id, label_id)
                VALUES (v_lead_id, v_gatilho.label_id)
                ON CONFLICT DO NOTHING;
            EXCEPTION WHEN OTHERS THEN
                -- ignore errors
            END;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TRIGGER ON MESSAGES
DROP TRIGGER IF EXISTS on_message_insert_apply_gatilho ON public.messages;
CREATE TRIGGER on_message_insert_apply_gatilho
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION apply_gatilhos();
