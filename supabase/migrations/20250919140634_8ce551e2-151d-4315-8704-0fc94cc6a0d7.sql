-- Create transactions table for QuitaMais integration
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id TEXT NOT NULL UNIQUE,
  merchant_id TEXT NOT NULL,
  creditor_name TEXT NOT NULL,
  creditor_document TEXT NOT NULL,
  amount_in_cents INTEGER NOT NULL,
  installments INTEGER NOT NULL DEFAULT 1,
  payer_document TEXT NOT NULL,
  payer_email TEXT NOT NULL,
  payer_phone_number TEXT NOT NULL,
  payer_name TEXT NOT NULL,
  card_holder_name TEXT NOT NULL,
  card_number_last_four TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('AUTHORIZED', 'REJECTED', 'PENDING')),
  authorization_code TEXT,
  error_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Create policies for transaction access (public read for now, can be adjusted based on requirements)
CREATE POLICY "Anyone can view transactions" 
ON public.transactions 
FOR SELECT 
USING (true);

CREATE POLICY "System can insert transactions" 
ON public.transactions 
FOR INSERT 
WITH CHECK (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance on transaction lookups
CREATE INDEX idx_transactions_transaction_id ON public.transactions(transaction_id);
CREATE INDEX idx_transactions_payer_document ON public.transactions(payer_document);
CREATE INDEX idx_transactions_created_at ON public.transactions(created_at);