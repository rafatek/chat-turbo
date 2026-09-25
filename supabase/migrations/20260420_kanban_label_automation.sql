-- ============================================================
-- MIGRATION: Automação Kanban ↔ Labels
-- ============================================================

-- 1. Adicionar `linked_label_id` na tabela kanban_columns
ALTER TABLE public.kanban_columns
  ADD COLUMN IF NOT EXISTS linked_label_id UUID REFERENCES public.labels(id) ON DELETE SET NULL;

-- 2. Criar função para mover lead
CREATE OR REPLACE FUNCTION public.move_lead_on_label_added()
RETURNS TRIGGER AS $$
DECLARE
    target_column_id UUID;
BEGIN
    -- Busca se a label inserida/atualizada está vinculada a alguma coluna do usuário
    -- Ignorando filtro de user_id na coluna na busca porque a label é única de cada forma que é usada no pipeline do usuário
    SELECT id INTO target_column_id
    FROM public.kanban_columns
    WHERE linked_label_id = NEW.label_id
    LIMIT 1;

    -- Se encontrou uma coluna correspondente, atualiza o lead
    IF FOUND THEN
        UPDATE public.leads
        SET column_id = target_column_id, updated_at = NOW()
        WHERE id = NEW.lead_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Criar trigger na tabela lead_labels
DROP TRIGGER IF EXISTS trg_move_lead_on_label ON public.lead_labels;

CREATE TRIGGER trg_move_lead_on_label
AFTER INSERT OR UPDATE ON public.lead_labels
FOR EACH ROW EXECUTE PROCEDURE public.move_lead_on_label_added();
