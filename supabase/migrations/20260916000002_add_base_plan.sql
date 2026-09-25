ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS base_plan_name text,
ADD COLUMN IF NOT EXISTS base_plan_price numeric;
