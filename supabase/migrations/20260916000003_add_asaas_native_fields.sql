ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS asaas_customer_id text,
ADD COLUMN IF NOT EXISTS asaas_subscription_id text,
ADD COLUMN IF NOT EXISTS billing_cycle text,
ADD COLUMN IF NOT EXISTS next_due_date date;
