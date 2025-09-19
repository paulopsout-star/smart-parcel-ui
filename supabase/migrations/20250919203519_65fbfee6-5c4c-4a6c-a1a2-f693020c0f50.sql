-- Add ui_snapshot column to store the original UI data
ALTER TABLE public.payment_links 
ADD COLUMN ui_snapshot jsonb;