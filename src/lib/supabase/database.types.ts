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
      profiles: {
        Row: {
          arl_risk: number | null
          created_at: string
          id: string
          nit_last_digit: number | null
          onboarded_at: string | null
          worker_type: string | null
        }
        Insert: {
          arl_risk?: number | null
          created_at?: string
          id: string
          nit_last_digit?: number | null
          onboarded_at?: string | null
          worker_type?: string | null
        }
        Update: {
          arl_risk?: number | null
          created_at?: string
          id?: string
          nit_last_digit?: number | null
          onboarded_at?: string | null
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
