
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "ai_breaker": {
                  Row: {
                    "failures": number,"opened_at": string | null,"provider": string,"state": Database["public"]['Enums']["breaker_state"]
                  }
                  ComputedFields: never
                  Insert: {
                    "failures"?: number,"opened_at"?: string | null,"provider": string,"state"?: Database["public"]['Enums']["breaker_state"]
                  }
                  Update: {
                    "failures"?: number,"opened_at"?: string | null,"provider"?: string,"state"?: Database["public"]['Enums']["breaker_state"]
                  }
                  Relationships: [
                    
                  ]
                },"ai_calls": {
                  Row: {
                    "audio_seconds": number,"cached_tokens": number,"cost_usd": number,"created_at": string,"id": string,"images": number,"input_tokens": number,"job": Database["public"]['Enums']["ai_job"],"latency_ms": number | null,"model": string,"outcome": Database["public"]['Enums']["ai_outcome"],"output_tokens": number,"owner_action": Database["public"]['Enums']["owner_action"] | null,"prompt_version": string | null,"proposal_id": string | null,"request_id": string | null,"retries": number,"review_id": string | null,"shop_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "audio_seconds"?: number,"cached_tokens"?: number,"cost_usd"?: number,"created_at"?: string,"id"?: string,"images"?: number,"input_tokens"?: number,"job": Database["public"]['Enums']["ai_job"],"latency_ms"?: number | null,"model": string,"outcome": Database["public"]['Enums']["ai_outcome"],"output_tokens"?: number,"owner_action"?: Database["public"]['Enums']["owner_action"] | null,"prompt_version"?: string | null,"proposal_id"?: string | null,"request_id"?: string | null,"retries"?: number,"review_id"?: string | null,"shop_id"?: string | null
                  }
                  Update: {
                    "audio_seconds"?: number,"cached_tokens"?: number,"cost_usd"?: number,"created_at"?: string,"id"?: string,"images"?: number,"input_tokens"?: number,"job"?: Database["public"]['Enums']["ai_job"],"latency_ms"?: number | null,"model"?: string,"outcome"?: Database["public"]['Enums']["ai_outcome"],"output_tokens"?: number,"owner_action"?: Database["public"]['Enums']["owner_action"] | null,"prompt_version"?: string | null,"proposal_id"?: string | null,"request_id"?: string | null,"retries"?: number,"review_id"?: string | null,"shop_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_calls_proposal_id_fkey"
      columns: ["proposal_id"]
isOneToOne: false
      referencedRelation: "proposals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_calls_review_id_fkey"
      columns: ["review_id"]
isOneToOne: false
      referencedRelation: "reviews"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_calls_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "public_storefront"
      referencedColumns: ["shop_id"]
    },{
      foreignKeyName: "ai_calls_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"festival_calendar": {
                  Row: {
                    "categories": (string)[],"ends_on": string,"factor": number,"id": number,"name": string,"starts_on": string
                  }
                  ComputedFields: never
                  Insert: {
                    "categories"?: (string)[],"ends_on": string,"factor": number,"id"?: never,"name": string,"starts_on": string
                  }
                  Update: {
                    "categories"?: (string)[],"ends_on"?: string,"factor"?: number,"id"?: never,"name"?: string,"starts_on"?: string
                  }
                  Relationships: [
                    
                  ]
                },"product_forecasts": {
                  Row: {
                    "computed_at": string,"days_left": number | null,"explanation": string | null,"explanation_lang": string | null,"explanation_on": string | null,"level": number,"order_qty": number | null,"product_id": string,"reorder_point": number | null,"shop_id": string,"sigma": number,"stockout_boost_until": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "computed_at"?: string,"days_left"?: number | null,"explanation"?: string | null,"explanation_lang"?: string | null,"explanation_on"?: string | null,"level": number,"order_qty"?: number | null,"product_id": string,"reorder_point"?: number | null,"shop_id": string,"sigma": number,"stockout_boost_until"?: string | null
                  }
                  Update: {
                    "computed_at"?: string,"days_left"?: number | null,"explanation"?: string | null,"explanation_lang"?: string | null,"explanation_on"?: string | null,"level"?: number,"order_qty"?: number | null,"product_id"?: string,"reorder_point"?: number | null,"shop_id"?: string,"sigma"?: number,"stockout_boost_until"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_forecasts_product_id_shop_id_fkey"
      columns: ["product_id","shop_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id","shop_id"]
    },{
      foreignKeyName: "product_forecasts_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "public_storefront"
      referencedColumns: ["shop_id"]
    },{
      foreignKeyName: "product_forecasts_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "aliases": (string)[],"archived_at": string | null,"category": string | null,"created_at": string,"id": string,"image_path": string | null,"is_in_stock": boolean,"is_published": boolean,"low_stock_level": number,"name": string,"pack_size": number,"price_paise": number | null,"shop_id": string,"stock_qty": number | null,"unit": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aliases"?: (string)[],"archived_at"?: string | null,"category"?: string | null,"created_at"?: string,"id"?: string,"image_path"?: string | null,"is_in_stock"?: boolean,"is_published"?: boolean,"low_stock_level"?: number,"name": string,"pack_size"?: number,"price_paise"?: number | null,"shop_id": string,"stock_qty"?: number | null,"unit"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "aliases"?: (string)[],"archived_at"?: string | null,"category"?: string | null,"created_at"?: string,"id"?: string,"image_path"?: string | null,"is_in_stock"?: boolean,"is_published"?: boolean,"low_stock_level"?: number,"name"?: string,"pack_size"?: number,"price_paise"?: number | null,"shop_id"?: string,"stock_qty"?: number | null,"unit"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "public_storefront"
      referencedColumns: ["shop_id"]
    },{
      foreignKeyName: "products_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"proposals": {
                  Row: {
                    "changes": NonNullable<Json>,"confirmed_changes": Json | null,"created_at": string,"decided_at": string | null,"id": string,"input_path": string | null,"kind": Database["public"]['Enums']["proposal_kind"],"shop_id": string,"status": Database["public"]['Enums']["proposal_status"],"transcript": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "changes"?: NonNullable<Json>,"confirmed_changes"?: Json | null,"created_at"?: string,"decided_at"?: string | null,"id"?: string,"input_path"?: string | null,"kind": Database["public"]['Enums']["proposal_kind"],"shop_id": string,"status"?: Database["public"]['Enums']["proposal_status"],"transcript"?: string | null
                  }
                  Update: {
                    "changes"?: NonNullable<Json>,"confirmed_changes"?: Json | null,"created_at"?: string,"decided_at"?: string | null,"id"?: string,"input_path"?: string | null,"kind"?: Database["public"]['Enums']["proposal_kind"],"shop_id"?: string,"status"?: Database["public"]['Enums']["proposal_status"],"transcript"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "proposals_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "public_storefront"
      referencedColumns: ["shop_id"]
    },{
      foreignKeyName: "proposals_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"rate_limits": {
                  Row: {
                    "count": number,"key": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "count"?: number,"key": string,"window_start": string
                  }
                  Update: {
                    "count"?: number,"key"?: string,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reviews": {
                  Row: {
                    "audio_deleted_at": string | null,"audio_path": string | null,"consent_at": string,"created_at": string,"id": string,"ip_hash": string | null,"is_hidden": boolean,"mentioned_product_ids": (string)[],"sentiment": Database["public"]['Enums']["sentiment"] | null,"shop_id": string,"status": Database["public"]['Enums']["review_status"],"stockout_product_ids": (string)[],"summary": string | null,"transcript": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "audio_deleted_at"?: string | null,"audio_path"?: string | null,"consent_at": string,"created_at"?: string,"id"?: string,"ip_hash"?: string | null,"is_hidden"?: boolean,"mentioned_product_ids"?: (string)[],"sentiment"?: Database["public"]['Enums']["sentiment"] | null,"shop_id": string,"status"?: Database["public"]['Enums']["review_status"],"stockout_product_ids"?: (string)[],"summary"?: string | null,"transcript"?: string | null
                  }
                  Update: {
                    "audio_deleted_at"?: string | null,"audio_path"?: string | null,"consent_at"?: string,"created_at"?: string,"id"?: string,"ip_hash"?: string | null,"is_hidden"?: boolean,"mentioned_product_ids"?: (string)[],"sentiment"?: Database["public"]['Enums']["sentiment"] | null,"shop_id"?: string,"status"?: Database["public"]['Enums']["review_status"],"stockout_product_ids"?: (string)[],"summary"?: string | null,"transcript"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "reviews_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "public_storefront"
      referencedColumns: ["shop_id"]
    },{
      foreignKeyName: "reviews_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"shops": {
                  Row: {
                    "address": string | null,"category": string | null,"created_at": string,"demo_expires_at": string | null,"description": string | null,"hours": Json | null,"id": string,"is_demo": boolean,"is_published": boolean,"language": string,"lead_time_days": number,"name": string,"owner_id": string,"phone": string | null,"review_period_days": number,"slug": string,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"category"?: string | null,"created_at"?: string,"demo_expires_at"?: string | null,"description"?: string | null,"hours"?: Json | null,"id"?: string,"is_demo"?: boolean,"is_published"?: boolean,"language"?: string,"lead_time_days"?: number,"name": string,"owner_id": string,"phone"?: string | null,"review_period_days"?: number,"slug": string,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"category"?: string | null,"created_at"?: string,"demo_expires_at"?: string | null,"description"?: string | null,"hours"?: Json | null,"id"?: string,"is_demo"?: boolean,"is_published"?: boolean,"language"?: string,"lead_time_days"?: number,"name"?: string,"owner_id"?: string,"phone"?: string | null,"review_period_days"?: number,"slug"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"stock_movements": {
                  Row: {
                    "created_at": string,"id": string,"idempotency_key": string,"kind": Database["public"]['Enums']["movement_kind"],"occurred_at": string,"product_id": string,"proposal_id": string | null,"qty": number,"shop_id": string,"source": Database["public"]['Enums']["movement_source"],"unit_price_paise": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"idempotency_key": string,"kind": Database["public"]['Enums']["movement_kind"],"occurred_at"?: string,"product_id": string,"proposal_id"?: string | null,"qty": number,"shop_id": string,"source": Database["public"]['Enums']["movement_source"],"unit_price_paise"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"idempotency_key"?: string,"kind"?: Database["public"]['Enums']["movement_kind"],"occurred_at"?: string,"product_id"?: string,"proposal_id"?: string | null,"qty"?: number,"shop_id"?: string,"source"?: Database["public"]['Enums']["movement_source"],"unit_price_paise"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_movements_product_id_shop_id_fkey"
      columns: ["product_id","shop_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id","shop_id"]
    },{
      foreignKeyName: "stock_movements_proposal_id_shop_id_fkey"
      columns: ["proposal_id","shop_id"]
isOneToOne: false
      referencedRelation: "proposals"
      referencedColumns: ["id","shop_id"]
    },{
      foreignKeyName: "stock_movements_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "public_storefront"
      referencedColumns: ["shop_id"]
    },{
      foreignKeyName: "stock_movements_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "ai_spend_daily": {
                  Row: {
                    "calls": number | null,"cost_usd": number | null,"day": string | null,"job": Database["public"]['Enums']["ai_job"]
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"public_storefront": {
                  Row: {
                    "address": string | null,"hours": Json | null,"image_path": string | null,"in_stock": boolean | null,"language": string,"phone": string | null,"price_paise": number | null,"product_category": string | null,"product_id": string | null,"product_name": string | null,"shop_category": string | null,"shop_description": string | null,"shop_id": string,"shop_name": string,"slug": string,"timezone": string,"unit": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            [_ in never]: never
          }
          Enums: {
            "ai_job": "SETUP_EXTRACTION"|"COMMAND"|"BILL"|"SHELF"|"REVIEW"|"EXPLANATION"|"TRANSCRIBE"|"SEGMENT","ai_outcome": "OK"|"SCHEMA_REJECTED"|"TIMEOUT"|"RATE_LIMITED"|"ERROR","breaker_state": "CLOSED"|"OPEN"|"HALF_OPEN","movement_kind": "SALE"|"DELIVERY"|"CORRECTION","movement_source": "VOICE"|"BILL"|"TAP"|"SEED"|"UNDO","owner_action": "CONFIRMED"|"EDITED"|"REJECTED","proposal_kind": "SETUP"|"COMMAND"|"BILL"|"SHELF","proposal_status": "PENDING"|"CONFIRMED"|"CANCELLED"|"FAILED"|"EXPIRED"|"UNDONE","review_status": "PENDING"|"ANALYZED"|"FAILED","sentiment": "POSITIVE"|"NEUTRAL"|"NEGATIVE"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "ai_job": ["SETUP_EXTRACTION", "COMMAND", "BILL", "SHELF", "REVIEW", "EXPLANATION", "TRANSCRIBE", "SEGMENT"],"ai_outcome": ["OK", "SCHEMA_REJECTED", "TIMEOUT", "RATE_LIMITED", "ERROR"],"breaker_state": ["CLOSED", "OPEN", "HALF_OPEN"],"movement_kind": ["SALE", "DELIVERY", "CORRECTION"],"movement_source": ["VOICE", "BILL", "TAP", "SEED", "UNDO"],"owner_action": ["CONFIRMED", "EDITED", "REJECTED"],"proposal_kind": ["SETUP", "COMMAND", "BILL", "SHELF"],"proposal_status": ["PENDING", "CONFIRMED", "CANCELLED", "FAILED", "EXPIRED", "UNDONE"],"review_status": ["PENDING", "ANALYZED", "FAILED"],"sentiment": ["POSITIVE", "NEUTRAL", "NEGATIVE"]
          }
        }
} as const
