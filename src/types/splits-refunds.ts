// Types for payment splits and refund jobs

export type PaymentMethod = 'PIX' | 'CARD';

export interface PaymentSplit {
  id: string;
  charge_id?: string;
  payment_link_id?: string;
  method: string;
  amount_cents: number;
  status: 'pending' | 'concluded' | 'failed' | 'refunded';
  transaction_id?: string;
  processed_at?: string;
  created_at: string;
}

export interface PaymentSplitInsert {
  charge_id?: string;
  payment_link_id?: string;
  method: string;
  amount_cents: number;
  status?: 'pending' | 'concluded' | 'failed' | 'refunded';
  transaction_id?: string;
  processed_at?: string;
}

export interface RefundJob {
  id: string;
  charge_id?: string;
  payment_link_id?: string;
  original_amount_cents: number;
  refund_amount_cents: number;
  fee_amount_cents: number;
  reason: string;
  scheduled_for: string;
  processed_at?: string;
  status: 'pending' | 'processed' | 'failed' | 'cancelled';
  error_details?: Record<string, any>;
  created_at: string;
}

export interface RefundJobInsert {
  charge_id?: string;
  payment_link_id?: string;
  original_amount_cents: number;
  refund_amount_cents: number;
  fee_amount_cents?: number;
  reason: string;
  scheduled_for: string;
  status?: 'pending' | 'processed' | 'failed' | 'cancelled';
  error_details?: Record<string, any>;
}

export interface MockEvent {
  id: string;
  provider: string;
  event_key: string;
  payload: Record<string, any>;
  processed_at?: string;
  created_at: string;
}

export interface MockEventInsert {
  provider: string;
  event_key: string;
  payload: Record<string, any>;
  processed_at?: string;
}