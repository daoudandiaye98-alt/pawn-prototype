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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_logs: {
        Row: {
          agent_id: string
          cause_event_id: string | null
          created_at: string
          error: string | null
          id: string
          identity_scope: string | null
          latency_ms: number | null
          model: string | null
          prompt_version_id: string | null
          request: Json
          response: Json | null
          status: string
        }
        Insert: {
          agent_id: string
          cause_event_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          identity_scope?: string | null
          latency_ms?: number | null
          model?: string | null
          prompt_version_id?: string | null
          request: Json
          response?: Json | null
          status?: string
        }
        Update: {
          agent_id?: string
          cause_event_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          identity_scope?: string | null
          latency_ms?: number | null
          model?: string | null
          prompt_version_id?: string | null
          request?: Json
          response?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_logs_cause_event_id_fkey"
            columns: ["cause_event_id"]
            isOneToOne: false
            referencedRelation: "domain_events"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_versions: {
        Row: {
          body_markdown: string
          checksum: string
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          kind: string
          title: string
          version: number
        }
        Insert: {
          body_markdown: string
          checksum: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          kind: string
          title: string
          version: number
        }
        Update: {
          body_markdown?: string
          checksum?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          kind?: string
          title?: string
          version?: number
        }
        Relationships: []
      }
      designer_applications: {
        Row: {
          admin_notes: string | null
          ai_review_summary: Json | null
          avatar_path: string | null
          banner_path: string | null
          brand_name: string
          country: string | null
          created_at: string
          id: string
          instagram: string | null
          legal_name: string | null
          location: string | null
          portfolio_paths: string[] | null
          production_status: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          story: string | null
          submitted_at: string | null
          tags: string[] | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          admin_notes?: string | null
          ai_review_summary?: Json | null
          avatar_path?: string | null
          banner_path?: string | null
          brand_name: string
          country?: string | null
          created_at?: string
          id?: string
          instagram?: string | null
          legal_name?: string | null
          location?: string | null
          portfolio_paths?: string[] | null
          production_status?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          story?: string | null
          submitted_at?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          admin_notes?: string | null
          ai_review_summary?: Json | null
          avatar_path?: string | null
          banner_path?: string | null
          brand_name?: string
          country?: string | null
          created_at?: string
          id?: string
          instagram?: string | null
          legal_name?: string | null
          location?: string | null
          portfolio_paths?: string[] | null
          production_status?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          story?: string | null
          submitted_at?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      designer_brand_dna: {
        Row: {
          audience_profile: Json | null
          brand_dna: Json | null
          brand_voice: Json | null
          campaign_style: Json | null
          color_palette: Json | null
          designer_id: string
          generated_at: string | null
          marketing_dna: Json | null
          prompt_library: Json | null
          status: string
          storytelling: Json | null
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          audience_profile?: Json | null
          brand_dna?: Json | null
          brand_voice?: Json | null
          campaign_style?: Json | null
          color_palette?: Json | null
          designer_id: string
          generated_at?: string | null
          marketing_dna?: Json | null
          prompt_library?: Json | null
          status?: string
          storytelling?: Json | null
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          audience_profile?: Json | null
          brand_dna?: Json | null
          brand_voice?: Json | null
          campaign_style?: Json | null
          color_palette?: Json | null
          designer_id?: string
          generated_at?: string | null
          marketing_dna?: Json | null
          prompt_library?: Json | null
          status?: string
          storytelling?: Json | null
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "designer_brand_dna_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: true
            referencedRelation: "designers"
            referencedColumns: ["id"]
          },
        ]
      }
      designer_consents: {
        Row: {
          accepted_at: string
          application_id: string
          checksum_at_accept: string
          contract_version_id: string
          id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          application_id: string
          checksum_at_accept: string
          contract_version_id: string
          id?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          application_id?: string
          checksum_at_accept?: string
          contract_version_id?: string
          id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "designer_consents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "designer_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "designer_consents_contract_version_id_fkey"
            columns: ["contract_version_id"]
            isOneToOne: false
            referencedRelation: "contract_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      designer_onboarding_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          designer_id: string
          id: string
          started_at: string | null
          status: string
          transcript: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          designer_id: string
          id?: string
          started_at?: string | null
          status?: string
          transcript?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          designer_id?: string
          id?: string
          started_at?: string | null
          status?: string
          transcript?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "designer_onboarding_sessions_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: true
            referencedRelation: "designers"
            referencedColumns: ["id"]
          },
        ]
      }
      designers: {
        Row: {
          avatar_url: string | null
          banner_url: string | null
          brand_name: string
          country: string | null
          created_at: string
          id: string
          instagram: string | null
          location: string | null
          published: boolean
          slug: string
          story: string | null
          tags: string[] | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          banner_url?: string | null
          brand_name: string
          country?: string | null
          created_at?: string
          id?: string
          instagram?: string | null
          location?: string | null
          published?: boolean
          slug: string
          story?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          banner_url?: string | null
          brand_name?: string
          country?: string | null
          created_at?: string
          id?: string
          instagram?: string | null
          location?: string | null
          published?: boolean
          slug?: string
          story?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      domain_events: {
        Row: {
          actor: string
          at: string
          cause: string | null
          created_at: string
          id: string
          identity_scope: string | null
          payload: Json
          schema_version: number
          type: string
        }
        Insert: {
          actor: string
          at: string
          cause?: string | null
          created_at?: string
          id: string
          identity_scope?: string | null
          payload: Json
          schema_version?: number
          type: string
        }
        Update: {
          actor?: string
          at?: string
          cause?: string | null
          created_at?: string
          id?: string
          identity_scope?: string | null
          payload?: Json
          schema_version?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "domain_events_cause_fkey"
            columns: ["cause"]
            isOneToOne: false
            referencedRelation: "domain_events"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_snapshots: {
        Row: {
          created_at: string
          identity_scope: string
          last_event_id: string | null
          state: Json
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          identity_scope: string
          last_event_id?: string | null
          state: Json
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          identity_scope?: string
          last_event_id?: string | null
          state?: Json
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "domain_snapshots_last_event_id_fkey"
            columns: ["last_event_id"]
            isOneToOne: false
            referencedRelation: "domain_events"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          consent_analytics: boolean
          consent_memory: boolean
          consent_personalization: boolean
          created_at: string
          display_name: string
          id: string
          locale: string
          updated_at: string
        }
        Insert: {
          consent_analytics?: boolean
          consent_memory?: boolean
          consent_personalization?: boolean
          created_at?: string
          display_name?: string
          id: string
          locale?: string
          updated_at?: string
        }
        Update: {
          consent_analytics?: boolean
          consent_memory?: boolean
          consent_personalization?: boolean
          created_at?: string
          display_name?: string
          id?: string
          locale?: string
          updated_at?: string
        }
        Relationships: []
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
      approve_designer: { Args: { _application_id: string }; Returns: string }
      archive_application: {
        Args: { _application_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      reject_designer: {
        Args: { _application_id: string; _reason: string }
        Returns: undefined
      }
      slugify: { Args: { txt: string }; Returns: string }
    }
    Enums: {
      app_role: "customer" | "designer" | "admin" | "designer_applicant"
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
      app_role: ["customer", "designer", "admin", "designer_applicant"],
    },
  },
} as const
