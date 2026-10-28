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
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_usage: {
        Row: {
          day: string
          requests: number
          user_id: string
        }
        Insert: {
          day: string
          requests?: number
          user_id: string
        }
        Update: {
          day?: string
          requests?: number
          user_id?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          created_at: string
          id: string
          message: string
          page: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          page?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          page?: string | null
          user_id?: string
        }
        Relationships: []
      }
      foreign_incomes: {
        Row: {
          amount_minor: number
          created_at: string
          currency: string
          id: string
          movement_id: string | null
          payer: string | null
          received_on: string
          user_id: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          currency?: string
          id?: string
          movement_id?: string | null
          payer?: string | null
          received_on: string
          user_id?: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          currency?: string
          id?: string
          movement_id?: string | null
          payer?: string | null
          received_on?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "foreign_incomes_movement_id_user_id_fkey"
            columns: ["movement_id", "user_id"]
            isOneToOne: false
            referencedRelation: "movements"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      merchant_categories: {
        Row: {
          category: string
          merchant_key: string
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          merchant_key: string
          source: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          category?: string
          merchant_key?: string
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      movements: {
        Row: {
          account_last4: string | null
          amount_cop: number
          category: string | null
          counterparty: string | null
          created_at: string
          dedupe_hash: string | null
          direction: string
          id: string
          kind: string
          occurred_at_time: string | null
          occurred_on: string
          source: string
          user_id: string
        }
        Insert: {
          account_last4?: string | null
          amount_cop: number
          category?: string | null
          counterparty?: string | null
          created_at?: string
          dedupe_hash?: string | null
          direction: string
          id?: string
          kind: string
          occurred_at_time?: string | null
          occurred_on: string
          source: string
          user_id?: string
        }
        Update: {
          account_last4?: string | null
          amount_cop?: number
          category?: string | null
          counterparty?: string | null
          created_at?: string
          dedupe_hash?: string | null
          direction?: string
          id?: string
          kind?: string
          occurred_at_time?: string | null
          occurred_on?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      own_accounts: {
        Row: {
          created_at: string
          id: string
          institution: string
          kind: string
          label: string | null
          last4: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          institution: string
          kind: string
          label?: string | null
          last4: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          institution?: string
          kind?: string
          label?: string | null
          last4?: string
          user_id?: string
        }
        Relationships: []
      }
      own_aliases: {
        Row: {
          created_at: string
          id: string
          kind: string
          user_id: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          user_id?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          user_id?: string
          value?: string
        }
        Relationships: []
      }
      pila_deadlines: {
        Row: {
          business_day: number
          digits_from: number
          digits_to: number
          norm: string
          source_url: string
          verified_on: string
        }
        Insert: {
          business_day: number
          digits_from: number
          digits_to: number
          norm: string
          source_url: string
          verified_on: string
        }
        Update: {
          business_day?: number
          digits_from?: number
          digits_to?: number
          norm?: string
          source_url?: string
          verified_on?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ai_categorization: boolean
          arl_risk: number | null
          calendar_token: string
          created_at: string
          id: string
          id_last_two: number | null
          nit_last_digit: number | null
          onboarded_at: string | null
          privacy_accepted_at: string | null
          privacy_version: string | null
          worker_type: string | null
        }
        Insert: {
          ai_categorization?: boolean
          arl_risk?: number | null
          calendar_token?: string
          created_at?: string
          id: string
          id_last_two?: number | null
          nit_last_digit?: number | null
          onboarded_at?: string | null
          privacy_accepted_at?: string | null
          privacy_version?: string | null
          worker_type?: string | null
        }
        Update: {
          ai_categorization?: boolean
          arl_risk?: number | null
          calendar_token?: string
          created_at?: string
          id?: string
          id_last_two?: number | null
          nit_last_digit?: number | null
          onboarded_at?: string | null
          privacy_accepted_at?: string | null
          privacy_version?: string | null
          worker_type?: string | null
        }
        Relationships: []
      }
      tax_rules: {
        Row: {
          key: string
          norm: string
          source_url: string
          unit: string
          value: number
          verified_on: string
          year: number
        }
        Insert: {
          key: string
          norm: string
          source_url: string
          unit: string
          value: number
          verified_on: string
          year: number
        }
        Update: {
          key?: string
          norm?: string
          source_url?: string
          unit?: string
          value?: number
          verified_on?: string
          year?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calendar_for_token: {
        Args: { p_token: string }
        Returns: {
          business_day: number
          id_last_two: number
        }[]
      }
      consume_ai_quota: { Args: { p_daily_limit: number }; Returns: boolean }
      delete_my_account: { Args: never; Returns: undefined }
      save_onboarding: {
        Args: {
          p_accounts: Json
          p_aliases: Json
          p_arl_risk: number
          p_nit_last_digit: number
          p_worker_type: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
