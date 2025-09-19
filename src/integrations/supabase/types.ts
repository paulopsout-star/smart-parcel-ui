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
          charge_id: string
          created_at: string
          error_details: Json | null
          execution_date: string
          execution_log: Json | null
          id: string
          idempotency_key: string | null
          payment_link_id: string | null
          payment_link_url: string | null
          quita_guid: string | null
          status: Database["public"]["Enums"]["charge_status"]
        }
        Insert: {
          charge_id: string
          created_at?: string
          error_details?: Json | null
          execution_date?: string
          execution_log?: Json | null
          id?: string
          idempotency_key?: string | null
          payment_link_id?: string | null
          payment_link_url?: string | null
          quita_guid?: string | null
          status: Database["public"]["Enums"]["charge_status"]
        }
        Update: {
          charge_id?: string
          created_at?: string
          error_details?: Json | null
          execution_date?: string
          execution_log?: Json | null
          id?: string
          idempotency_key?: string | null
          payment_link_id?: string | null
          payment_link_url?: string | null
          quita_guid?: string | null
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
        ]
      }
      charges: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          description: string | null
          id: string
          installments: number | null
          is_active: boolean
          mask_fee: boolean | null
          metadata: Json | null
          next_charge_date: string | null
          payer_document: string
          payer_email: string
          payer_name: string
          payer_phone: string
          recurrence_end_date: string | null
          recurrence_interval: number | null
          recurrence_type: Database["public"]["Enums"]["recurrence_type"]
          status: Database["public"]["Enums"]["charge_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          installments?: number | null
          is_active?: boolean
          mask_fee?: boolean | null
          metadata?: Json | null
          next_charge_date?: string | null
          payer_document: string
          payer_email: string
          payer_name: string
          payer_phone: string
          recurrence_end_date?: string | null
          recurrence_interval?: number | null
          recurrence_type?: Database["public"]["Enums"]["recurrence_type"]
          status?: Database["public"]["Enums"]["charge_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          installments?: number | null
          is_active?: boolean
          mask_fee?: boolean | null
          metadata?: Json | null
          next_charge_date?: string | null
          payer_document?: string
          payer_email?: string
          payer_name?: string
          payer_phone?: string
          recurrence_end_date?: string | null
          recurrence_interval?: number | null
          recurrence_type?: Database["public"]["Enums"]["recurrence_type"]
          status?: Database["public"]["Enums"]["charge_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "charges_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_links: {
        Row: {
          amount: number
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
          ui_snapshot: Json | null
          updated_at: string
        }
        Insert: {
          amount: number
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
          ui_snapshot?: Json | null
          updated_at?: string
        }
        Update: {
          amount?: number
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
          ui_snapshot?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount_in_cents: number
          authorization_code: string | null
          card_holder_name: string
          card_number_last_four: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_operador: {
        Args: { _user_id: string }
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
      recurrence_type:
        | "pontual"
        | "diaria"
        | "semanal"
        | "quinzenal"
        | "mensal"
        | "semestral"
        | "anual"
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
      recurrence_type: [
        "pontual",
        "diaria",
        "semanal",
        "quinzenal",
        "mensal",
        "semestral",
        "anual",
      ],
    },
  },
} as const
