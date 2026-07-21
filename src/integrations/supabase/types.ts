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
      acquisition_leads: {
        Row: {
          bio: string | null
          clips: Json | null
          contacted_at: string | null
          created_at: string
          followers: number | null
          followup_at: string | null
          handle: string
          id: string
          notes: string | null
          personal_line: string | null
          source: string | null
          status: string
          updated_at: string
          warmed_at: string | null
          world: string
        }
        Insert: {
          bio?: string | null
          clips?: Json | null
          contacted_at?: string | null
          created_at?: string
          followers?: number | null
          followup_at?: string | null
          handle: string
          id?: string
          notes?: string | null
          personal_line?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          warmed_at?: string | null
          world: string
        }
        Update: {
          bio?: string | null
          clips?: Json | null
          contacted_at?: string | null
          created_at?: string
          followers?: number | null
          followup_at?: string | null
          handle?: string
          id?: string
          notes?: string | null
          personal_line?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          warmed_at?: string | null
          world?: string
        }
        Relationships: []
      }
      ai_actions_log: {
        Row: {
          action: string
          actor: string | null
          after: Json | null
          before: Json | null
          created_at: string
          error: string | null
          id: string
          params: Json
          source: string
          status: string
          undone_at: string | null
        }
        Insert: {
          action: string
          actor?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          error?: string | null
          id?: string
          params?: Json
          source: string
          status?: string
          undone_at?: string | null
        }
        Update: {
          action?: string
          actor?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          error?: string | null
          id?: string
          params?: Json
          source?: string
          status?: string
          undone_at?: string | null
        }
        Relationships: []
      }
      ai_config: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      ai_integrations: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          enabled: boolean
          event_types: string[]
          id: string
          kind: Database["public"]["Enums"]["ai_integration_kind"]
          label: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          event_types?: string[]
          id?: string
          kind: Database["public"]["Enums"]["ai_integration_kind"]
          label: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          event_types?: string[]
          id?: string
          kind?: Database["public"]["Enums"]["ai_integration_kind"]
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
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
      ai_sessions: {
        Row: {
          created_at: string
          extracted: Json
          session_id: string
          turns: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          extracted?: Json
          session_id: string
          turns?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          extracted?: Json
          session_id?: string
          turns?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      application_notes: {
        Row: {
          application_id: string
          author_id: string
          body: string
          created_at: string
          id: string
        }
        Insert: {
          application_id: string
          author_id: string
          body: string
          created_at?: string
          id?: string
        }
        Update: {
          application_id?: string
          author_id?: string
          body?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_notes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "designer_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          content: Json
          created_at: string
          created_by: string | null
          designer_id: string
          feedback: Json[]
          id: string
          kind: Database["public"]["Enums"]["campaign_kind"]
          product_id: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          title: string
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          created_by?: string | null
          designer_id: string
          feedback?: Json[]
          id?: string
          kind?: Database["public"]["Enums"]["campaign_kind"]
          product_id?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          title: string
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          created_by?: string | null
          designer_id?: string
          feedback?: Json[]
          id?: string
          kind?: Database["public"]["Enums"]["campaign_kind"]
          product_id?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_items: {
        Row: {
          collection_id: string
          created_at: string
          id: string
          product_slug: string
          sort: number
          world: string | null
        }
        Insert: {
          collection_id: string
          created_at?: string
          id?: string
          product_slug: string
          sort?: number
          world?: string | null
        }
        Update: {
          collection_id?: string
          created_at?: string
          id?: string
          product_slug?: string
          sort?: number
          world?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "curated_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          body: string
          created_at: string
          email: string
          handled_at: string | null
          handled_by: string | null
          id: string
          name: string
          status: string
          subject: string
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          email: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          name: string
          status?: string
          subject: string
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          email?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          name?: string
          status?: string
          subject?: string
          user_id?: string | null
        }
        Relationships: []
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
      curated_collections: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          number: number
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          number: number
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          number?: number
          subtitle?: string | null
          title?: string
          updated_at?: string
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
          revoke_reason: string | null
          revoked_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          application_id: string
          checksum_at_accept: string
          contract_version_id: string
          id?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          application_id?: string
          checksum_at_accept?: string
          contract_version_id?: string
          id?: string
          revoke_reason?: string | null
          revoked_at?: string | null
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
      designer_payout_profiles: {
        Row: {
          account_holder: string
          bic: string | null
          created_at: string
          designer_id: string
          iban: string
          id: string
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          account_holder: string
          bic?: string | null
          created_at?: string
          designer_id: string
          iban: string
          id?: string
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          account_holder?: string
          bic?: string | null
          created_at?: string
          designer_id?: string
          iban?: string
          id?: string
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "designer_payout_profiles_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: true
            referencedRelation: "designers"
            referencedColumns: ["id"]
          },
        ]
      }
      designers: {
        Row: {
          application_id: string | null
          atelier_caption: string | null
          atelier_image_url: string | null
          avatar_url: string | null
          banner_url: string | null
          brand_dna: Json
          brand_name: string
          collection_title: string | null
          country: string | null
          created_at: string
          hero_image_url: string | null
          house_number: number | null
          id: string
          image_usage_consent: boolean
          image_usage_consent_at: string | null
          instagram: string | null
          is_featured: boolean
          location: string | null
          manifesto: string | null
          plan: Database["public"]["Enums"]["designer_plan"]
          portrait_url: string | null
          published: boolean
          quote: string | null
          quote_role: string | null
          revenue_share_pct: number
          slug: string
          status: string
          story: string | null
          tags: string[] | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          application_id?: string | null
          atelier_caption?: string | null
          atelier_image_url?: string | null
          avatar_url?: string | null
          banner_url?: string | null
          brand_dna?: Json
          brand_name: string
          collection_title?: string | null
          country?: string | null
          created_at?: string
          hero_image_url?: string | null
          house_number?: number | null
          id?: string
          image_usage_consent?: boolean
          image_usage_consent_at?: string | null
          instagram?: string | null
          is_featured?: boolean
          location?: string | null
          manifesto?: string | null
          plan?: Database["public"]["Enums"]["designer_plan"]
          portrait_url?: string | null
          published?: boolean
          quote?: string | null
          quote_role?: string | null
          revenue_share_pct?: number
          slug: string
          status?: string
          story?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          application_id?: string | null
          atelier_caption?: string | null
          atelier_image_url?: string | null
          avatar_url?: string | null
          banner_url?: string | null
          brand_dna?: Json
          brand_name?: string
          collection_title?: string | null
          country?: string | null
          created_at?: string
          hero_image_url?: string | null
          house_number?: number | null
          id?: string
          image_usage_consent?: boolean
          image_usage_consent_at?: string | null
          instagram?: string | null
          is_featured?: boolean
          location?: string | null
          manifesto?: string | null
          plan?: Database["public"]["Enums"]["designer_plan"]
          portrait_url?: string | null
          published?: boolean
          quote?: string | null
          quote_role?: string | null
          revenue_share_pct?: number
          slug?: string
          status?: string
          story?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "designers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "designer_applications"
            referencedColumns: ["id"]
          },
        ]
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
      fashion_ontology: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["ontology_kind"]
          learned: boolean
          parent_term: string | null
          synonyms: string[]
          term: string
          updated_at: string
          world: string[]
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["ontology_kind"]
          learned?: boolean
          parent_term?: string | null
          synonyms?: string[]
          term: string
          updated_at?: string
          world?: string[]
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["ontology_kind"]
          learned?: boolean
          parent_term?: string | null
          synonyms?: string[]
          term?: string
          updated_at?: string
          world?: string[]
        }
        Relationships: []
      }
      generation_requests: {
        Row: {
          campaign_id: string
          cost_estimate: number | null
          created_at: string
          error: string | null
          id: string
          provider: string
          requested_by: string | null
          result_url: string | null
          status: Database["public"]["Enums"]["generation_status"]
          tier: Database["public"]["Enums"]["generation_tier"]
          updated_at: string
        }
        Insert: {
          campaign_id: string
          cost_estimate?: number | null
          created_at?: string
          error?: string | null
          id?: string
          provider?: string
          requested_by?: string | null
          result_url?: string | null
          status?: Database["public"]["Enums"]["generation_status"]
          tier?: Database["public"]["Enums"]["generation_tier"]
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          cost_estimate?: number | null
          created_at?: string
          error?: string | null
          id?: string
          provider?: string
          requested_by?: string | null
          result_url?: string | null
          status?: Database["public"]["Enums"]["generation_status"]
          tier?: Database["public"]["Enums"]["generation_tier"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_requests_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      message_threads: {
        Row: {
          category: Database["public"]["Enums"]["message_category"]
          created_at: string
          created_by: string
          designer_id: string
          id: string
          last_message_at: string
          product_id: string | null
          status: Database["public"]["Enums"]["message_status"]
          subject: string
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["message_category"]
          created_at?: string
          created_by: string
          designer_id: string
          id?: string
          last_message_at?: string
          product_id?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          subject: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["message_category"]
          created_at?: string
          created_by?: string
          designer_id?: string
          id?: string
          last_message_at?: string
          product_id?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_threads_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          sender_id: string
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sender_id: string
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sender_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      jarvis_reports: {
        Row: {
          body: string
          created_at: string
          data: Json
          id: string
          kind: string
          read_at: string | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          data?: Json
          id?: string
          kind: string
          read_at?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: Json
          id?: string
          kind?: string
          read_at?: string | null
          title?: string
        }
        Relationships: []
      }
      jarvis_runs: {
        Row: {
          cost_estimate: number | null
          error: string | null
          finished_at: string | null
          id: string
          started_at: string
          status: string
          summary: string | null
          tokens_used: number
          trigger: string
        }
        Insert: {
          cost_estimate?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          summary?: string | null
          tokens_used?: number
          trigger: string
        }
        Update: {
          cost_estimate?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          summary?: string | null
          tokens_used?: number
          trigger?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount_total: number
          carrier: string | null
          created_at: string
          currency: string
          customer_email: string | null
          delivered_at: string | null
          fulfillment_status: Database["public"]["Enums"]["fulfillment_status"]
          id: string
          items: Json
          shipped_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          stripe_session_id: string | null
          tracking_number: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount_total?: number
          carrier?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          delivered_at?: string | null
          fulfillment_status?: Database["public"]["Enums"]["fulfillment_status"]
          id?: string
          items?: Json
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          stripe_session_id?: string | null
          tracking_number?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount_total?: number
          carrier?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          delivered_at?: string | null
          fulfillment_status?: Database["public"]["Enums"]["fulfillment_status"]
          id?: string
          items?: Json
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          stripe_session_id?: string | null
          tracking_number?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      posting_queue: {
        Row: {
          campaign_id: string
          channel: Database["public"]["Enums"]["posting_channel"]
          created_at: string
          error: string | null
          id: string
          posted_at: string | null
          posted_url: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["posting_status"]
          updated_at: string
        }
        Insert: {
          campaign_id: string
          channel?: Database["public"]["Enums"]["posting_channel"]
          created_at?: string
          error?: string | null
          id?: string
          posted_at?: string | null
          posted_url?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["posting_status"]
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          channel?: Database["public"]["Enums"]["posting_channel"]
          created_at?: string
          error?: string | null
          id?: string
          posted_at?: string | null
          posted_url?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["posting_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posting_queue_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      product_shot_requests: {
        Row: {
          created_at: string
          designer_id: string
          error: string | null
          id: string
          mode: string
          model_style: string | null
          product_id: string
          provider: string | null
          request_handle: Json | null
          requested_by: string | null
          result_url: string | null
          source_url: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          designer_id: string
          error?: string | null
          id?: string
          mode?: string
          model_style?: string | null
          product_id: string
          provider?: string | null
          request_handle?: Json | null
          requested_by?: string | null
          result_url?: string | null
          source_url: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          designer_id?: string
          error?: string | null
          id?: string
          mode?: string
          model_style?: string | null
          product_id?: string
          provider?: string | null
          request_handle?: Json | null
          requested_by?: string | null
          result_url?: string | null
          source_url?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_shot_requests_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_shot_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          allow_custom_requests: boolean
          care_instructions: string | null
          compare_at_price: number | null
          created_at: string
          description: string | null
          designer_id: string
          designer_note: string | null
          edition_info: string | null
          height_cm: number | null
          id: string
          image_url: string | null
          inventory_mode: Database["public"]["Enums"]["inventory_mode"]
          lead_time_days: number | null
          length_cm: number | null
          made_in: string | null
          name: string
          price: number
          product_dna: Json
          sku: string | null
          slug: string
          status: Database["public"]["Enums"]["product_status"]
          stock_quantity: number
          tags: string[]
          updated_at: string
          variants: Json
          weight_grams: number | null
          width_cm: number | null
          world: Database["public"]["Enums"]["product_world"]
        }
        Insert: {
          allow_custom_requests?: boolean
          care_instructions?: string | null
          compare_at_price?: number | null
          created_at?: string
          description?: string | null
          designer_id: string
          designer_note?: string | null
          edition_info?: string | null
          height_cm?: number | null
          id?: string
          image_url?: string | null
          inventory_mode?: Database["public"]["Enums"]["inventory_mode"]
          lead_time_days?: number | null
          length_cm?: number | null
          made_in?: string | null
          name: string
          price?: number
          product_dna?: Json
          sku?: string | null
          slug: string
          status?: Database["public"]["Enums"]["product_status"]
          stock_quantity?: number
          tags?: string[]
          updated_at?: string
          variants?: Json
          weight_grams?: number | null
          width_cm?: number | null
          world?: Database["public"]["Enums"]["product_world"]
        }
        Update: {
          allow_custom_requests?: boolean
          care_instructions?: string | null
          compare_at_price?: number | null
          created_at?: string
          description?: string | null
          designer_id?: string
          designer_note?: string | null
          edition_info?: string | null
          height_cm?: number | null
          id?: string
          image_url?: string | null
          inventory_mode?: Database["public"]["Enums"]["inventory_mode"]
          lead_time_days?: number | null
          length_cm?: number | null
          made_in?: string | null
          name?: string
          price?: number
          product_dna?: Json
          sku?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["product_status"]
          stock_quantity?: number
          tags?: string[]
          updated_at?: string
          variants?: Json
          weight_grams?: number | null
          width_cm?: number | null
          world?: Database["public"]["Enums"]["product_world"]
        }
        Relationships: [
          {
            foreignKeyName: "products_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designers"
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
          member_number: number | null
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
          member_number?: number | null
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
          member_number?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      site_content: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      trend_snapshots: {
        Row: {
          created_at: string
          day: string
          id: string
          likes: number
          purchases: number
          saves: number
          score: number
          term: string
          views: number
          world: string
        }
        Insert: {
          created_at?: string
          day?: string
          id?: string
          likes?: number
          purchases?: number
          saves?: number
          score?: number
          term: string
          views?: number
          world: string
        }
        Update: {
          created_at?: string
          day?: string
          id?: string
          likes?: number
          purchases?: number
          saves?: number
          score?: number
          term?: string
          views?: number
          world?: string
        }
        Relationships: []
      }
      user_memory: {
        Row: {
          facts: Json
          preferences: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          facts?: Json
          preferences?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          facts?: Json
          preferences?: Json
          updated_at?: string
          user_id?: string
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
      wishlists: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_application_note: {
        Args: { _application_id: string; _body: string }
        Returns: string
      }
      approve_designer: { Args: { _application_id: string }; Returns: string }
      archive_application: {
        Args: { _application_id: string }
        Returns: undefined
      }
      decrement_stock_for_order: {
        Args: { _product_id: string; _qty: number }
        Returns: undefined
      }
      designer_level: { Args: { _designer_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_application_in_review: {
        Args: { _application_id: string }
        Returns: undefined
      }
      merge_anon_session: {
        Args: { _session_id: string; _user_id: string }
        Returns: number
      }
      notify_admins: {
        Args: { _body: string; _link: string; _title: string; _type: string }
        Returns: undefined
      }
      plan_priority: {
        Args: { _plan: Database["public"]["Enums"]["designer_plan"] }
        Returns: number
      }
      recompute_brand_dna: {
        Args: { _designer_id: string }
        Returns: undefined
      }
      reject_designer: {
        Args: { _application_id: string; _reason: string }
        Returns: undefined
      }
      resequence_posting_queue_day: {
        Args: { _day: string }
        Returns: undefined
      }
      slugify: { Args: { txt: string }; Returns: string }
      trend_momentum: {
        Args: { _world: string }
        Returns: {
          ema7: number
          forecast14: number
          history: number[]
          latest_score: number
          momentum: string
          slope: number
          term: string
          world: string
        }[]
      }
    }
    Enums: {
      ai_integration_kind:
        | "gmail"
        | "instagram"
        | "webhook"
        | "custom"
        | "tiktok"
        | "pinterest"
      app_role: "customer" | "designer" | "admin" | "designer_applicant"
      campaign_kind: "video" | "post" | "text"
      campaign_status:
        | "draft"
        | "proposed"
        | "in_review"
        | "changes_requested"
        | "approved"
        | "published"
        | "declined"
      designer_plan: "haus" | "atelier" | "maison"
      fulfillment_status:
        | "new"
        | "in_progress"
        | "packed"
        | "shipped"
        | "delivered"
      generation_status: "requested" | "running" | "done" | "failed"
      generation_tier: "accent" | "full"
      inventory_mode: "stock" | "made_to_order"
      message_category:
        | "allgemein"
        | "auszahlung"
        | "kampagne"
        | "produkt"
        | "technik"
      message_status: "open" | "closed"
      ontology_kind:
        | "category"
        | "silhouette"
        | "material"
        | "color"
        | "attribute"
        | "style"
        | "mood"
      order_status: "pending" | "paid" | "failed" | "refunded"
      posting_channel: "pawn_instagram" | "pawn_tiktok" | "pawn_youtube"
      posting_status: "queued" | "posted" | "failed" | "cancelled"
      product_status: "draft" | "published" | "archived"
      product_world: "Mode" | "Interior" | "Kunst"
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
      ai_integration_kind: [
        "gmail",
        "instagram",
        "webhook",
        "custom",
        "tiktok",
        "pinterest",
      ],
      app_role: ["customer", "designer", "admin", "designer_applicant"],
      campaign_kind: ["video", "post", "text"],
      campaign_status: [
        "draft",
        "proposed",
        "in_review",
        "changes_requested",
        "approved",
        "published",
        "declined",
      ],
      designer_plan: ["haus", "atelier", "maison"],
      fulfillment_status: [
        "new",
        "in_progress",
        "packed",
        "shipped",
        "delivered",
      ],
      generation_status: ["requested", "running", "done", "failed"],
      generation_tier: ["accent", "full"],
      inventory_mode: ["stock", "made_to_order"],
      message_category: [
        "allgemein",
        "auszahlung",
        "kampagne",
        "produkt",
        "technik",
      ],
      message_status: ["open", "closed"],
      ontology_kind: [
        "category",
        "silhouette",
        "material",
        "color",
        "attribute",
        "style",
        "mood",
      ],
      order_status: ["pending", "paid", "failed", "refunded"],
      posting_channel: ["pawn_instagram", "pawn_tiktok", "pawn_youtube"],
      posting_status: ["queued", "posted", "failed", "cancelled"],
      product_status: ["draft", "published", "archived"],
      product_world: ["Mode", "Interior", "Kunst"],
    },
  },
} as const
