export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      charge_executions: {
        Row: {
          attempts: number | null
          charge_id: string
          company_id: string
          created_at: string
          dispatched_at: string | null
          error_details: Json | null
          execution_date: string
          execution_log: Json | null
          finished_at: string | null
          id: string
          idempotency_key: string | null
          last_error: string | null
          payment_link_id: string | null
          payment_link_url: string | null
          planned_at: string | null
          quita_guid: string | null
          scheduled_for: string | null
          status: Database["public"]["Enums"]["charge_status"]
        }
        Insert: {
          attempts?: number | null
          charge_id: string
          company_id: string
          created_at?: string
          dispatched_at?: string | null
          error_details?: Json | null
          execution_date?: string
          execution_log?: Json | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string | null
          last_error?: string | null
          payment_link_id?: string | null
          payment_link_url?: string | null
          planned_at?: string | null
          quita_guid?: string | null
          scheduled_for?: string | null
          status: Database["public"]["Enums"]["charge_status"]
        }
        Update: {
          attempts?: number | null
          charge_id?: string
          company_id?: string
          created_at?: string
          dispatched_at?: string | null
          error_details?: Json | null
          execution_date?: string
          execution_log?: Json | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string | null
          last_error?: string | null
          payment_link_id?: string | null
          payment_link_url?: string | null
          planned_at?: string | null
          quita_guid?: string | null
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["charge_status"]
        }
        Relationships: [
          {
            foreignKeyName: "charge_executions_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charge_executions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      charge_messages: {
        Row: {
          charge_id: string
          content: string
          created_at: string
          error_details: Json | null
          id: string
          phone_number: string
          sent_at: string | null
          status: string
          template_id: string | null
        }
        Insert: {
          charge_id: string
          content: string
          created_at?: string
          error_details?: Json | null
          id?: string
          phone_number: string
          sent_at?: string | null
          status?: string
          template_id?: string | null
        }
        Update: {
          charge_id?: string
          content?: string
          created_at?: string
          error_details?: Json | null
          id?: string
          phone_number?: string
          sent_at?: string | null
          status?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_charge_messages_charge_id"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_charge_messages_template_id"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      charges: {
        Row: {
          amount: number
          boleto_barcode: string | null
          boleto_linha_digitavel: string | null
          checkout_link_id: string | null
          checkout_url: string | null
          company_id: string
          created_at: string
          created_by: string
          creditor_document: string | null
          creditor_name: string | null
          description: string | null
          has_boleto: boolean | null
          has_boleto_link: boolean
          id: string
          installments: number | null
          is_active: boolean
          mask_fee: boolean | null
          message_template_id: string | null
          message_template_snapshot: Json | null
          metadata: Json | null
          next_charge_date: string | null
          payer_document: string
          payer_email: string
          payer_name: string
          payer_phone: string
          payment_method: string | null
          recurrence_end_date: string | null
          recurrence_interval: number | null
          recurrence_type: Database["public"]["Enums"]["recurrence_type"]
          status: Database["public"]["Enums"]["charge_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          boleto_barcode?: string | null
          boleto_linha_digitavel?: string | null
          checkout_link_id?: string | null
          checkout_url?: string | null
          company_id: string
          created_at?: string
          created_by: string
          creditor_document?: string | null
          creditor_name?: string | null
          description?: string | null
          has_boleto?: boolean | null
          has_boleto_link?: boolean
          id?: string
          installments?: number | null
          is_active?: boolean
          mask_fee?: boolean | null
          message_template_id?: string | null
          message_template_snapshot?: Json | null
          metadata?: Json | null
          next_charge_date?: string | null
          payer_document: string
          payer_email: string
          payer_name: string
          payer_phone: string
          payment_method?: string | null
          recurrence_end_date?: string | null
          recurrence_interval?: number | null
          recurrence_type?: Database["public"]["Enums"]["recurrence_type"]
          status?: Database["public"]["Enums"]["charge_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          boleto_barcode?: string | null
          boleto_linha_digitavel?: string | null
          checkout_link_id?: string | null
          checkout_url?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          creditor_document?: string | null
          creditor_name?: string | null
          description?: string | null
          has_boleto?: boolean | null
          has_boleto_link?: boolean
          id?: string
          installments?: number | null
          is_active?: boolean
          mask_fee?: boolean | null
          message_template_id?: string | null
          message_template_snapshot?: Json | null
          metadata?: Json | null
          next_charge_date?: string | null
          payer_document?: string
          payer_email?: string
          payer_name?: string
          payer_phone?: string
          payment_method?: string | null
          recurrence_end_date?: string | null
          recurrence_interval?: number | null
          recurrence_type?: Database["public"]["Enums"]["recurrence_type"]
          status?: Database["public"]["Enums"]["charge_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "charges_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          document: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          document: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          document?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      export_jobs: {
        Row: {
          company_id: string | null
          created_at: string
          error: string | null
          file_path: string | null
          filters_json: Json
          finished_at: string | null
          format: string
          id: string
          owner_id: string
          rows_count: number | null
          scope: string
          started_at: string | null
          status: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          error?: string | null
          file_path?: string | null
          filters_json: Json
          finished_at?: string | null
          format: string
          id?: string
          owner_id: string
          rows_count?: number | null
          scope: string
          started_at?: string | null
          status?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          error?: string | null
          file_path?: string | null
          filters_json?: Json
          finished_at?: string | null
          format?: string
          id?: string
          owner_id?: string
          rows_count?: number | null
          scope?: string
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          company_id: string
          content: string
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
          user_id: string
          variables: Json | null
        }
        Insert: {
          company_id: string
          content: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
          user_id: string
          variables?: Json | null
        }
        Update: {
          company_id?: string
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_events: {
        Row: {
          created_at: string
          event_key: string
          id: string
          payload: Json
          processed_at: string | null
          provider: string
        }
        Insert: {
          created_at?: string
          event_key: string
          id?: string
          payload: Json
          processed_at?: string | null
          provider: string
        }
        Update: {
          created_at?: string
          event_key?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
        }
        Relationships: []
      }
      payment_links: {
        Row: {
          amount: number
          charge_id: string | null
          company_id: string
          created_at: string
          creditor_document: string | null
          creditor_name: string | null
          description: string | null
          expiration_date: string | null
          guid: string
          id: string
          installments: number | null
          link_id: string
          link_url: string
          mask_fee: boolean | null
          order_id: string | null
          order_type: string
          payer_document: string
          payer_email: string
          payer_name: string
          payer_phone_number: string | null
          status: string
          token: string | null
          ui_snapshot: Json | null
          updated_at: string
          url: string | null
        }
        Insert: {
          amount: number
          charge_id?: string | null
          company_id: string
          created_at?: string
          creditor_document?: string | null
          creditor_name?: string | null
          description?: string | null
          expiration_date?: string | null
          guid: string
          id?: string
          installments?: number | null
          link_id: string
          link_url: string
          mask_fee?: boolean | null
          order_id?: string | null
          order_type?: string
          payer_document: string
          payer_email: string
          payer_name: string
          payer_phone_number?: string | null
          status?: string
          token?: string | null
          ui_snapshot?: Json | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          amount?: number
          charge_id?: string | null
          company_id?: string
          created_at?: string
          creditor_document?: string | null
          creditor_name?: string | null
          description?: string | null
          expiration_date?: string | null
          guid?: string
          id?: string
          installments?: number | null
          link_id?: string
          link_url?: string
          mask_fee?: boolean | null
          order_id?: string | null
          order_type?: string
          payer_document?: string
          payer_email?: string
          payer_name?: string
          payer_phone_number?: string | null
          status?: string
          token?: string | null
          ui_snapshot?: Json | null
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_links_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_splits: {
        Row: {
          amount_cents: number
          authorization_code: string | null
          charge_id: string | null
          created_at: string
          id: string
          installments: number | null
          link_id: string | null
          method: string
          order_index: number | null
          payment_link_id: string | null
          pix_paid_at: string | null
          pre_payment_key: string | null
          processed_at: string | null
          refund_requested_at: string | null
          refunded_at: string | null
          status: string
          transaction_id: string | null
        }
        Insert: {
          amount_cents: number
          authorization_code?: string | null
          charge_id?: string | null
          created_at?: string
          id?: string
          installments?: number | null
          link_id?: string | null
          method: string
          order_index?: number | null
          payment_link_id?: string | null
          pix_paid_at?: string | null
          pre_payment_key?: string | null
          processed_at?: string | null
          refund_requested_at?: string | null
          refunded_at?: string | null
          status?: string
          transaction_id?: string | null
        }
        Update: {
          amount_cents?: number
          authorization_code?: string | null
          charge_id?: string | null
          created_at?: string
          id?: string
          installments?: number | null
          link_id?: string | null
          method?: string
          order_index?: number | null
          payment_link_id?: string | null
          pix_paid_at?: string | null
          pre_payment_key?: string | null
          processed_at?: string | null
          refund_requested_at?: string | null
          refunded_at?: string | null
          status?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_payment_splits_charge_id"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_payment_splits_payment_link_id"
            columns: ["payment_link_id"]
            isOneToOne: false
            referencedRelation: "payment_links"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_accounts: {
        Row: {
          account_holder_document: string
          account_holder_name: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean | null
          pix_key: string
          pix_key_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_holder_document: string
          account_holder_name: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          pix_key: string
          pix_key_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_holder_document?: string
          account_holder_name?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          pix_key?: string
          pix_key_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string
          created_at: string
          default_payout_account_id: string | null
          full_name: string
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          default_payout_account_id?: string | null
          full_name: string
          id: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          default_payout_account_id?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_profiles_default_payout_account_id"
            columns: ["default_payout_account_id"]
            isOneToOne: false
            referencedRelation: "payout_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      refund_jobs: {
        Row: {
          charge_id: string | null
          created_at: string
          error_details: Json | null
          fee_amount_cents: number
          id: string
          original_amount_cents: number
          payment_link_id: string | null
          processed_at: string | null
          reason: string
          refund_amount_cents: number
          scheduled_for: string
          status: string
        }
        Insert: {
          charge_id?: string | null
          created_at?: string
          error_details?: Json | null
          fee_amount_cents?: number
          id?: string
          original_amount_cents: number
          payment_link_id?: string | null
          processed_at?: string | null
          reason: string
          refund_amount_cents: number
          scheduled_for: string
          status?: string
        }
        Update: {
          charge_id?: string | null
          created_at?: string
          error_details?: Json | null
          fee_amount_cents?: number
          id?: string
          original_amount_cents?: number
          payment_link_id?: string | null
          processed_at?: string | null
          reason?: string
          refund_amount_cents?: number
          scheduled_for?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_refund_jobs_charge_id"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_refund_jobs_payment_link_id"
            columns: ["payment_link_id"]
            isOneToOne: false
            referencedRelation: "payment_links"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          canceled_at: string | null
          company_id: string
          created_at: string
          current_period_end: string | null
          grace_days: number
          id: string
          owner_id: string
          plan_code: string | null
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          canceled_at?: string | null
          company_id: string
          created_at?: string
          current_period_end?: string | null
          grace_days?: number
          id?: string
          owner_id: string
          plan_code?: string | null
          started_at?: string
          status: string
          updated_at?: string
        }
        Update: {
          canceled_at?: string | null
          company_id?: string
          created_at?: string
          current_period_end?: string | null
          grace_days?: number
          id?: string
          owner_id?: string
          plan_code?: string | null
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount_in_cents: number
          authorization_code: string | null
          card_holder_name: string
          card_number_last_four: string
          company_id: string
          created_at: string
          creditor_document: string
          creditor_name: string
          error_details: Json | null
          id: string
          installments: number
          merchant_id: string
          payer_document: string
          payer_email: string
          payer_name: string
          payer_phone_number: string
          status: string
          transaction_id: string
          updated_at: string
        }
        Insert: {
          amount_in_cents: number
          authorization_code?: string | null
          card_holder_name: string
          card_number_last_four: string
          company_id: string
          created_at?: string
          creditor_document: string
          creditor_name: string
          error_details?: Json | null
          id?: string
          installments?: number
          merchant_id: string
          payer_document: string
          payer_email: string
          payer_name: string
          payer_phone_number: string
          status: string
          transaction_id: string
          updated_at?: string
        }
        Update: {
          amount_in_cents?: number
          authorization_code?: string | null
          card_holder_name?: string
          card_number_last_four?: string
          company_id?: string
          created_at?: string
          creditor_document?: string
          creditor_name?: string
          error_details?: Json | null
          id?: string
          installments?: number
          merchant_id?: string
          payer_document?: string
          payer_email?: string
          payer_name?: string
          payer_phone_number?: string
          status?: string
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_next_charge_date: {
        Args: {
          base_date: string
          interval_value?: number
          recurrence_type: Database["public"]["Enums"]["recurrence_type"]
        }
        Returns: string
      }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_operador: { Args: { _user_id: string }; Returns: boolean }
      is_subscription_active: {
        Args: { p_company_id: string }
        Returns: boolean
      }
      is_subscription_allowed: {
        Args: { p_company_id: string; p_now_ts?: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "operador"
      charge_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "cancelled"
      payment_method: "PIX" | "CARD" | "QUITA"
      recurrence_type:
        | "pontual"
        | "diaria"
        | "semanal"
        | "quinzenal"
        | "mensal"
        | "semestral"
        | "anual"
      template_channel: "WHATSAPP" | "EMAIL"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "operador"],
      charge_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "cancelled",
      ],
      payment_method: ["PIX", "CARD", "QUITA"],
      recurrence_type: [
        "pontual",
        "diaria",
        "semanal",
        "quinzenal",
        "mensal",
        "semestral",
        "anual",
      ],
      template_channel: ["WHATSAPP", "EMAIL"],
    },
  },
} as const
