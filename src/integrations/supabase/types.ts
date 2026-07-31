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
          channel: string | null
          clips: Json | null
          contacted_at: string | null
          created_at: string | null
          email: string | null
          followers: number | null
          followup_at: string | null
          handle: string
          id: string
          kurator_score: number | null
          language: string | null
          message_draft: string | null
          next_touch_at: string | null
          notes: string | null
          opt_out: boolean
          personal_line: string | null
          qc_passed: boolean | null
          score_reasons: Json | null
          scrape_images: Json | null
          source: string | null
          status: string
          updated_at: string | null
          warmed_at: string | null
          world: string | null
        }
        Insert: {
          bio?: string | null
          channel?: string | null
          clips?: Json | null
          contacted_at?: string | null
          created_at?: string | null
          email?: string | null
          followers?: number | null
          followup_at?: string | null
          handle: string
          id?: string
          kurator_score?: number | null
          language?: string | null
          message_draft?: string | null
          next_touch_at?: string | null
          notes?: string | null
          opt_out?: boolean
          personal_line?: string | null
          qc_passed?: boolean | null
          score_reasons?: Json | null
          scrape_images?: Json | null
          source?: string | null
          status?: string
          updated_at?: string | null
          warmed_at?: string | null
          world?: string | null
        }
        Update: {
          bio?: string | null
          channel?: string | null
          clips?: Json | null
          contacted_at?: string | null
          created_at?: string | null
          email?: string | null
          followers?: number | null
          followup_at?: string | null
          handle?: string
          id?: string
          kurator_score?: number | null
          language?: string | null
          message_draft?: string | null
          next_touch_at?: string | null
          notes?: string | null
          opt_out?: boolean
          personal_line?: string | null
          qc_passed?: boolean | null
          score_reasons?: Json | null
          scrape_images?: Json | null
          source?: string | null
          status?: string
          updated_at?: string | null
          warmed_at?: string | null
          world?: string | null
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
      ai_budget_ledger: {
        Row: {
          designer_id: string
          id: string
          month: string
          spent_cents: number
          updated_at: string
        }
        Insert: {
          designer_id: string
          id?: string
          month: string
          spent_cents?: number
          updated_at?: string
        }
        Update: {
          designer_id?: string
          id?: string
          month?: string
          spent_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_budget_ledger_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designers"
            referencedColumns: ["id"]
          },
        ]
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
      credits_ledger: {
        Row: {
          balance: number
          consumed: number
          created_at: string
          designer_id: string
          history: Json
          id: string
          month: string
          updated_at: string
        }
        Insert: {
          balance?: number
          consumed?: number
          created_at?: string
          designer_id: string
          history?: Json
          id?: string
          month: string
          updated_at?: string
        }
        Update: {
          balance?: number
          consumed?: number
          created_at?: string
          designer_id?: string
          history?: Json
          id?: string
          month?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credits_ledger_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designers"
            referencedColumns: ["id"]
          },
        ]
      }
      cultural_currents: {
        Row: {
          ausloeser: string | null
          created_at: string
          id: string
          nahe_haeuser: string[]
          name: string
          ontologie_begriffe: string[]
          praegende_kuenstler: Json
          quelle_typ: string
          quellen: Json
          updated_at: string
          visuelle_merkmale: Json
          worlds: string[]
          zeitraum: string | null
          zuversicht: string
        }
        Insert: {
          ausloeser?: string | null
          created_at?: string
          id?: string
          nahe_haeuser?: string[]
          name: string
          ontologie_begriffe?: string[]
          praegende_kuenstler?: Json
          quelle_typ?: string
          quellen?: Json
          updated_at?: string
          visuelle_merkmale?: Json
          worlds?: string[]
          zeitraum?: string | null
          zuversicht?: string
        }
        Update: {
          ausloeser?: string | null
          created_at?: string
          id?: string
          nahe_haeuser?: string[]
          name?: string
          ontologie_begriffe?: string[]
          praegende_kuenstler?: Json
          quelle_typ?: string
          quellen?: Json
          updated_at?: string
          visuelle_merkmale?: Json
          worlds?: string[]
          zeitraum?: string | null
          zuversicht?: string
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
      designer_billing_profiles: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          country: string | null
          created_at: string
          designer_id: string
          id: string
          invoice_next_number: number
          kleinunternehmer: boolean
          legal_name: string | null
          postal_code: string | null
          return_address_line1: string | null
          return_address_line2: string | null
          return_city: string | null
          return_country: string | null
          return_postal_code: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          designer_id: string
          id?: string
          invoice_next_number?: number
          kleinunternehmer?: boolean
          legal_name?: string | null
          postal_code?: string | null
          return_address_line1?: string | null
          return_address_line2?: string | null
          return_city?: string | null
          return_country?: string | null
          return_postal_code?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          designer_id?: string
          id?: string
          invoice_next_number?: number
          kleinunternehmer?: boolean
          legal_name?: string | null
          postal_code?: string | null
          return_address_line1?: string | null
          return_address_line2?: string | null
          return_city?: string | null
          return_country?: string | null
          return_postal_code?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "designer_billing_profiles_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: true
            referencedRelation: "designers"
            referencedColumns: ["id"]
          },
        ]
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
          application_id: string | null
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
          application_id?: string | null
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
          application_id?: string | null
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
      designer_page_blocks: {
        Row: {
          content: Json
          created_at: string
          designer_id: string
          id: string
          kind: Database["public"]["Enums"]["page_block_kind"]
          position: number
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          designer_id: string
          id?: string
          kind: Database["public"]["Enums"]["page_block_kind"]
          position?: number
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          designer_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["page_block_kind"]
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "designer_page_blocks_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
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
          aussenauge: Json
          avatar_url: string | null
          banner_url: string | null
          brand_dna: Json
          brand_name: string
          collection_title: string | null
          country: string | null
          created_at: string
          dismissed_suggestions: Json
          hero_image_url: string | null
          house_number: number | null
          id: string
          image_usage_consent: boolean
          image_usage_consent_at: string | null
          instagram: string | null
          is_featured: boolean
          location: string | null
          manifesto: string | null
          media_rights_granted_at: string | null
          page_published_at: string | null
          plan: Database["public"]["Enums"]["designer_plan"]
          portrait_url: string | null
          published: boolean
          quote: string | null
          quote_role: string | null
          revenue_share_pct: number
          shipping_rates: Json
          slug: string
          status: string
          story: string | null
          stripe_account_id: string | null
          stripe_charges_enabled: boolean
          stripe_details_submitted: boolean
          tags: string[] | null
          updated_at: string
          user_id: string
          video_taste_weights: Json
          website: string | null
        }
        Insert: {
          application_id?: string | null
          atelier_caption?: string | null
          atelier_image_url?: string | null
          aussenauge?: Json
          avatar_url?: string | null
          banner_url?: string | null
          brand_dna?: Json
          brand_name: string
          collection_title?: string | null
          country?: string | null
          created_at?: string
          dismissed_suggestions?: Json
          hero_image_url?: string | null
          house_number?: number | null
          id?: string
          image_usage_consent?: boolean
          image_usage_consent_at?: string | null
          instagram?: string | null
          is_featured?: boolean
          location?: string | null
          manifesto?: string | null
          media_rights_granted_at?: string | null
          page_published_at?: string | null
          plan?: Database["public"]["Enums"]["designer_plan"]
          portrait_url?: string | null
          published?: boolean
          quote?: string | null
          quote_role?: string | null
          revenue_share_pct?: number
          shipping_rates?: Json
          slug: string
          status?: string
          story?: string | null
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_details_submitted?: boolean
          tags?: string[] | null
          updated_at?: string
          user_id: string
          video_taste_weights?: Json
          website?: string | null
        }
        Update: {
          application_id?: string | null
          atelier_caption?: string | null
          atelier_image_url?: string | null
          aussenauge?: Json
          avatar_url?: string | null
          banner_url?: string | null
          brand_dna?: Json
          brand_name?: string
          collection_title?: string | null
          country?: string | null
          created_at?: string
          dismissed_suggestions?: Json
          hero_image_url?: string | null
          house_number?: number | null
          id?: string
          image_usage_consent?: boolean
          image_usage_consent_at?: string | null
          instagram?: string | null
          is_featured?: boolean
          location?: string | null
          manifesto?: string | null
          media_rights_granted_at?: string | null
          page_published_at?: string | null
          plan?: Database["public"]["Enums"]["designer_plan"]
          portrait_url?: string | null
          published?: boolean
          quote?: string | null
          quote_role?: string | null
          revenue_share_pct?: number
          shipping_rates?: Json
          slug?: string
          status?: string
          story?: string | null
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_details_submitted?: boolean
          tags?: string[] | null
          updated_at?: string
          user_id?: string
          video_taste_weights?: Json
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
      edition_participants: {
        Row: {
          campaign_id: string | null
          created_at: string
          designer_id: string
          edition_id: string
          error: string | null
          id: string
          status: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          designer_id: string
          edition_id: string
          error?: string | null
          id?: string
          status?: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          designer_id?: string
          edition_id?: string
          error?: string | null
          id?: string
          status?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "edition_participants_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edition_participants_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edition_participants_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
        ]
      }
      editions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          status: string
          theme: string
          updated_at: string
          world: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          status?: string
          theme: string
          updated_at?: string
          world?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          status?: string
          theme?: string
          updated_at?: string
          world?: string | null
        }
        Relationships: []
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
          provider_handles: Json | null
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
          provider_handles?: Json | null
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
          provider_handles?: Json | null
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
      house_milestones: {
        Row: {
          designer_id: string
          eigene_welt_at: string | null
          erste_kampagne_at: string | null
          erste_premiere_at: string | null
          erster_verkauf_at: string | null
          erstes_stueck_at: string | null
          updated_at: string
          verwandlung_at: string | null
        }
        Insert: {
          designer_id: string
          eigene_welt_at?: string | null
          erste_kampagne_at?: string | null
          erste_premiere_at?: string | null
          erster_verkauf_at?: string | null
          erstes_stueck_at?: string | null
          updated_at?: string
          verwandlung_at?: string | null
        }
        Update: {
          designer_id?: string
          eigene_welt_at?: string | null
          erste_kampagne_at?: string | null
          erste_premiere_at?: string | null
          erster_verkauf_at?: string | null
          erstes_stueck_at?: string | null
          updated_at?: string
          verwandlung_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "house_milestones_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: true
            referencedRelation: "designers"
            referencedColumns: ["id"]
          },
        ]
      }
      house_models: {
        Row: {
          altersgruppe: string | null
          ausstrahlung: string | null
          base_image_url: string | null
          created_at: string
          designer_id: string
          freitext: string | null
          haar: string | null
          hautton: string | null
          id: string
          name: string
          statur: string | null
        }
        Insert: {
          altersgruppe?: string | null
          ausstrahlung?: string | null
          base_image_url?: string | null
          created_at?: string
          designer_id: string
          freitext?: string | null
          haar?: string | null
          hautton?: string | null
          id?: string
          name: string
          statur?: string | null
        }
        Update: {
          altersgruppe?: string | null
          ausstrahlung?: string | null
          base_image_url?: string | null
          created_at?: string
          designer_id?: string
          freitext?: string | null
          haar?: string | null
          hautton?: string | null
          id?: string
          name?: string
          statur?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "house_models_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designers"
            referencedColumns: ["id"]
          },
        ]
      }
      house_settings: {
        Row: {
          created_at: string
          designer_id: string
          id: string
          licht: string | null
          name: string
          ort: string | null
          palette: string | null
          quelle: string
          referenzbilder: string[]
          stimmung: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          designer_id: string
          id?: string
          licht?: string | null
          name: string
          ort?: string | null
          palette?: string | null
          quelle?: string
          referenzbilder?: string[]
          stimmung?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          designer_id?: string
          id?: string
          licht?: string | null
          name?: string
          ort?: string | null
          palette?: string | null
          quelle?: string
          referenzbilder?: string[]
          stimmung?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "house_settings_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designers"
            referencedColumns: ["id"]
          },
        ]
      }
      house_signatures: {
        Row: {
          created_at: string
          designer_id: string
          id: string
          name: string
          preview_url: string | null
          recipe: Json
        }
        Insert: {
          created_at?: string
          designer_id: string
          id?: string
          name: string
          preview_url?: string | null
          recipe?: Json
        }
        Update: {
          created_at?: string
          designer_id?: string
          id?: string
          name?: string
          preview_url?: string | null
          recipe?: Json
        }
        Relationships: [
          {
            foreignKeyName: "house_signatures_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designers"
            referencedColumns: ["id"]
          },
        ]
      }
      house_themes: {
        Row: {
          bewegungscharakter: string
          created_at: string
          designer_id: string
          farbwelt: Json
          flaechenrhythmus: string
          guardrail_notes: Json
          hintergrundtextur: Json
          id: string
          input_prompt: string | null
          is_current: boolean
          kantenhaerte: string
          name: string | null
          quelle: string
          typografie: string
          uebergangsart: string
          updated_at: string
          version: number
          zuversicht: string
        }
        Insert: {
          bewegungscharakter?: string
          created_at?: string
          designer_id: string
          farbwelt?: Json
          flaechenrhythmus?: string
          guardrail_notes?: Json
          hintergrundtextur?: Json
          id?: string
          input_prompt?: string | null
          is_current?: boolean
          kantenhaerte?: string
          name?: string | null
          quelle?: string
          typografie?: string
          uebergangsart?: string
          updated_at?: string
          version?: number
          zuversicht?: string
        }
        Update: {
          bewegungscharakter?: string
          created_at?: string
          designer_id?: string
          farbwelt?: Json
          flaechenrhythmus?: string
          guardrail_notes?: Json
          hintergrundtextur?: Json
          id?: string
          input_prompt?: string | null
          is_current?: boolean
          kantenhaerte?: string
          name?: string | null
          quelle?: string
          typografie?: string
          uebergangsart?: string
          updated_at?: string
          version?: number
          zuversicht?: string
        }
        Relationships: [
          {
            foreignKeyName: "house_themes_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designers"
            referencedColumns: ["id"]
          },
        ]
      }
      jarvis_experiments: {
        Row: {
          after: Json | null
          baseline: number | null
          before: Json | null
          changed_key: string
          evaluated_at: string | null
          hypothesis: string
          id: string
          metric: string
          result: number | null
          started_at: string
          status: string
        }
        Insert: {
          after?: Json | null
          baseline?: number | null
          before?: Json | null
          changed_key: string
          evaluated_at?: string | null
          hypothesis: string
          id?: string
          metric: string
          result?: number | null
          started_at?: string
          status?: string
        }
        Update: {
          after?: Json | null
          baseline?: number | null
          before?: Json | null
          changed_key?: string
          evaluated_at?: string | null
          hypothesis?: string
          id?: string
          metric?: string
          result?: number | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      jarvis_memory: {
        Row: {
          content: string
          created_at: string
          id: string
          last_used_at: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          last_used_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          last_used_at?: string | null
        }
        Relationships: []
      }
      jarvis_notices: {
        Row: {
          body: string
          created_at: string
          dismissed_at: string | null
          id: string
          kind: string
          suggested_action: Json | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          dismissed_at?: string | null
          id?: string
          kind: string
          suggested_action?: Json | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          dismissed_at?: string | null
          id?: string
          kind?: string
          suggested_action?: Json | null
          title?: string
        }
        Relationships: []
      }
      jarvis_pending_actions: {
        Row: {
          action: string
          created_at: string
          expires_at: string
          id: string
          params: Json
          reason: string | null
          resolved_at: string | null
          resolved_by: string | null
          result: Json | null
          status: string
        }
        Insert: {
          action: string
          created_at?: string
          expires_at?: string
          id?: string
          params?: Json
          reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          result?: Json | null
          status?: string
        }
        Update: {
          action?: string
          created_at?: string
          expires_at?: string
          id?: string
          params?: Json
          reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          result?: Json | null
          status?: string
        }
        Relationships: []
      }
      jarvis_reports: {
        Row: {
          body: string
          created_at: string
          data: Json | null
          id: string
          kind: string
          read_at: string | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          data?: Json | null
          id?: string
          kind: string
          read_at?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: Json | null
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
          mode: string | null
          started_at: string
          status: string
          summary: string | null
          tokens_used: number | null
          trigger: string
        }
        Insert: {
          cost_estimate?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          mode?: string | null
          started_at?: string
          status?: string
          summary?: string | null
          tokens_used?: number | null
          trigger?: string
        }
        Update: {
          cost_estimate?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          mode?: string | null
          started_at?: string
          status?: string
          summary?: string | null
          tokens_used?: number | null
          trigger?: string
        }
        Relationships: []
      }
      media_assets: {
        Row: {
          advertises_text: string | null
          campaign_id: string | null
          created_at: string
          designer_id: string
          id: string
          kind: Database["public"]["Enums"]["media_kind"]
          note: string | null
          origin: Database["public"]["Enums"]["media_origin"]
          performance: Json
          product_id: string | null
          review_note: string | null
          review_status: Database["public"]["Enums"]["media_review_status"]
          rights_granted: boolean
          thumb_url: string | null
          title: string | null
          updated_at: string
          url: string
          usages: Json
          video_asset_id: string | null
        }
        Insert: {
          advertises_text?: string | null
          campaign_id?: string | null
          created_at?: string
          designer_id: string
          id?: string
          kind: Database["public"]["Enums"]["media_kind"]
          note?: string | null
          origin?: Database["public"]["Enums"]["media_origin"]
          performance?: Json
          product_id?: string | null
          review_note?: string | null
          review_status?: Database["public"]["Enums"]["media_review_status"]
          rights_granted?: boolean
          thumb_url?: string | null
          title?: string | null
          updated_at?: string
          url: string
          usages?: Json
          video_asset_id?: string | null
        }
        Update: {
          advertises_text?: string | null
          campaign_id?: string | null
          created_at?: string
          designer_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["media_kind"]
          note?: string | null
          origin?: Database["public"]["Enums"]["media_origin"]
          performance?: Json
          product_id?: string | null
          review_note?: string | null
          review_status?: Database["public"]["Enums"]["media_review_status"]
          rights_granted?: boolean
          thumb_url?: string | null
          title?: string | null
          updated_at?: string
          url?: string
          usages?: Json
          video_asset_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_video_asset_id_fkey"
            columns: ["video_asset_id"]
            isOneToOne: false
            referencedRelation: "video_assets"
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
          application_fee_cents: number | null
          buyer_locale: string
          carrier: string | null
          confirmation_email_sent_at: string | null
          created_at: string
          currency: string
          customer_email: string | null
          delivered_at: string | null
          destination_account: string | null
          fulfillment_status: Database["public"]["Enums"]["fulfillment_status"]
          id: string
          invoice_number: string | null
          items: Json
          last_email_error: string | null
          shipped_at: string | null
          shipped_email_sent_at: string | null
          shipping_address_line1: string | null
          shipping_address_line2: string | null
          shipping_city: string | null
          shipping_country: string | null
          shipping_name: string | null
          shipping_postal_code: string | null
          status: Database["public"]["Enums"]["order_status"]
          stripe_session_id: string | null
          tracking_number: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount_total?: number
          application_fee_cents?: number | null
          buyer_locale?: string
          carrier?: string | null
          confirmation_email_sent_at?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          delivered_at?: string | null
          destination_account?: string | null
          fulfillment_status?: Database["public"]["Enums"]["fulfillment_status"]
          id?: string
          invoice_number?: string | null
          items?: Json
          last_email_error?: string | null
          shipped_at?: string | null
          shipped_email_sent_at?: string | null
          shipping_address_line1?: string | null
          shipping_address_line2?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_name?: string | null
          shipping_postal_code?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          stripe_session_id?: string | null
          tracking_number?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount_total?: number
          application_fee_cents?: number | null
          buyer_locale?: string
          carrier?: string | null
          confirmation_email_sent_at?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          delivered_at?: string | null
          destination_account?: string | null
          fulfillment_status?: Database["public"]["Enums"]["fulfillment_status"]
          id?: string
          invoice_number?: string | null
          items?: Json
          last_email_error?: string | null
          shipped_at?: string | null
          shipped_email_sent_at?: string | null
          shipping_address_line1?: string | null
          shipping_address_line2?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_name?: string | null
          shipping_postal_code?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          stripe_session_id?: string | null
          tracking_number?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      page_visits: {
        Row: {
          dwell_seconds: number
          first_seen_at: string
          id: string
          last_seen_at: string
          target_id: string
          target_type: string
          user_id: string
          visit_count: number
        }
        Insert: {
          dwell_seconds?: number
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          target_id: string
          target_type: string
          user_id: string
          visit_count?: number
        }
        Update: {
          dwell_seconds?: number
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          target_id?: string
          target_type?: string
          user_id?: string
          visit_count?: number
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
          story_reason: string | null
          story_score: number | null
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
          story_reason?: string | null
          story_score?: number | null
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
          story_reason?: string | null
          story_score?: number | null
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
          product_id: string | null
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
          product_id?: string | null
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
          product_id?: string | null
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
          banner_media_asset_id: string | null
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
          view_count: number
          weight_grams: number | null
          width_cm: number | null
          world: Database["public"]["Enums"]["product_world"]
        }
        Insert: {
          allow_custom_requests?: boolean
          banner_media_asset_id?: string | null
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
          view_count?: number
          weight_grams?: number | null
          width_cm?: number | null
          world?: Database["public"]["Enums"]["product_world"]
        }
        Update: {
          allow_custom_requests?: boolean
          banner_media_asset_id?: string | null
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
          view_count?: number
          weight_grams?: number | null
          width_cm?: number | null
          world?: Database["public"]["Enums"]["product_world"]
        }
        Relationships: [
          {
            foreignKeyName: "products_banner_media_asset_id_fkey"
            columns: ["banner_media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
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
      referrals: {
        Row: {
          code: string
          created_at: string
          credited: boolean
          credited_at: string | null
          first_order_id: string | null
          id: string
          referred_user_id: string
          referrer_designer_id: string
        }
        Insert: {
          code: string
          created_at?: string
          credited?: boolean
          credited_at?: string | null
          first_order_id?: string | null
          id?: string
          referred_user_id: string
          referrer_designer_id: string
        }
        Update: {
          code?: string
          created_at?: string
          credited?: boolean
          credited_at?: string | null
          first_order_id?: string | null
          id?: string
          referred_user_id?: string
          referrer_designer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_first_order_id_fkey"
            columns: ["first_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_designer_id_fkey"
            columns: ["referrer_designer_id"]
            isOneToOne: false
            referencedRelation: "designers"
            referencedColumns: ["id"]
          },
        ]
      }
      site_content: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
          value_en: Json | null
          value_en_source: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
          value_en?: Json | null
          value_en_source?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
          value_en?: Json | null
          value_en_source?: string | null
        }
        Relationships: []
      }
      staging_requests: {
        Row: {
          art: string
          created_at: string
          designer_id: string
          error: string | null
          id: string
          product_id: string | null
          request_handle: Json | null
          result_url: string | null
          run_id: string
          source_url: string
          status: string
          template_id: string
          updated_at: string
        }
        Insert: {
          art: string
          created_at?: string
          designer_id: string
          error?: string | null
          id?: string
          product_id?: string | null
          request_handle?: Json | null
          result_url?: string | null
          run_id?: string
          source_url: string
          status?: string
          template_id: string
          updated_at?: string
        }
        Update: {
          art?: string
          created_at?: string
          designer_id?: string
          error?: string | null
          id?: string
          product_id?: string | null
          request_handle?: Json | null
          result_url?: string | null
          run_id?: string
          source_url?: string
          status?: string
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staging_requests_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staging_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      style_references: {
        Row: {
          beschreibung: string | null
          created_at: string
          herkunft: string
          id: string
          path: string
          url: string
          user_id: string
        }
        Insert: {
          beschreibung?: string | null
          created_at?: string
          herkunft?: string
          id?: string
          path: string
          url: string
          user_id: string
        }
        Update: {
          beschreibung?: string | null
          created_at?: string
          herkunft?: string
          id?: string
          path?: string
          url?: string
          user_id?: string
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
      video_assets: {
        Row: {
          campaign_id: string | null
          created_at: string
          designer_id: string
          id: string
          performance: Json
          premiere: boolean
          rights_granted: boolean
          source: Database["public"]["Enums"]["video_source"]
          thumb: string | null
          url: string
          video_dna: Json
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          designer_id: string
          id?: string
          performance?: Json
          premiere?: boolean
          rights_granted?: boolean
          source?: Database["public"]["Enums"]["video_source"]
          thumb?: string | null
          url: string
          video_dna?: Json
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          designer_id?: string
          id?: string
          performance?: Json
          premiere?: boolean
          rights_granted?: boolean
          source?: Database["public"]["Enums"]["video_source"]
          thumb?: string | null
          url?: string
          video_dna?: Json
        }
        Relationships: [
          {
            foreignKeyName: "video_assets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_assets_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designers"
            referencedColumns: ["id"]
          },
        ]
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
      add_dwell_seconds: {
        Args: { p_seconds: number; p_target_id: string; p_target_type: string }
        Returns: undefined
      }
      approve_designer: { Args: { _application_id: string }; Returns: string }
      archive_application: {
        Args: { _application_id: string }
        Returns: undefined
      }
      book_ai_spend: {
        Args: { _cents: number; _designer_id: string }
        Returns: Json
      }
      book_credit_spend: {
        Args: {
          _action: string
          _check_only?: boolean
          _credits: number
          _designer_id: string
          _model?: string
        }
        Returns: Json
      }
      bump_media_metric: {
        Args: { p_media_asset_id: string; p_metric: string }
        Returns: undefined
      }
      bump_product_view: { Args: { p_product_id: string }; Returns: undefined }
      bump_video_metric: {
        Args: { p_asset_id: string; p_metric: string }
        Returns: undefined
      }
      customer_behavior_segments: {
        Args: never
        Returns: {
          anteil: number
          avg_bestellungen: number
          kunden: number
          merkmal: string
          segment: string
        }[]
      }
      decrement_stock_for_order: {
        Args: { _product_id: string; _qty: number }
        Returns: undefined
      }
      designer_level: { Args: { _designer_id: string }; Returns: Json }
      designer_product_engagement: {
        Args: { p_designer_id: string }
        Returns: {
          avg_dwell_seconds: number
          product_id: string
          returning_visitors: number
          total_visits: number
          unique_visitors: number
        }[]
      }
      grant_credits: {
        Args: { _credits: number; _designer_id: string; _note?: string }
        Returns: Json
      }
      grant_referral_credit: {
        Args: { p_order_id: string; p_ref_code: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      jarvis_heartbeat_sql: { Args: never; Returns: Json }
      mark_application_in_review: {
        Args: { _application_id: string }
        Returns: undefined
      }
      merge_anon_session: {
        Args: { _session_id: string; _user_id: string }
        Returns: number
      }
      next_invoice_number: { Args: { _designer_id: string }; Returns: string }
      notify_admins: {
        Args: { _body: string; _link: string; _title: string; _type: string }
        Returns: undefined
      }
      plan_priority: {
        Args: { _plan: Database["public"]["Enums"]["designer_plan"] }
        Returns: number
      }
      promote_posting_suggestion: {
        Args: { p_queue_id: string }
        Returns: undefined
      }
      recompute_brand_dna: {
        Args: { _designer_id: string }
        Returns: undefined
      }
      recompute_house_milestones: {
        Args: { p_designer_id: string }
        Returns: undefined
      }
      record_page_visit: {
        Args: { p_target_id: string; p_target_type: string }
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
      media_kind: "bild" | "video"
      media_origin: "upload" | "erzeugt" | "edition"
      media_review_status: "privat" | "eingereicht" | "angenommen" | "abgelehnt"
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
      page_block_kind:
        | "auftakt"
        | "editorial_text"
        | "zitat"
        | "produktreihe"
        | "lookbook_streifen"
        | "banner_seitlich"
        | "banner_vollbreite"
        | "ueberlappend"
      posting_channel: "pawn_instagram" | "pawn_tiktok" | "pawn_youtube"
      posting_status: "queued" | "posted" | "failed" | "cancelled" | "vorschlag"
      product_status: "draft" | "published" | "archived"
      product_world: "Mode" | "Interior" | "Kunst"
      video_source: "designer" | "edition" | "jarvis"
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
      media_kind: ["bild", "video"],
      media_origin: ["upload", "erzeugt", "edition"],
      media_review_status: ["privat", "eingereicht", "angenommen", "abgelehnt"],
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
      page_block_kind: [
        "auftakt",
        "editorial_text",
        "zitat",
        "produktreihe",
        "lookbook_streifen",
        "banner_seitlich",
        "banner_vollbreite",
        "ueberlappend",
      ],
      posting_channel: ["pawn_instagram", "pawn_tiktok", "pawn_youtube"],
      posting_status: ["queued", "posted", "failed", "cancelled", "vorschlag"],
      product_status: ["draft", "published", "archived"],
      product_world: ["Mode", "Interior", "Kunst"],
      video_source: ["designer", "edition", "jarvis"],
    },
  },
} as const
