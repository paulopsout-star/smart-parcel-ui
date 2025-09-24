-- Add checkout_url column to charges table to store generated payment links
ALTER TABLE charges 
ADD COLUMN checkout_url TEXT,
ADD COLUMN checkout_link_id TEXT;