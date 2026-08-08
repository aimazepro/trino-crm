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
      activities: {
        Row: {
          assignee_id: string | null
          completed: boolean
          created_at: string
          date: string
          deal_id: string
          description: string | null
          end_date: string | null
          guests: Json
          id: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          assignee_id?: string | null
          completed?: boolean
          created_at?: string
          date: string
          deal_id: string
          description?: string | null
          end_date?: string | null
          guests?: Json
          id?: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          assignee_id?: string | null
          completed?: boolean
          created_at?: string
          date?: string
          deal_id?: string
          description?: string | null
          end_date?: string | null
          guests?: Json
          id?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_attachments: {
        Row: {
          activity_id: string
          created_at: string
          file_name: string
          file_path: string
          id: string
          size_bytes: number
          user_id: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          size_bytes?: number
          user_id: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          size_bytes?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_attachments_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_types: {
        Row: {
          active: boolean
          created_at: string
          icon: string
          id: string
          is_system: boolean
          name: string
          sort_order: number
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          icon?: string
          id?: string
          is_system?: boolean
          name: string
          sort_order?: number
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          icon?: string
          id?: string
          is_system?: boolean
          name?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          revoked?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked?: boolean
          user_id?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          attendant: string
          created_at: string
          date: string
          deal_id: string
          id: string
          link: string | null
          procedure: string
          status: string
        }
        Insert: {
          attendant: string
          created_at?: string
          date: string
          deal_id: string
          id?: string
          link?: string | null
          procedure: string
          status?: string
        }
        Update: {
          attendant?: string
          created_at?: string
          date?: string
          deal_id?: string
          id?: string
          link?: string | null
          procedure?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_email_queue: {
        Row: {
          automation_id: string | null
          body: string | null
          created_at: string | null
          deal_id: string | null
          error: string | null
          id: string
          sent_at: string | null
          status: string
          subject: string | null
          template_id: string | null
          to_email: string | null
          user_id: string
        }
        Insert: {
          automation_id?: string | null
          body?: string | null
          created_at?: string | null
          deal_id?: string | null
          error?: string | null
          id?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
          to_email?: string | null
          user_id: string
        }
        Update: {
          automation_id?: string | null
          body?: string | null
          created_at?: string | null
          deal_id?: string | null
          error?: string | null
          id?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
          to_email?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_email_queue_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_email_queue_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_labels: {
        Row: {
          color: string
          created_at: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      automation_whatsapp_queue: {
        Row: {
          automation_id: string | null
          created_at: string | null
          deal_id: string | null
          error: string | null
          id: string
          message: string | null
          phone: string | null
          sent_at: string | null
          status: string
          template_id: string | null
          user_id: string
        }
        Insert: {
          automation_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          error?: string | null
          id?: string
          message?: string | null
          phone?: string | null
          sent_at?: string | null
          status?: string
          template_id?: string | null
          user_id: string
        }
        Update: {
          automation_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          error?: string | null
          id?: string
          message?: string | null
          phone?: string | null
          sent_at?: string | null
          status?: string
          template_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_whatsapp_queue_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_whatsapp_queue_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          execution_count: number | null
          id: string
          label_ids: string[] | null
          name: string
          steps: Json | null
          trigger: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          execution_count?: number | null
          id?: string
          label_ids?: string[] | null
          name?: string
          steps?: Json | null
          trigger?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          execution_count?: number | null
          id?: string
          label_ids?: string[] | null
          name?: string
          steps?: Json | null
          trigger?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          city: string | null
          cnpj: string | null
          created_at: string
          id: string
          name: string
          segment: string | null
          size: string | null
          state: string | null
          user_id: string
          website: string | null
        }
        Insert: {
          city?: string | null
          cnpj?: string | null
          created_at?: string
          id?: string
          name: string
          segment?: string | null
          size?: string | null
          state?: string | null
          user_id: string
          website?: string | null
        }
        Update: {
          city?: string | null
          cnpj?: string | null
          created_at?: string
          id?: string
          name?: string
          segment?: string | null
          size?: string | null
          state?: string | null
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      company_history: {
        Row: {
          company_id: string
          created_at: string
          description: string
          id: string
          subtext: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description: string
          id?: string
          subtext?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string
          id?: string
          subtext?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_history: {
        Row: {
          contact_id: string
          created_at: string
          description: string
          id: string
          subtext: string
          user_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          description: string
          id?: string
          subtext?: string
          user_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          description?: string
          id?: string
          subtext?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_history_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          company_id: string | null
          created_at: string
          emails: Json
          id: string
          name: string
          phones: Json
          role: string | null
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          emails?: Json
          id?: string
          name: string
          phones?: Json
          role?: string | null
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          emails?: Json
          id?: string
          name?: string
          phones?: Json
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_groups: {
        Row: {
          created_at: string
          entity: string
          id: string
          name: string
          sort_order: number
          user_id: string
        }
        Insert: {
          created_at?: string
          entity: string
          id?: string
          name: string
          sort_order?: number
          user_id: string
        }
        Update: {
          created_at?: string
          entity?: string
          id?: string
          name?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: []
      }
      custom_fields: {
        Row: {
          created_at: string
          entity: string
          field_group: string
          field_type: string
          id: string
          label: string
          options: Json
          required: boolean
          sort_order: number
          user_id: string
        }
        Insert: {
          created_at?: string
          entity: string
          field_group?: string
          field_type?: string
          id?: string
          label: string
          options?: Json
          required?: boolean
          sort_order?: number
          user_id: string
        }
        Update: {
          created_at?: string
          entity?: string
          field_group?: string
          field_type?: string
          id?: string
          label?: string
          options?: Json
          required?: boolean
          sort_order?: number
          user_id?: string
        }
        Relationships: []
      }
      deal_field_values: {
        Row: {
          created_at: string | null
          deal_id: string
          field_id: string
          id: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          created_at?: string | null
          deal_id: string
          field_id: string
          id?: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          created_at?: string | null
          deal_id?: string
          field_id?: string
          id?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_field_values_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_field_values_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "custom_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_history: {
        Row: {
          created_at: string
          deal_id: string
          description: string
          id: string
          subtext: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          description: string
          id?: string
          subtext?: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          description?: string
          id?: string
          subtext?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_labels: {
        Row: {
          deal_id: string
          label_id: string
        }
        Insert: {
          deal_id: string
          label_id: string
        }
        Update: {
          deal_id?: string
          label_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_labels_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_labels_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_notes: {
        Row: {
          content: string
          created_at: string
          deal_id: string
          id: string
        }
        Insert: {
          content: string
          created_at?: string
          deal_id: string
          id?: string
        }
        Update: {
          content?: string
          created_at?: string
          deal_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_notes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_products: {
        Row: {
          created_at: string
          deal_id: string
          id: string
          name: string
          price: number
          quantity: number
        }
        Insert: {
          created_at?: string
          deal_id: string
          id?: string
          name: string
          price?: number
          quantity?: number
        }
        Update: {
          created_at?: string
          deal_id?: string
          id?: string
          name?: string
          price?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "deal_products_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          company_id: string | null
          contact_id: string | null
          created_at: string
          days_in_stage: number
          delete_note: string | null
          delete_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          expected_close_date: string | null
          id: string
          loss_reason: string | null
          owner_id: string | null
          pipeline_id: string
          probability: number | null
          source: string | null
          stage_entered_at: string | null
          stage_id: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          days_in_stage?: number
          delete_note?: string | null
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          expected_close_date?: string | null
          id?: string
          loss_reason?: string | null
          owner_id?: string | null
          pipeline_id: string
          probability?: number | null
          source?: string | null
          stage_entered_at?: string | null
          stage_id?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
          value?: number
        }
        Update: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          days_in_stage?: number
          delete_note?: string | null
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          expected_close_date?: string | null
          id?: string
          loss_reason?: string | null
          owner_id?: string | null
          pipeline_id?: string
          probability?: number | null
          source?: string | null
          stage_entered_at?: string | null
          stage_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      delete_reasons: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          sort_order: number
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: []
      }
      email_signatures: {
        Row: {
          company: string
          enabled: boolean
          logo_url: string | null
          name: string
          phone: string
          photo_url: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company?: string
          enabled?: boolean
          logo_url?: string | null
          name?: string
          phone?: string
          photo_url?: string | null
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string
          enabled?: boolean
          logo_url?: string | null
          name?: string
          phone?: string
          photo_url?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          name: string
          subject: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          name: string
          subject?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          name?: string
          subject?: string
          user_id?: string
        }
        Relationships: []
      }
      emails: {
        Row: {
          body_html: string
          contact_id: string
          created_at: string
          deal_id: string | null
          direction: string
          from_email: string
          gmail_message_id: string | null
          id: string
          opened_at: string | null
          subject: string
          to_email: string
          track_id: string
          user_id: string
        }
        Insert: {
          body_html?: string
          contact_id: string
          created_at?: string
          deal_id?: string | null
          direction: string
          from_email?: string
          gmail_message_id?: string | null
          id?: string
          opened_at?: string | null
          subject?: string
          to_email?: string
          track_id?: string
          user_id: string
        }
        Update: {
          body_html?: string
          contact_id?: string
          created_at?: string
          deal_id?: string | null
          direction?: string
          from_email?: string
          gmail_message_id?: string | null
          id?: string
          opened_at?: string | null
          subject?: string
          to_email?: string
          track_id?: string
          user_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          created_at: string
          end_date: string | null
          goal_type: string
          id: string
          metric: string
          owner_user_id: string | null
          period: string
          pipeline_id: string | null
          start_date: string | null
          target_value: number
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          goal_type: string
          id?: string
          metric?: string
          owner_user_id?: string | null
          period?: string
          pipeline_id?: string | null
          start_date?: string | null
          target_value?: number
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          goal_type?: string
          id?: string
          metric?: string
          owner_user_id?: string | null
          period?: string
          pipeline_id?: string | null
          start_date?: string | null
          target_value?: number
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          access_token: string | null
          account_email: string | null
          active: boolean
          created_at: string
          expires_at: string | null
          id: string
          provider: string
          refresh_token: string | null
          scopes: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          account_email?: string | null
          active?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          provider: string
          refresh_token?: string | null
          scopes?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          account_email?: string | null
          active?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          provider?: string
          refresh_token?: string | null
          scopes?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      labels: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      loss_reasons: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          sort_order: number
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          href: string
          id: string
          read: boolean
          subtext: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          href: string
          id?: string
          read?: boolean
          subtext?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          href?: string
          id?: string
          read?: boolean
          subtext?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          created_at: string
          id: string
          max_days: number
          name: string
          order: number
          pipeline_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_days?: number
          name: string
          order?: number
          pipeline_id: string
        }
        Update: {
          created_at?: string
          id?: string
          max_days?: number
          name?: string
          order?: number
          pipeline_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          price: number
          sku: string | null
          unit: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          price?: number
          sku?: string | null
          unit?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          price?: number
          sku?: string | null
          unit?: string | null
          user_id?: string
        }
        Relationships: []
      }
      saved_reports: {
        Row: {
          config: Json
          created_at: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          config?: Json
          created_at?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      scripts: {
        Row: {
          category: string | null
          content: string
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          category?: string | null
          content?: string
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      sequence_enrollments: {
        Row: {
          automation_id: string | null
          current_step: number | null
          deal_id: string | null
          enrolled_at: string | null
          id: string
          sequence_id: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          automation_id?: string | null
          current_step?: number | null
          deal_id?: string | null
          enrolled_at?: string | null
          id?: string
          sequence_id?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          automation_id?: string | null
          current_step?: number | null
          deal_id?: string | null
          enrolled_at?: string | null
          id?: string
          sequence_id?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sequence_enrollments_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_enrollments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_enrollments_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      sequence_steps: {
        Row: {
          day_offset: number
          id: string
          note: string
          sequence_id: string
          sort_order: number
          step_type: string
        }
        Insert: {
          day_offset?: number
          id?: string
          note?: string
          sequence_id: string
          sort_order?: number
          step_type: string
        }
        Update: {
          day_offset?: number
          id?: string
          note?: string
          sequence_id?: string
          sort_order?: number
          step_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sequence_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      sequences: {
        Row: {
          created_at: string
          description: string
          id: string
          name: string
          skip_weekends: boolean
          tags: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          name: string
          skip_weekends?: boolean
          tags?: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          name?: string
          skip_weekends?: boolean
          tags?: string[]
          user_id?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          accepted_at: string | null
          email: string
          id: string
          invited_at: string
          member_user_id: string | null
          name: string | null
          owner_user_id: string
          role: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          email: string
          id?: string
          invited_at?: string
          member_user_id?: string | null
          name?: string | null
          owner_user_id: string
          role?: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          email?: string
          id?: string
          invited_at?: string
          member_user_id?: string | null
          name?: string | null
          owner_user_id?: string
          role?: string
          status?: string
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          attempts: number
          created_at: string
          error: string | null
          event: string
          id: string
          payload: Json
          response_code: number | null
          sent_at: string | null
          status: string
          user_id: string
          webhook_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error?: string | null
          event: string
          id?: string
          payload: Json
          response_code?: number | null
          sent_at?: string | null
          status?: string
          user_id: string
          webhook_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error?: string | null
          event?: string
          id?: string
          payload?: Json
          response_code?: number | null
          sent_at?: string | null
          status?: string
          user_id?: string
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          active: boolean
          created_at: string
          events: string[]
          id: string
          secret: string | null
          url: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          events?: string[]
          id?: string
          secret?: string | null
          url: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          events?: string[]
          id?: string
          secret?: string | null
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_templates: {
        Row: {
          created_at: string
          id: string
          message: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      workspace_settings: {
        Row: {
          created_at: string
          name: string
          owner_user_id: string
          plan: string
          slug: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          name?: string
          owner_user_id: string
          plan?: string
          slug?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          name?: string
          owner_user_id?: string
          plan?: string
          slug?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_pending_email_queue: {
        Args: { p_limit?: number }
        Returns: {
          automation_id: string | null
          body: string | null
          created_at: string | null
          deal_id: string | null
          error: string | null
          id: string
          sent_at: string | null
          status: string
          subject: string | null
          template_id: string | null
          to_email: string | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "automation_email_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_pending_whatsapp_queue: {
        Args: { p_limit?: number }
        Returns: {
          automation_id: string | null
          created_at: string | null
          deal_id: string | null
          error: string | null
          id: string
          message: string | null
          phone: string | null
          sent_at: string | null
          status: string
          template_id: string | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "automation_whatsapp_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      enqueue_webhook_delivery: {
        Args: { p_event: string; p_payload: Json; p_user: string }
        Returns: undefined
      }
      is_workspace_member: { Args: { owner_id: string }; Returns: boolean }
      replace_deal_labels: {
        Args: { p_deal_id: string; p_label_ids: string[] }
        Returns: undefined
      }
      replace_deal_products: {
        Args: { p_deal_id: string; p_products: Json }
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
    Enums: {},
  },
} as const
