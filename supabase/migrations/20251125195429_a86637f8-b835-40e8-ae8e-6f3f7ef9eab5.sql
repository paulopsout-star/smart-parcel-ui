-- Add fee tracking columns to charges table
ALTER TABLE charges 
ADD COLUMN fee_amount integer DEFAULT 0,
ADD COLUMN fee_percentage numeric(5,2) DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN charges.fee_amount IS 'Fee amount in cents (automatically applied for PIX payments)';
COMMENT ON COLUMN charges.fee_percentage IS 'Fee percentage applied (e.g., 3.00 for 3%)';