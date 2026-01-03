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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      access_logs: {
        Row: {
          action: string
          agreement_id: string | null
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          property_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          agreement_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          property_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          agreement_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          property_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_logs_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "cooperation_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_logs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      access_requests: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          message: string | null
          property_id: string
          requester_id: string
          responded_at: string | null
          response_message: string | null
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          message?: string | null
          property_id: string
          requester_id: string
          responded_at?: string | null
          response_message?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          message?: string | null
          property_id?: string
          requester_id?: string
          responded_at?: string | null
          response_message?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cooperation_agreements: {
        Row: {
          access_request_id: string
          buyer_broker_accepted_at: string | null
          buyer_broker_commission_percent: number
          buyer_broker_id: string
          captador_accepted_at: string | null
          captador_commission_percent: number
          captador_id: string
          created_at: string
          expires_at: string
          id: string
          property_id: string
          status: Database["public"]["Enums"]["agreement_status"]
          terms: string | null
          updated_at: string
        }
        Insert: {
          access_request_id: string
          buyer_broker_accepted_at?: string | null
          buyer_broker_commission_percent: number
          buyer_broker_id: string
          captador_accepted_at?: string | null
          captador_commission_percent: number
          captador_id: string
          created_at?: string
          expires_at?: string
          id?: string
          property_id: string
          status?: Database["public"]["Enums"]["agreement_status"]
          terms?: string | null
          updated_at?: string
        }
        Update: {
          access_request_id?: string
          buyer_broker_accepted_at?: string | null
          buyer_broker_commission_percent?: number
          buyer_broker_id?: string
          captador_accepted_at?: string | null
          captador_commission_percent?: number
          captador_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          property_id?: string
          status?: Database["public"]["Enums"]["agreement_status"]
          terms?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cooperation_agreements_access_request_id_fkey"
            columns: ["access_request_id"]
            isOneToOne: true
            referencedRelation: "access_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cooperation_agreements_buyer_broker_id_fkey"
            columns: ["buyer_broker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cooperation_agreements_captador_id_fkey"
            columns: ["captador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cooperation_agreements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      crossing_reports: {
        Row: {
          agreement_id: string | null
          created_at: string
          description: string
          evidence_urls: string[] | null
          id: string
          property_id: string | null
          reported_user_id: string | null
          reporter_id: string
          resolution: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agreement_id?: string | null
          created_at?: string
          description: string
          evidence_urls?: string[] | null
          id?: string
          property_id?: string | null
          reported_user_id?: string | null
          reporter_id: string
          resolution?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agreement_id?: string | null
          created_at?: string
          description?: string
          evidence_urls?: string[] | null
          id?: string
          property_id?: string | null
          reported_user_id?: string | null
          reporter_id?: string
          resolution?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crossing_reports_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "cooperation_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crossing_reports_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crossing_reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crossing_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          city: string | null
          created_at: string
          creci: string
          full_name: string
          id: string
          phone: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          creci: string
          full_name: string
          id: string
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          creci?: string
          full_name?: string
          id?: string
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address_complement: string | null
          address_number: string | null
          area_m2: number | null
          bathrooms: number | null
          bedrooms: number | null
          city: string
          created_at: string
          description: string | null
          documents: string[] | null
          features: string[] | null
          full_address: string
          id: string
          internal_notes: string | null
          is_active: boolean
          neighborhood: string
          owner_email: string | null
          owner_id: string
          owner_name: string
          owner_phone: string
          price_range_max: number | null
          price_range_min: number | null
          property_type: Database["public"]["Enums"]["property_type"]
          public_photos: string[] | null
          sensitive_photos: string[] | null
          state: string
          title: string
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address_complement?: string | null
          address_number?: string | null
          area_m2?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          city: string
          created_at?: string
          description?: string | null
          documents?: string[] | null
          features?: string[] | null
          full_address: string
          id?: string
          internal_notes?: string | null
          is_active?: boolean
          neighborhood: string
          owner_email?: string | null
          owner_id: string
          owner_name: string
          owner_phone: string
          price_range_max?: number | null
          price_range_min?: number | null
          property_type?: Database["public"]["Enums"]["property_type"]
          public_photos?: string[] | null
          sensitive_photos?: string[] | null
          state: string
          title: string
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address_complement?: string | null
          address_number?: string | null
          area_m2?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string
          created_at?: string
          description?: string | null
          documents?: string[] | null
          features?: string[] | null
          full_address?: string
          id?: string
          internal_notes?: string | null
          is_active?: boolean
          neighborhood?: string
          owner_email?: string | null
          owner_id?: string
          owner_name?: string
          owner_phone?: string
          price_range_max?: number | null
          price_range_min?: number | null
          property_type?: Database["public"]["Enums"]["property_type"]
          public_photos?: string[] | null
          sensitive_photos?: string[] | null
          state?: string
          title?: string
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_demands: {
        Row: {
          area_max: number | null
          area_min: number | null
          bedrooms_max: number | null
          bedrooms_min: number | null
          broker_id: string
          cities: string[] | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          neighborhoods: string[] | null
          price_max: number | null
          price_min: number | null
          property_types: Database["public"]["Enums"]["property_type"][] | null
          states: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          area_max?: number | null
          area_min?: number | null
          bedrooms_max?: number | null
          bedrooms_min?: number | null
          broker_id: string
          cities?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          neighborhoods?: string[] | null
          price_max?: number | null
          price_min?: number | null
          property_types?: Database["public"]["Enums"]["property_type"][] | null
          states?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          area_max?: number | null
          area_min?: number | null
          bedrooms_max?: number | null
          bedrooms_min?: number | null
          broker_id?: string
          cities?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          neighborhoods?: string[] | null
          price_max?: number | null
          price_min?: number | null
          property_types?: Database["public"]["Enums"]["property_type"][] | null
          states?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_demands_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      has_active_agreement: {
        Args: { _property_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      agreement_status: "pending" | "active" | "cancelled" | "expired"
      app_role: "admin" | "broker"
      property_type:
        | "apartamento"
        | "casa"
        | "terreno"
        | "comercial"
        | "rural"
        | "outro"
      request_status: "pending" | "accepted" | "rejected" | "expired"
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
      agreement_status: ["pending", "active", "cancelled", "expired"],
      app_role: ["admin", "broker"],
      property_type: [
        "apartamento",
        "casa",
        "terreno",
        "comercial",
        "rural",
        "outro",
      ],
      request_status: ["pending", "accepted", "rejected", "expired"],
    },
  },
} as const
