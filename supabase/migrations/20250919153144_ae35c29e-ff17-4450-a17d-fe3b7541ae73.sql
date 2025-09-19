-- Create table for QuitaMais payment links history
CREATE TABLE public.payment_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  link_id TEXT NOT NULL UNIQUE,
  link_url TEXT NOT NULL,
  guid TEXT NOT NULL,
  amount INTEGER NOT NULL, -- valor em centavos
  payer_name TEXT NOT NULL,
  payer_email TEXT NOT NULL,
  payer_phone_number TEXT,
  payer_document TEXT NOT NULL,
  creditor_name TEXT,
  creditor_document TEXT,  
  status TEXT NOT NULL DEFAULT 'active',
  order_type TEXT NOT NULL DEFAULT 'credit_card',
  description TEXT,
  order_id TEXT,
  installments INTEGER,
  mask_fee BOOLEAN DEFAULT false,
  expiration_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (admin interface)
CREATE POLICY "Anyone can view payment links" 
ON public.payment_links 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create payment links" 
ON public.payment_links 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update payment links" 
ON public.payment_links 
FOR UPDATE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_payment_links_updated_at
BEFORE UPDATE ON public.payment_links
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();