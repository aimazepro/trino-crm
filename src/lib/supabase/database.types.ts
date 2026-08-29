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
          calendar_synced_at: string | null
          completed: boolean
          created_at: string
          date: string
          deal_id: string
          description: string | null
          end_date: string | null
          google_event_id: string | null
          guests: Json
          id: string
          meet_link: string | null
          title: string
          type: string
          workspace_id: string
        }
        Insert: {
          assignee_id?: string | null
          calendar_synced_at?: string | null
          completed?: boolean
          created_at?: string
          date: string
          deal_id: string
          description?: string | null
          end_date?: string | null
          google_event_id?: string | null
          guests?: Json
          id?: string
          meet_link?: string | null
          title: string
          type: string
          workspace_id: string
        }
        Update: {
          assignee_id?: string | null
          calendar_synced_at?: string | null
          completed?: boolean
          created_at?: string
          date?: string
          deal_id?: string
          description?: string | null
          end_date?: string | null
          google_event_id?: string | null
          guests?: Json
          id?: string
          meet_link?: string | null
          title?: string
          type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_attachments: {
        Row: {
          activity_id: string
          actor_user_id: string
          created_at: string
          file_name: string
          file_path: string
          id: string
          size_bytes: number
        }
        Insert: {
          activity_id: string
          actor_user_id: string
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          size_bytes?: number
        }
        Update: {
          activity_id?: string
          actor_user_id?: string
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          size_bytes?: number
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
          workspace_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          icon?: string
          id?: string
          is_system?: boolean
          name: string
          sort_order?: number
          workspace_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          icon?: string
          id?: string
          is_system?: boolean
          name?: string
          sort_order?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_types_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      api_idempotency_keys: {
        Row: {
          created_at: string
          idempotency_key: string
          method: string
          path: string
          response_body: Json
          response_status: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          idempotency_key: string
          method: string
          path: string
          response_body: Json
          response_status: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          idempotency_key?: string
          method?: string
          path?: string
          response_body?: Json
          response_status?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_idempotency_keys_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          default_owner_id: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          permissions: Json
          rate_limit_per_min: number
          revoked: boolean
          workspace_id: string
        }
        Insert: {
          created_at?: string
          default_owner_id?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          permissions?: Json
          rate_limit_per_min?: number
          revoked?: boolean
          workspace_id: string
        }
        Update: {
          created_at?: string
          default_owner_id?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          permissions?: Json
          rate_limit_per_min?: number
          revoked?: boolean
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      api_rate_limit_windows: {
        Row: {
          api_key_id: string
          request_count: number
          window_start: string
        }
        Insert: {
          api_key_id: string
          request_count?: number
          window_start: string
        }
        Update: {
          api_key_id?: string
          request_count?: number
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_rate_limit_windows_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
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
          workspace_id: string
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
          workspace_id: string
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
          workspace_id?: string
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
          {
            foreignKeyName: "automation_email_queue_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_events: {
        Row: {
          attempts: number
          created_at: string
          deal_id: string
          error: string | null
          id: string
          status: string
          trigger: string
          workspace_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          deal_id: string
          error?: string | null
          id?: string
          status?: string
          trigger: string
          workspace_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          deal_id?: string
          error?: string | null
          id?: string
          status?: string
          trigger?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_events_deal_id_fkey"
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
          workspace_id: string
        }
        Insert: {
          color?: string
          created_at?: string | null
          id?: string
          name: string
          workspace_id: string
        }
        Update: {
          color?: string
          created_at?: string | null
          id?: string
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_labels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_run_steps: {
        Row: {
          action_type: string
          created_at: string
          error: string | null
          id: string
          response_code: number | null
          run_id: string
          status: string
          step_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          error?: string | null
          id?: string
          response_code?: number | null
          run_id: string
          status: string
          step_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          error?: string | null
          id?: string
          response_code?: number | null
          run_id?: string
          status?: string
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_run_steps_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "automation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          automation_id: string
          deal_id: string | null
          event_id: string | null
          finished_at: string | null
          id: string
          started_at: string
          status: string
          trigger: string
          workspace_id: string
        }
        Insert: {
          automation_id: string
          deal_id?: string | null
          event_id?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          trigger: string
          workspace_id: string
        }
        Update: {
          automation_id?: string
          deal_id?: string | null
          event_id?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          trigger?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "automation_events"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_whatsapp_queue: {
        Row: {
          automation_id: string | null
          connection_id: string | null
          created_at: string | null
          deal_id: string | null
          error: string | null
          group_jid: string | null
          id: string
          message: string | null
          phone: string | null
          sent_at: string | null
          status: string
          template_id: string | null
          workspace_id: string
        }
        Insert: {
          automation_id?: string | null
          connection_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          error?: string | null
          group_jid?: string | null
          id?: string
          message?: string | null
          phone?: string | null
          sent_at?: string | null
          status?: string
          template_id?: string | null
          workspace_id: string
        }
        Update: {
          automation_id?: string | null
          connection_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          error?: string | null
          group_jid?: string | null
          id?: string
          message?: string | null
          phone?: string | null
          sent_at?: string | null
          status?: string
          template_id?: string | null
          workspace_id?: string
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
            foreignKeyName: "automation_whatsapp_queue_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_whatsapp_queue_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_whatsapp_queue_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string
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
          workspace_id: string
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
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          city: string | null
          cnpj: string | null
          created_at: string
          id: string
          name: string
          owner_id: string | null
          segment: string | null
          size: string | null
          state: string | null
          website: string | null
          workspace_id: string
        }
        Insert: {
          city?: string | null
          cnpj?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id?: string | null
          segment?: string | null
          size?: string | null
          state?: string | null
          website?: string | null
          workspace_id: string
        }
        Update: {
          city?: string | null
          cnpj?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string | null
          segment?: string | null
          size?: string | null
          state?: string | null
          website?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      company_history: {
        Row: {
          actor_user_id: string
          company_id: string
          created_at: string
          description: string
          id: string
          subtext: string
        }
        Insert: {
          actor_user_id: string
          company_id: string
          created_at?: string
          description: string
          id?: string
          subtext?: string
        }
        Update: {
          actor_user_id?: string
          company_id?: string
          created_at?: string
          description?: string
          id?: string
          subtext?: string
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
          actor_user_id: string
          contact_id: string
          created_at: string
          description: string
          id: string
          subtext: string
        }
        Insert: {
          actor_user_id: string
          contact_id: string
          created_at?: string
          description: string
          id?: string
          subtext?: string
        }
        Update: {
          actor_user_id?: string
          contact_id?: string
          created_at?: string
          description?: string
          id?: string
          subtext?: string
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
          owner_id: string | null
          phones: Json
          role: string | null
          workspace_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          emails?: Json
          id?: string
          name: string
          owner_id?: string | null
          phones?: Json
          role?: string | null
          workspace_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          emails?: Json
          id?: string
          name?: string
          owner_id?: string | null
          phones?: Json
          role?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string
        }
        Insert: {
          created_at?: string
          entity: string
          id?: string
          name: string
          sort_order?: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          entity?: string
          id?: string
          name?: string
          sort_order?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_groups_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          workspace_id: string
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
          workspace_id: string
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
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_fields_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboards: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          report_ids: Json
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          report_ids?: Json
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          report_ids?: Json
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboards_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          actor_user_id: string | null
          created_at: string
          deal_id: string
          description: string
          id: string
          subtext: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          deal_id: string
          description: string
          id?: string
          subtext?: string
        }
        Update: {
          actor_user_id?: string | null
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
          campaign_id: string | null
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
          loss_reason_id: string | null
          loss_reason_note: string | null
          origin: string
          owner_id: string | null
          pipeline_id: string
          probability: number | null
          source: string | null
          stage_entered_at: string | null
          stage_id: string | null
          status: string
          title: string
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          value: number
          workspace_id: string
        }
        Insert: {
          campaign_id?: string | null
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
          loss_reason_id?: string | null
          loss_reason_note?: string | null
          origin?: string
          owner_id?: string | null
          pipeline_id: string
          probability?: number | null
          source?: string | null
          stage_entered_at?: string | null
          stage_id?: string | null
          status?: string
          title: string
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          value?: number
          workspace_id: string
        }
        Update: {
          campaign_id?: string | null
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
          loss_reason_id?: string | null
          loss_reason_note?: string | null
          origin?: string
          owner_id?: string | null
          pipeline_id?: string
          probability?: number | null
          source?: string | null
          stage_entered_at?: string | null
          stage_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          value?: number
          workspace_id?: string
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
            foreignKeyName: "deals_loss_reason_id_fkey"
            columns: ["loss_reason_id"]
            isOneToOne: false
            referencedRelation: "loss_reasons"
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
          {
            foreignKeyName: "deals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          workspace_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delete_reasons_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          workspace_id: string
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
          workspace_id: string
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
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_signatures_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          name: string
          subject: string
          workspace_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          name: string
          subject?: string
          workspace_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          name?: string
          subject?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          workspace_id: string
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
          workspace_id: string
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
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emails_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          workspace_id: string
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
          workspace_id: string
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
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          access_token: string | null
          account_email: string | null
          active: boolean
          calendar_id: string
          created_at: string
          expires_at: string | null
          id: string
          last_synced_at: string | null
          provider: string
          refresh_token: string | null
          scopes: string[]
          sync_token: string | null
          sync_type: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          access_token?: string | null
          account_email?: string | null
          active?: boolean
          calendar_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          last_synced_at?: string | null
          provider: string
          refresh_token?: string | null
          scopes?: string[]
          sync_token?: string | null
          sync_type?: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          access_token?: string | null
          account_email?: string | null
          active?: boolean
          calendar_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          last_synced_at?: string | null
          provider?: string
          refresh_token?: string | null
          scopes?: string[]
          sync_token?: string | null
          sync_type?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      labels: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          workspace_id: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          name: string
          workspace_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "labels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_forms: {
        Row: {
          active: boolean
          created_at: string
          default_owner_id: string | null
          honeypot_field: string
          id: string
          name: string
          pipeline_id: string | null
          source_label: string
          stage_id: string | null
          workspace_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          default_owner_id?: string | null
          honeypot_field?: string
          id?: string
          name: string
          pipeline_id?: string | null
          source_label?: string
          stage_id?: string | null
          workspace_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          default_owner_id?: string | null
          honeypot_field?: string
          id?: string
          name?: string
          pipeline_id?: string | null
          source_label?: string
          stage_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_forms_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_forms_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_forms_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      loss_reasons: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          sort_order: number
          workspace_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          workspace_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loss_reasons_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          workspace_id: string
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
          workspace_id: string
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
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          sort_order: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipelines_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          workspace_id: string
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
          workspace_id: string
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
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_reports: {
        Row: {
          config: Json
          created_at: string | null
          id: string
          name: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          config?: Json
          created_at?: string | null
          id?: string
          name: string
          user_id: string
          workspace_id: string
        }
        Update: {
          config?: Json
          created_at?: string | null
          id?: string
          name?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_reports_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      scripts: {
        Row: {
          category: string | null
          content: string
          created_at: string
          id: string
          name: string
          workspace_id: string
        }
        Insert: {
          category?: string | null
          content?: string
          created_at?: string
          id?: string
          name: string
          workspace_id: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          id?: string
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scripts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          workspace_id: string
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
          workspace_id: string
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
          workspace_id?: string
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
          {
            foreignKeyName: "sequence_enrollments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sequence_shares: {
        Row: {
          created_at: string
          id: string
          sequence_id: string
          shared_with_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          sequence_id: string
          shared_with_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          sequence_id?: string
          shared_with_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sequence_shares_sequence_id_fkey"
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
          owner_id: string
          sharing: string
          skip_weekends: boolean
          tags: string[]
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          name: string
          owner_id: string
          sharing?: string
          skip_weekends?: boolean
          tags?: string[]
          workspace_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          name?: string
          owner_id?: string
          sharing?: string
          skip_weekends?: boolean
          tags?: string[]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sequences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      telephony_accounts: {
        Row: {
          bill_increment_seconds: number
          caller_id: string | null
          consent_mode: string
          consent_text: string
          created_at: string
          credentials_encrypted: string | null
          id: string
          last_error: string | null
          minimum_billable_seconds: number
          provider: string
          provider_account_id: string | null
          recording_enabled: boolean
          recording_retention_days: number
          status: string
          updated_at: string
          webhook_secret: string
          workspace_id: string
        }
        Insert: {
          bill_increment_seconds?: number
          caller_id?: string | null
          consent_mode?: string
          consent_text?: string
          created_at?: string
          credentials_encrypted?: string | null
          id?: string
          last_error?: string | null
          minimum_billable_seconds?: number
          provider?: string
          provider_account_id?: string | null
          recording_enabled?: boolean
          recording_retention_days?: number
          status?: string
          updated_at?: string
          webhook_secret: string
          workspace_id: string
        }
        Update: {
          bill_increment_seconds?: number
          caller_id?: string | null
          consent_mode?: string
          consent_text?: string
          created_at?: string
          credentials_encrypted?: string | null
          id?: string
          last_error?: string | null
          minimum_billable_seconds?: number
          provider?: string
          provider_account_id?: string | null
          recording_enabled?: boolean
          recording_retention_days?: number
          status?: string
          updated_at?: string
          webhook_secret?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telephony_accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      telephony_balances: {
        Row: {
          balance_cents: number
          reserved_cents: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          balance_cents?: number
          reserved_cents?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          balance_cents?: number
          reserved_cents?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telephony_balances_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      telephony_calls: {
        Row: {
          activity_id: string | null
          analysis: Json | null
          analyzed_at: string | null
          answered_at: string | null
          billed_cents: number
          billing_mode: string
          consent_given: boolean
          contact_id: string | null
          created_at: string
          deal_id: string | null
          destination_type: string | null
          direction: string
          disposition: string | null
          duration_seconds: number
          ended_at: string | null
          extension_id: string | null
          finalized_at: string | null
          from_number: string | null
          hangup_cause: string | null
          id: string
          notes: string | null
          provider: string
          provider_call_id: string | null
          rate_cents_per_minute: number
          recording_expires_at: string | null
          recording_key: string | null
          recording_status: string
          reserved_cents: number
          script_id: string | null
          started_at: string
          status: string
          to_number: string
          transcript: string | null
          transcript_source: string | null
          updated_at: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          activity_id?: string | null
          analysis?: Json | null
          analyzed_at?: string | null
          answered_at?: string | null
          billed_cents?: number
          billing_mode?: string
          consent_given?: boolean
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          destination_type?: string | null
          direction?: string
          disposition?: string | null
          duration_seconds?: number
          ended_at?: string | null
          extension_id?: string | null
          finalized_at?: string | null
          from_number?: string | null
          hangup_cause?: string | null
          id?: string
          notes?: string | null
          provider: string
          provider_call_id?: string | null
          rate_cents_per_minute?: number
          recording_expires_at?: string | null
          recording_key?: string | null
          recording_status?: string
          reserved_cents?: number
          script_id?: string | null
          started_at?: string
          status?: string
          to_number: string
          transcript?: string | null
          transcript_source?: string | null
          updated_at?: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          activity_id?: string | null
          analysis?: Json | null
          analyzed_at?: string | null
          answered_at?: string | null
          billed_cents?: number
          billing_mode?: string
          consent_given?: boolean
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          destination_type?: string | null
          direction?: string
          disposition?: string | null
          duration_seconds?: number
          ended_at?: string | null
          extension_id?: string | null
          finalized_at?: string | null
          from_number?: string | null
          hangup_cause?: string | null
          id?: string
          notes?: string | null
          provider?: string
          provider_call_id?: string | null
          rate_cents_per_minute?: number
          recording_expires_at?: string | null
          recording_key?: string | null
          recording_status?: string
          reserved_cents?: number
          script_id?: string | null
          started_at?: string
          status?: string
          to_number?: string
          transcript?: string | null
          transcript_source?: string | null
          updated_at?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telephony_calls_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telephony_calls_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telephony_calls_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telephony_calls_extension_id_fkey"
            columns: ["extension_id"]
            isOneToOne: false
            referencedRelation: "telephony_extensions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telephony_calls_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telephony_calls_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      telephony_events: {
        Row: {
          call_id: string | null
          error: string | null
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          provider: string
          provider_event_id: string
          received_at: string
          workspace_id: string | null
        }
        Insert: {
          call_id?: string | null
          error?: string | null
          event_type: string
          id?: string
          payload?: Json
          processed_at?: string | null
          provider: string
          provider_event_id: string
          received_at?: string
          workspace_id?: string | null
        }
        Update: {
          call_id?: string | null
          error?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          provider_event_id?: string
          received_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telephony_events_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "telephony_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telephony_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      telephony_extensions: {
        Row: {
          callback_number: string | null
          created_at: string
          dial_mode: string
          extension: string
          id: string
          last_error: string | null
          linked_at: string
          linked_by: string | null
          mode: string
          provider_credential_id: string | null
          sip_password_encrypted: string | null
          sip_server: string | null
          sip_username: string | null
          status: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          callback_number?: string | null
          created_at?: string
          dial_mode?: string
          extension: string
          id?: string
          last_error?: string | null
          linked_at?: string
          linked_by?: string | null
          mode?: string
          provider_credential_id?: string | null
          sip_password_encrypted?: string | null
          sip_server?: string | null
          sip_username?: string | null
          status?: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          callback_number?: string | null
          created_at?: string
          dial_mode?: string
          extension?: string
          id?: string
          last_error?: string | null
          linked_at?: string
          linked_by?: string | null
          mode?: string
          provider_credential_id?: string | null
          sip_password_encrypted?: string | null
          sip_server?: string | null
          sip_username?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telephony_extensions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      telephony_ledger: {
        Row: {
          amount_cents: number
          balance_after_cents: number
          call_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          idempotency_key: string
          kind: string
          workspace_id: string
        }
        Insert: {
          amount_cents: number
          balance_after_cents: number
          call_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          idempotency_key: string
          kind: string
          workspace_id: string
        }
        Update: {
          amount_cents?: number
          balance_after_cents?: number
          call_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          idempotency_key?: string
          kind?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telephony_ledger_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "telephony_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telephony_ledger_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      telephony_rates: {
        Row: {
          cost_cents_per_minute: number
          created_at: string
          destination_type: string
          effective_from: string
          id: string
          price_cents_per_minute: number
          workspace_id: string | null
        }
        Insert: {
          cost_cents_per_minute?: number
          created_at?: string
          destination_type: string
          effective_from?: string
          id?: string
          price_cents_per_minute: number
          workspace_id?: string | null
        }
        Update: {
          cost_cents_per_minute?: number
          created_at?: string
          destination_type?: string
          effective_from?: string
          id?: string
          price_cents_per_minute?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telephony_rates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          webhook_id: string
          workspace_id: string
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
          webhook_id: string
          workspace_id: string
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
          webhook_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_deliveries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          events?: string[]
          id?: string
          secret?: string | null
          url: string
          workspace_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          events?: string[]
          id?: string
          secret?: string | null
          url?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_connections: {
        Row: {
          created_at: string
          groups_enabled: boolean
          id: string
          instance_id: string | null
          instance_name: string
          instance_token: string | null
          last_error: string | null
          phone_number: string | null
          profile_name: string | null
          profile_pic_url: string | null
          provider: string
          qr_code: string | null
          qr_expires_at: string | null
          signature_enabled: boolean
          signature_name: string | null
          status: string
          updated_at: string
          webhook_secret: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          groups_enabled?: boolean
          id?: string
          instance_id?: string | null
          instance_name: string
          instance_token?: string | null
          last_error?: string | null
          phone_number?: string | null
          profile_name?: string | null
          profile_pic_url?: string | null
          provider?: string
          qr_code?: string | null
          qr_expires_at?: string | null
          signature_enabled?: boolean
          signature_name?: string | null
          status?: string
          updated_at?: string
          webhook_secret: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          groups_enabled?: boolean
          id?: string
          instance_id?: string | null
          instance_name?: string
          instance_token?: string | null
          last_error?: string | null
          phone_number?: string | null
          profile_name?: string | null
          profile_pic_url?: string | null
          provider?: string
          qr_code?: string | null
          qr_expires_at?: string | null
          signature_enabled?: boolean
          signature_name?: string | null
          status?: string
          updated_at?: string
          webhook_secret?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_connections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          connection_id: string
          contact_id: string | null
          created_at: string
          deal_id: string | null
          id: string
          jid_verified: boolean
          last_message_at: string | null
          last_message_from_me: boolean
          last_message_preview: string | null
          manually_unread: boolean
          owner_id: string | null
          phone: string
          pinned: boolean
          push_name: string | null
          remote_jid: string
          unread_count: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          connection_id: string
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          jid_verified?: boolean
          last_message_at?: string | null
          last_message_from_me?: boolean
          last_message_preview?: string | null
          manually_unread?: boolean
          owner_id?: string | null
          phone: string
          pinned?: boolean
          push_name?: string | null
          remote_jid: string
          unread_count?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          connection_id?: string
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          jid_verified?: boolean
          last_message_at?: string | null
          last_message_from_me?: boolean
          last_message_preview?: string | null
          manually_unread?: boolean
          owner_id?: string | null
          phone?: string
          pinned?: boolean
          push_name?: string | null
          remote_jid?: string
          unread_count?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_member_settings: {
        Row: {
          created_at: string
          signature_enabled: boolean
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          signature_enabled?: boolean
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          signature_enabled?: boolean
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_member_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          body: string | null
          conversation_id: string
          created_at: string
          error: string | null
          from_me: boolean
          id: string
          media_filename: string | null
          media_mime: string | null
          media_path: string | null
          sent_by: string | null
          status: string
          timestamp: string
          type: string
          wa_message_id: string | null
          workspace_id: string
        }
        Insert: {
          body?: string | null
          conversation_id: string
          created_at?: string
          error?: string | null
          from_me: boolean
          id?: string
          media_filename?: string | null
          media_mime?: string | null
          media_path?: string | null
          sent_by?: string | null
          status?: string
          timestamp?: string
          type?: string
          wa_message_id?: string | null
          workspace_id: string
        }
        Update: {
          body?: string | null
          conversation_id?: string
          created_at?: string
          error?: string | null
          from_me?: boolean
          id?: string
          media_filename?: string | null
          media_mime?: string | null
          media_path?: string | null
          sent_by?: string | null
          status?: string
          timestamp?: string
          type?: string
          wa_message_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          created_at: string
          id: string
          message: string
          name: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string
          name: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          accepted_at: string | null
          avatar_url: string | null
          email: string
          id: string
          invite_expires_at: string | null
          invite_token: string | null
          invited_at: string
          member_user_id: string | null
          name: string | null
          permissions: Json | null
          role: string
          status: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          avatar_url?: string | null
          email: string
          id?: string
          invite_expires_at?: string | null
          invite_token?: string | null
          invited_at?: string
          member_user_id?: string | null
          name?: string | null
          permissions?: Json | null
          role?: string
          status?: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          avatar_url?: string | null
          email?: string
          id?: string
          invite_expires_at?: string | null
          invite_token?: string | null
          invited_at?: string
          member_user_id?: string | null
          name?: string | null
          permissions?: Json | null
          role?: string
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          feature_flags: Json
          id: string
          name: string
          owner_user_id: string
          plan: string
          slug: string | null
          status: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          feature_flags?: Json
          id: string
          name?: string
          owner_user_id: string
          plan?: string
          slug?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          feature_flags?: Json
          id?: string
          name?: string
          owner_user_id?: string
          plan?: string
          slug?: string | null
          status?: string
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
      build_activity_webhook_payload: {
        Args: { p_activity: Database["public"]["Tables"]["activities"]["Row"] }
        Returns: Json
      }
      build_contact_webhook_payload: {
        Args: { p_contact: Database["public"]["Tables"]["contacts"]["Row"] }
        Returns: Json
      }
      build_deal_webhook_payload: {
        Args: { p_deal: Database["public"]["Tables"]["deals"]["Row"] }
        Returns: Json
      }
      claim_due_sequence_enrollments: {
        Args: { p_limit?: number }
        Returns: {
          automation_id: string | null
          current_step: number | null
          deal_id: string | null
          enrolled_at: string | null
          id: string
          sequence_id: string | null
          status: string
          updated_at: string | null
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "sequence_enrollments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_pending_automation_events: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          created_at: string
          deal_id: string
          error: string | null
          id: string
          status: string
          trigger: string
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "automation_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
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
          workspace_id: string
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
          connection_id: string | null
          created_at: string | null
          deal_id: string | null
          error: string | null
          group_jid: string | null
          id: string
          message: string | null
          phone: string | null
          sent_at: string | null
          status: string
          template_id: string | null
          workspace_id: string
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
      find_contact_by_phone: {
        Args: { p_phone: string; p_workspace_id: string }
        Returns: string
      }
      increment_api_rate_limit: {
        Args: { p_api_key_id: string; p_window_start: string }
        Returns: number
      }
      is_sequence_owner: { Args: { p_sequence_id: string }; Returns: boolean }
      is_workspace_member: { Args: { owner_id: string }; Returns: boolean }
      is_ws_admin: { Args: { ws: string }; Returns: boolean }
      is_ws_manager: { Args: { ws: string }; Returns: boolean }
      my_role: { Args: { ws: string }; Returns: string }
      my_workspace_ids: { Args: never; Returns: string[] }
      replace_deal_labels: {
        Args: { p_deal_id: string; p_label_ids: string[] }
        Returns: undefined
      }
      replace_deal_products: {
        Args: { p_deal_id: string; p_products: Json }
        Returns: undefined
      }
      sync_my_member_identity: {
        Args: { p_avatar_url?: string; p_name?: string }
        Returns: number
      }
      team_scoreboard: {
        Args: { period_end: string; period_start: string }
        Returns: {
          activities_done: number
          avatar_url: string
          calls_made: number
          deals_open: number
          deals_won: number
          name: string
          role: string
          user_id: string
          value_won: number
        }[]
      }
      telephony_add_credit: {
        Args: {
          p_amount_cents: number
          p_created_by: string
          p_description: string
          p_idempotency_key: string
          p_kind?: string
          p_workspace_id: string
        }
        Returns: Json
      }
      telephony_attach_provider_call: {
        Args: { p_call_id: string; p_provider_call_id: string }
        Returns: undefined
      }
      telephony_current_rate: {
        Args: { p_destination_type: string; p_workspace_id: string }
        Returns: number
      }
      telephony_finalize_call: {
        Args: {
          p_answered_at: string
          p_duration_seconds: number
          p_ended_at: string
          p_hangup_cause: string
          p_provider: string
          p_provider_call_id: string
          p_status: string
        }
        Returns: Json
      }
      telephony_mark_recording_deleted: {
        Args: { p_call_id: string }
        Returns: undefined
      }
      telephony_reconcile_stale_calls: {
        Args: { p_older_than?: string }
        Returns: number
      }
      telephony_start_call: {
        Args: {
          p_contact_id?: string
          p_deal_id?: string
          p_destination_type: string
          p_extension_id: string
          p_from_number: string
          p_provider: string
          p_script_id?: string
          p_to_number: string
          p_user_id: string
          p_workspace_id: string
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

