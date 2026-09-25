-- ================================================================
-- MIGRATION: Remarketing — Toggle por Lead
-- Adiciona rmk_enabled para controle manual de cada lead no RMK
-- e política de DELETE para limpeza via frontend.
-- ================================================================

ALTER TABLE public.remarketing_leads
ADD COLUMN IF NOT EXISTS rmk_enabled BOOLEAN DEFAULT true;

CREATE POLICY "Users can delete own remarketing leads"
  ON public.remarketing_leads FOR DELETE
  USING (auth.uid() = user_id);

-- ================================================================
-- Atualização da Função de Busca de Leads para Remarketing
-- Agora respeita o rmk_enabled e filtra quem já respondeu
-- ================================================================

CREATE OR REPLACE FUNCTION get_remarketing_leads()
RETURNS TABLE (
  lead_id UUID,
  whatsapp TEXT,
  user_id UUID,
  ai_prompt TEXT,
  max_attempts INT,
  instance_key TEXT,
  instance_name TEXT,
  tentativas INT,
  ultimo_disparo TIMESTAMPTZ,
  conversation_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id AS lead_id,
    l.whatsapp,
    l.user_id,
    rc.ai_prompt,
    rc.max_attempts,
    wc.instance_key,
    wc.instance_name,
    COALESCE(rl.remarketing_attempts, 0) AS tentativas,
    COALESCE(rl.last_remarketing_at, NOW() - INTERVAL '8 days') AS ultimo_disparo,
    l.conversation_id
  FROM public.leads l
  JOIN public.remarketing_configs rc ON rc.user_id = l.user_id AND rc.is_active = true
  JOIN public.whatsapp_connections wc ON wc.user_id = l.user_id
  LEFT JOIN public.remarketing_leads rl ON rl.lead_id = l.id
  WHERE 
    COALESCE(rl.remarketing_status, 'none') NOT IN ('optout', 'converted')
    AND COALESCE(rl.remarketing_attempts, 0) < rc.max_attempts
    AND COALESCE(rl.rmk_enabled, true) = true
    AND NOT EXISTS (
      SELECT 1 FROM public.messages m 
      WHERE m.lead_id = l.id 
      AND m.from_me = false 
      AND m.created_at > COALESCE(rl.last_remarketing_at, l.created_at)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
