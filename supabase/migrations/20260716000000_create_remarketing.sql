-- ================================================================
-- MIGRATION: Remarketing Automático — Isolamento Total
-- Versão 2: zero ALTER em tabelas existentes, zero triggers
-- ================================================================
-- ATENÇÃO: Execute o PASSO 3 (índice CONCURRENTLY) separadamente
-- no SQL Editor, fora de qualquer bloco BEGIN/COMMIT.
-- Os passos 1 e 2 podem ser rodados juntos normalmente.
-- ================================================================


-- ----------------------------------------------------------------
-- PASSO 1: Tabela de estado do remarketing por lead
-- Substitui os campos que seriam adicionados em public.leads
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.remarketing_leads (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id              UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  remarketing_status   TEXT NOT NULL DEFAULT 'none',
  -- Valores possíveis: none | sent_1 | sent_2 | sent_3 | optout | converted
  remarketing_attempts INT NOT NULL DEFAULT 0,
  last_remarketing_at  TIMESTAMPTZ,
  funnel_stage         TEXT DEFAULT 'unknown',
  -- Valores possíveis: unknown | cold | interested | objection
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lead_id)  -- um lead só pode ter uma linha de RMK ativa
);

CREATE INDEX IF NOT EXISTS idx_rmk_leads_user_id
  ON public.remarketing_leads(user_id);

CREATE INDEX IF NOT EXISTS idx_rmk_leads_status
  ON public.remarketing_leads(remarketing_status);

CREATE INDEX IF NOT EXISTS idx_rmk_leads_last_at
  ON public.remarketing_leads(last_remarketing_at);

ALTER TABLE public.remarketing_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own remarketing leads"
  ON public.remarketing_leads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own remarketing leads"
  ON public.remarketing_leads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own remarketing leads"
  ON public.remarketing_leads FOR UPDATE
  USING (auth.uid() = user_id);

-- NOTA: N8N usa service_role_key → bypassa RLS nativamente.


-- ----------------------------------------------------------------
-- PASSO 2: Tabela de configuração do RMK por cliente
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.remarketing_configs (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id              UUID REFERENCES public.profiles(id) NOT NULL,
  is_active            BOOLEAN DEFAULT false,
  max_attempts         INT DEFAULT 3,
  ai_prompt            TEXT DEFAULT '',
  template_cold        TEXT DEFAULT '',
  template_interested  TEXT DEFAULT '',
  template_objection   TEXT DEFAULT '',
  meta_data            JSONB DEFAULT '{}'::jsonb,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TRIGGER handle_remarketing_configs_updated_at
  BEFORE UPDATE ON public.remarketing_configs
  FOR EACH ROW EXECUTE PROCEDURE moddatetime(updated_at);

ALTER TABLE public.remarketing_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own remarketing configs"
  ON public.remarketing_configs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own remarketing configs"
  ON public.remarketing_configs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own remarketing configs"
  ON public.remarketing_configs FOR UPDATE
  USING (auth.uid() = user_id);


-- ================================================================
-- PASSO 3: Índice de performance na tabela messages
-- RODAR SEPARADAMENTE no SQL Editor (fora de transação).
-- Criado com CONCURRENTLY: NÃO trava leituras nem escritas.
-- Duração estimada: segundos a poucos minutos dependendo do volume.
-- ================================================================

-- Cole e rode este comando SOZINHO em uma nova aba do SQL Editor:
--
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_rmk_check
--   ON public.messages(lead_id, created_at, from_me);
--
-- Este índice é OBRIGATÓRIO para que o NOT EXISTS do N8N não
-- faça table scan na tabela messages a cada disparo de remarketing.
-- ================================================================
