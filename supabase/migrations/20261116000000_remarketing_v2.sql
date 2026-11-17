-- ==============================================================================
-- MIGRATION: Remarketing Automático V2 (Agente Passivo & Proativo + Fila PostgreSQL)
-- ==============================================================================

-- 1. Colunas adicionais em remarketing_configs
ALTER TABLE public.remarketing_configs
ADD COLUMN IF NOT EXISTS agent_mode TEXT DEFAULT 'passive',
ADD COLUMN IF NOT EXISTS time_rules JSONB DEFAULT '[
  {"id": "1", "days": 0, "hours": 0, "minutes": 30, "label": "Após 30 minutos"},
  {"id": "2", "days": 0, "hours": 2, "minutes": 0, "label": "Após 2 horas"},
  {"id": "3", "days": 1, "hours": 0, "minutes": 0, "label": "Após 1 dia"}
]'::jsonb;

-- 2. Tabela de Fila de Remarketing (remarketing_queue)
CREATE TABLE IF NOT EXISTS public.remarketing_queue (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lead_id      UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  step         INT NOT NULL DEFAULT 1,
  scheduled_at TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  metadata     JSONB DEFAULT '{}'::jsonb
);

-- Índices de Alta Performance
CREATE INDEX IF NOT EXISTS idx_rmk_queue_scheduled ON public.remarketing_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_rmk_queue_lead ON public.remarketing_queue(lead_id);
CREATE INDEX IF NOT EXISTS idx_rmk_queue_user ON public.remarketing_queue(user_id);

-- RLS (Row Level Security)
ALTER TABLE public.remarketing_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own queue" ON public.remarketing_queue;
CREATE POLICY "Users can view own queue" ON public.remarketing_queue 
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own queue" ON public.remarketing_queue;
CREATE POLICY "Users can insert own queue" ON public.remarketing_queue 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own queue" ON public.remarketing_queue;
CREATE POLICY "Users can update own queue" ON public.remarketing_queue 
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own queue" ON public.remarketing_queue;
CREATE POLICY "Users can delete own queue" ON public.remarketing_queue 
  FOR DELETE USING (auth.uid() = user_id);


-- 3. Função RPC: get_pending_remarketing_queue()
-- Chamada pelo n8n via HTTP Request (service_role)
CREATE OR REPLACE FUNCTION get_pending_remarketing_queue()
RETURNS TABLE (
  queue_id UUID,
  step INT,
  scheduled_at TIMESTAMPTZ,
  lead_id UUID,
  lead_name TEXT,
  lead_phone TEXT,
  conversation_id UUID,
  user_id UUID,
  instance_name TEXT,
  instance_key TEXT,
  ai_prompt TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rq.id AS queue_id,
    rq.step,
    rq.scheduled_at,
    l.id AS lead_id,
    l.full_name AS lead_name,
    l.whatsapp AS lead_phone,
    l.conversation_id,
    u.id AS user_id,
    wc.instance_name,
    wc.instance_key,
    rc.ai_prompt
  FROM public.remarketing_queue rq
  JOIN public.leads l ON l.id = rq.lead_id
  JOIN public.profiles u ON u.id = rq.user_id
  JOIN public.remarketing_configs rc ON rc.user_id = rq.user_id AND rc.is_active = true
  JOIN public.whatsapp_connections wc ON wc.user_id = rq.user_id AND wc.status = 'connected'
  WHERE 
    rq.scheduled_at <= NOW()
    AND (
      -- MODO PROATIVO: Só segura se o lead falou nos últimos 10 minutos (conversa ao vivo)
      (
        rc.agent_mode = 'proactive'
        AND NOT EXISTS (
          SELECT 1 FROM public.messages m 
          WHERE m.lead_id = l.id 
            AND m.from_me = false 
            AND m.created_at >= NOW() - INTERVAL '10 minutes'
        )
      )
      OR
      -- MODO PASSIVO: Se respondeu depois que o agendamento foi criado, não manda
      (
        (rc.agent_mode IS NULL OR rc.agent_mode != 'proactive')
        AND NOT EXISTS (
          SELECT 1 FROM public.messages m 
          WHERE m.lead_id = l.id 
            AND m.from_me = false 
            AND m.created_at >= rq.created_at
        )
      )
    )
  ORDER BY rq.scheduled_at ASC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Restrição de segurança: apenas o service_role (n8n/backend) pode chamar
REVOKE EXECUTE ON FUNCTION get_pending_remarketing_queue() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_pending_remarketing_queue() TO service_role;


-- 4. Trigger: trg_new_lead_proactive_remarketing
-- Disparado ao criar um lead (qualquer fonte: n8n, WhatsApp, CSV, Kanban, Webhook)
-- quando o usuário estiver em modo 'proactive'
CREATE OR REPLACE FUNCTION handle_new_lead_proactive_remarketing()
RETURNS TRIGGER AS $$
DECLARE
  v_config RECORD;
  v_rule RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_step INT := 1;
  v_total_minutes INT;
BEGIN
  -- 1. Busca configuração de remarketing do usuário dono do lead
  SELECT is_active, agent_mode, time_rules
  INTO v_config
  FROM public.remarketing_configs
  WHERE user_id = NEW.user_id;

  -- 2. Se o remarketing estiver ativo e em modo proativo
  IF v_config.is_active = true AND v_config.agent_mode = 'proactive' THEN
    -- Marca em remarketing_leads como rmk_enabled = true
    INSERT INTO public.remarketing_leads (lead_id, user_id, rmk_enabled, remarketing_status, remarketing_attempts, last_remarketing_at)
    VALUES (NEW.id, NEW.user_id, true, 'none', 0, v_now)
    ON CONFLICT (lead_id) DO UPDATE
    SET rmk_enabled = true,
        updated_at = v_now;

    -- Deleta agendamentos anteriores (se houver) para evitar duplicatas
    DELETE FROM public.remarketing_queue
    WHERE lead_id = NEW.id;

    -- Insere cada etapa de horário configurada na fila
    IF v_config.time_rules IS NOT NULL AND jsonb_array_length(v_config.time_rules) > 0 THEN
      FOR v_rule IN SELECT * FROM jsonb_to_recordset(v_config.time_rules) AS x(
        id text, days int, hours int, minutes int, label text
      )
      LOOP
        v_total_minutes := (COALESCE(v_rule.days, 0) * 1440) + (COALESCE(v_rule.hours, 0) * 60) + COALESCE(v_rule.minutes, 0);
        
        IF v_total_minutes > 0 THEN
          INSERT INTO public.remarketing_queue (
            user_id,
            lead_id,
            step,
            scheduled_at,
            metadata
          ) VALUES (
            NEW.user_id,
            NEW.id,
            v_step,
            v_now + (v_total_minutes * INTERVAL '1 minute'),
            jsonb_build_object(
              'label', COALESCE(v_rule.label, 'Etapa ' || v_step),
              'days', COALESCE(v_rule.days, 0),
              'hours', COALESCE(v_rule.hours, 0),
              'minutes', COALESCE(v_rule.minutes, 0)
            )
          );
          v_step := v_step + 1;
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Associa o trigger à tabela leads
DROP TRIGGER IF EXISTS trg_new_lead_proactive_remarketing ON public.leads;
CREATE TRIGGER trg_new_lead_proactive_remarketing
AFTER INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION handle_new_lead_proactive_remarketing();


-- 5. Trigger: trg_on_message_insert_remarketing
-- Disparado ao criar uma mensagem em public.messages de QUALQUER FONTE (n8n, Uazapi, Webhook, Chat)
-- Garante autocancelamento no Modo Passivo e vinculação automática de lead_id
CREATE OR REPLACE FUNCTION handle_incoming_message_remarketing()
RETURNS TRIGGER AS $$
DECLARE
  v_lead_id UUID;
  v_user_id UUID;
  v_config RECORD;
BEGIN
  -- Se o lead_id estiver nulo na mensagem, tenta resolver via conversation_id
  IF NEW.lead_id IS NULL AND NEW.conversation_id IS NOT NULL THEN
    SELECT lead_id INTO NEW.lead_id
    FROM public.conversations
    WHERE id = NEW.conversation_id;
  END IF;

  -- Se a mensagem foi enviada pelo atendente/sistema (from_me = true), não cancela o RMK
  IF NEW.from_me = true THEN
    RETURN NEW;
  END IF;

  -- Identifica o lead associado
  v_lead_id := NEW.lead_id;
  IF v_lead_id IS NULL AND NEW.conversation_id IS NOT NULL THEN
    SELECT id INTO v_lead_id
    FROM public.leads
    WHERE conversation_id = NEW.conversation_id
    LIMIT 1;
  END IF;

  -- Se não possui lead vinculado, encerra
  IF v_lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Identifica o usuário proprietário
  v_user_id := NEW.user_id;
  IF v_user_id IS NULL THEN
    SELECT user_id INTO v_user_id FROM public.leads WHERE id = v_lead_id;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Busca configuração de remarketing do usuário
  SELECT is_active, agent_mode
  INTO v_config
  FROM public.remarketing_configs
  WHERE user_id = v_user_id;

  -- Se o remarketing estiver ativo
  IF v_config.is_active = true THEN
    -- MODO PASSIVO: Cliente respondeu -> Autocancelamento da fila imediato
    IF v_config.agent_mode IS NULL OR v_config.agent_mode != 'proactive' THEN
      DELETE FROM public.remarketing_queue
      WHERE lead_id = v_lead_id;

      INSERT INTO public.remarketing_leads (
        lead_id,
        user_id,
        rmk_enabled,
        remarketing_status,
        updated_at
      )
      VALUES (
        v_lead_id,
        v_user_id,
        false,
        'converted',
        NOW()
      )
      ON CONFLICT (lead_id) DO UPDATE
      SET rmk_enabled = false,
          remarketing_status = 'converted',
          updated_at = NOW();

    -- MODO PROATIVO:
    -- Mantém a fila futura para a esteira contínua.
    -- A trava de 10 minutos na função get_pending_remarketing_queue()
    -- já impede qualquer envio enquanto o lead estiver conversando.
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Associa o trigger à tabela messages para inserções de qualquer fonte (n8n, API, webhook, etc.)
DROP TRIGGER IF EXISTS trg_on_message_insert_remarketing ON public.messages;
CREATE TRIGGER trg_on_message_insert_remarketing
BEFORE INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION handle_incoming_message_remarketing();
