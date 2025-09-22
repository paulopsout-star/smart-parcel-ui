// Types for message templates and charge messages

export interface MessageTemplate {
  id: string;
  user_id: string;
  name: string;
  content: string;
  variables: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MessageTemplateInsert {
  user_id: string;
  name: string;
  content: string;
  variables?: string[];
  is_active?: boolean;
}

export interface MessageTemplateUpdate {
  name?: string;
  content?: string;
  variables?: string[];
  is_active?: boolean;
}

export interface ChargeMessage {
  id: string;
  charge_id: string;
  template_id?: string;
  phone_number: string;
  content: string;
  status: 'pending' | 'sent' | 'failed';
  sent_at?: string;
  error_details?: Record<string, any>;
  created_at: string;
}

export interface ChargeMessageInsert {
  charge_id: string;
  template_id?: string;
  phone_number: string;
  content: string;
  status?: 'pending' | 'sent' | 'failed';
  sent_at?: string;
  error_details?: Record<string, any>;
}