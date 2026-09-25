-- Enforce Row Level Security (RLS) on critical tables

-- 1. Leads
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own leads" ON public.leads;
CREATE POLICY "Users can view their own leads"
ON public.leads FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own leads" ON public.leads;
CREATE POLICY "Users can insert their own leads"
ON public.leads FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own leads" ON public.leads;
CREATE POLICY "Users can update their own leads"
ON public.leads FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own leads" ON public.leads;
CREATE POLICY "Users can delete their own leads"
ON public.leads FOR DELETE
USING (auth.uid() = user_id);

-- 2. Kanban Columns
ALTER TABLE public.kanban_columns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own kanban_columns" ON public.kanban_columns;
CREATE POLICY "Users can view their own kanban_columns"
ON public.kanban_columns FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own kanban_columns" ON public.kanban_columns;
CREATE POLICY "Users can insert their own kanban_columns"
ON public.kanban_columns FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own kanban_columns" ON public.kanban_columns;
CREATE POLICY "Users can update their own kanban_columns"
ON public.kanban_columns FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own kanban_columns" ON public.kanban_columns;
CREATE POLICY "Users can delete their own kanban_columns"
ON public.kanban_columns FOR DELETE
USING (auth.uid() = user_id);

-- 3. WhatsApp Connections
ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own whatsapp_connections" ON public.whatsapp_connections;
CREATE POLICY "Users can view their own whatsapp_connections"
ON public.whatsapp_connections FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own whatsapp_connections" ON public.whatsapp_connections;
CREATE POLICY "Users can insert their own whatsapp_connections"
ON public.whatsapp_connections FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own whatsapp_connections" ON public.whatsapp_connections;
CREATE POLICY "Users can update their own whatsapp_connections"
ON public.whatsapp_connections FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own whatsapp_connections" ON public.whatsapp_connections;
CREATE POLICY "Users can delete their own whatsapp_connections"
ON public.whatsapp_connections FOR DELETE
USING (auth.uid() = user_id);

-- 4. Labels
ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own labels" ON public.labels;
CREATE POLICY "Users can view their own labels"
ON public.labels FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own labels" ON public.labels;
CREATE POLICY "Users can insert their own labels"
ON public.labels FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own labels" ON public.labels;
CREATE POLICY "Users can update their own labels"
ON public.labels FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own labels" ON public.labels;
CREATE POLICY "Users can delete their own labels"
ON public.labels FOR DELETE
USING (auth.uid() = user_id);
