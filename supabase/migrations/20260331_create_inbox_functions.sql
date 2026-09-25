-- Função para incrementar o contador de não-lidas atomicamente
CREATE OR REPLACE FUNCTION public.increment_unread(conv_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.conversations
  SET unread_count = unread_count + 1
  WHERE id = conv_id;
END;
$$;
