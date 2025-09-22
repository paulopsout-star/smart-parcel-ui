// Types for payout accounts

export interface PayoutAccount {
  id: string;
  user_id: string;
  account_holder_name: string;
  account_holder_document: string;
  pix_key: string;
  pix_key_type: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PayoutAccountInsert {
  user_id: string;
  account_holder_name: string;
  account_holder_document: string;
  pix_key: string;
  pix_key_type: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
  is_active?: boolean;
}

export interface PayoutAccountUpdate {
  account_holder_name?: string;
  account_holder_document?: string;
  pix_key?: string;
  pix_key_type?: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
  is_active?: boolean;
}