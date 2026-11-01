export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      ai_breaker: {
        Row: {
          failures: number
          manual: boolean
          opened_at: string | null
          provider: string
          state: Database["public"]["Enums"]["breaker_state"]
        }
        ComputedFields: never
        Insert: {
          failures?: number
          manual?: boolean
          opened_at?: string | null
          provider: string
          state?: Database["public"]["Enums"]["breaker_state"]
        }
        Update: {
          failures?: number
          manual?: boolean
          opened_at?: string | null
          provider?: string
          state?: Database["public"]["Enums"]["breaker_state"]
        }
        Relationships: []
      }
      ai_calls: {
        Row: {
          audio_seconds: number
          cached_tokens: number
          cost_usd: number
          created_at: string
          id: string
          images: number
          input_tokens: number
          job: Database["public"]["Enums"]["ai_job"]
          latency_ms: number | null
          model: string
          outcome: Database["public"]["Enums"]["ai_outcome"]
          output_tokens: number
          owner_action: Database["public"]["Enums"]["owner_action"] | null
          prompt_version: string | null
          proposal_id: string | null
          request_id: string | null
          retries: number
          review_id: string | null
          shop_id: string | null
        }
        ComputedFields: never
        Insert: {
          audio_seconds?: number
          cached_tokens?: number
          cost_usd?: number
          created_at?: string
          id?: string
          images?: number
          input_tokens?: number
          job: Database["public"]["Enums"]["ai_job"]
          latency_ms?: number | null
          model: string
          outcome: Database["public"]["Enums"]["ai_outcome"]
          output_tokens?: number
          owner_action?: Database["public"]["Enums"]["owner_action"] | null
          prompt_version?: string | null
          proposal_id?: string | null
          request_id?: string | null
          retries?: number
          review_id?: string | null
          shop_id?: string | null
        }
        Update: {
          audio_seconds?: number
          cached_tokens?: number
          cost_usd?: number
          created_at?: string
          id?: string
          images?: number
          input_tokens?: number
          job?: Database["public"]["Enums"]["ai_job"]
          latency_ms?: number | null
          model?: string
          outcome?: Database["public"]["Enums"]["ai_outcome"]
          output_tokens?: number
          owner_action?: Database["public"]["Enums"]["owner_action"] | null
          prompt_version?: string | null
          proposal_id?: string | null
          request_id?: string | null
          retries?: number
          review_id?: string | null
          shop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_calls_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_calls_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_calls_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "public_storefront"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "ai_calls_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      barcode_lookups: {
        Row: {
          brand: string | null
          code: string
          fetched_at: string
          found: boolean
          name: string | null
          quantity: string | null
        }
        ComputedFields: never
        Insert: {
          brand?: string | null
          code: string
          fetched_at?: string
          found: boolean
          name?: string | null
          quantity?: string | null
        }
        Update: {
          brand?: string | null
          code?: string
          fetched_at?: string
          found?: boolean
          name?: string | null
          quantity?: string | null
        }
        Relationships: []
      }
      customer_addresses: {
        Row: {
          address: string
          created_at: string
          id: string
          is_default: boolean
          label: string
          lat: number | null
          lng: number | null
          pincode: string | null
          user_id: string
        }
        ComputedFields: never
        Insert: {
          address: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          lat?: number | null
          lng?: number | null
          pincode?: string | null
          user_id: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          lat?: number | null
          lng?: number | null
          pincode?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          name: string | null
          pay_with: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          name?: string | null
          pay_with?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          name?: string | null
          pay_with?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      favourite_shops: {
        Row: {
          created_at: string
          shop_id: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          shop_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          shop_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favourite_shops_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "public_storefront"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "favourite_shops_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favourite_shops_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      festival_calendar: {
        Row: {
          categories: string[]
          ends_on: string
          factor: number
          id: number
          name: string
          starts_on: string
        }
        ComputedFields: never
        Insert: {
          categories?: string[]
          ends_on: string
          factor: number
          id?: never
          name: string
          starts_on: string
        }
        Update: {
          categories?: string[]
          ends_on?: string
          factor?: number
          id?: never
          name?: string
          starts_on?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          name: string
          order_id: string
          position: number
          price_paise: number | null
          product_id: string | null
          qty: number
          shop_id: string
          status: Database["public"]["Enums"]["order_item_status"]
          unit: string | null
        }
        ComputedFields: never
        Insert: {
          id?: string
          name: string
          order_id: string
          position: number
          price_paise?: number | null
          product_id?: string | null
          qty: number
          shop_id: string
          status?: Database["public"]["Enums"]["order_item_status"]
          unit?: string | null
        }
        Update: {
          id?: string
          name?: string
          order_id?: string
          position?: number
          price_paise?: number | null
          product_id?: string | null
          qty?: number
          shop_id?: string
          status?: Database["public"]["Enums"]["order_item_status"]
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_shop_id_fkey"
            columns: ["order_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "order_items_product_id_shop_id_fkey"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "shop_id"]
          },
        ]
      }
      order_refunds: {
        Row: {
          amount_paise: number
          created_at: string
          id: string
          order_id: string
          reason: string
          shop_id: string
        }
        ComputedFields: never
        Insert: {
          amount_paise: number
          created_at?: string
          id?: string
          order_id: string
          reason: string
          shop_id: string
        }
        Update: {
          amount_paise?: number
          created_at?: string
          id?: string
          order_id?: string
          reason?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_refunds_order_id_shop_id_fkey"
            columns: ["order_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id", "shop_id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string | null
          code: string
          created_at: string
          customer_id: string | null
          customer_name: string
          customer_phone: string
          delivery_fee_paise: number
          fulfilment: Database["public"]["Enums"]["fulfilment"]
          id: string
          ip_hash: string | null
          note: string | null
          shop_id: string
          status: Database["public"]["Enums"]["order_status"]
          token_hash: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          delivery_fee_paise?: number
          fulfilment: Database["public"]["Enums"]["fulfilment"]
          id?: string
          ip_hash?: string | null
          note?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["order_status"]
          token_hash: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          delivery_fee_paise?: number
          fulfilment?: Database["public"]["Enums"]["fulfilment"]
          id?: string
          ip_hash?: string | null
          note?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "public_storefront"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      product_forecasts: {
        Row: {
          computed_at: string
          days_left: number | null
          explanation: string | null
          explanation_lang: string | null
          explanation_on: string | null
          festival: string | null
          level: number
          order_qty: number | null
          product_id: string
          reorder_point: number | null
          shop_id: string
          sigma: number
          stockout_boost_until: string | null
        }
        ComputedFields: never
        Insert: {
          computed_at?: string
          days_left?: number | null
          explanation?: string | null
          explanation_lang?: string | null
          explanation_on?: string | null
          festival?: string | null
          level: number
          order_qty?: number | null
          product_id: string
          reorder_point?: number | null
          shop_id: string
          sigma: number
          stockout_boost_until?: string | null
        }
        Update: {
          computed_at?: string
          days_left?: number | null
          explanation?: string | null
          explanation_lang?: string | null
          explanation_on?: string | null
          festival?: string | null
          level?: number
          order_qty?: number | null
          product_id?: string
          reorder_point?: number | null
          shop_id?: string
          sigma?: number
          stockout_boost_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_forecasts_product_id_shop_id_fkey"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "product_forecasts_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "public_storefront"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "product_forecasts_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          aliases: string[]
          archived_at: string | null
          barcode: string | null
          category: string | null
          created_at: string
          id: string
          image_path: string | null
          is_in_stock: boolean
          is_published: boolean
          low_stock_level: number
          name: string
          pack_size: number
          price_paise: number | null
          shop_id: string
          stock_qty: number | null
          unit: string | null
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          aliases?: string[]
          archived_at?: string | null
          barcode?: string | null
          category?: string | null
          created_at?: string
          id?: string
          image_path?: string | null
          is_in_stock?: boolean
          is_published?: boolean
          low_stock_level?: number
          name: string
          pack_size?: number
          price_paise?: number | null
          shop_id: string
          stock_qty?: number | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          aliases?: string[]
          archived_at?: string | null
          barcode?: string | null
          category?: string | null
          created_at?: string
          id?: string
          image_path?: string | null
          is_in_stock?: boolean
          is_published?: boolean
          low_stock_level?: number
          name?: string
          pack_size?: number
          price_paise?: number | null
          shop_id?: string
          stock_qty?: number | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "public_storefront"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "products_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          changes: NonNullable<Json>
          confirmed_changes: Json | null
          created_at: string
          decided_at: string | null
          id: string
          input_path: string | null
          kind: Database["public"]["Enums"]["proposal_kind"]
          owner_edited: boolean | null
          shop_id: string
          status: Database["public"]["Enums"]["proposal_status"]
          transcript: string | null
        }
        ComputedFields: never
        Insert: {
          changes?: NonNullable<Json>
          confirmed_changes?: Json | null
          created_at?: string
          decided_at?: string | null
          id?: string
          input_path?: string | null
          kind: Database["public"]["Enums"]["proposal_kind"]
          owner_edited?: boolean | null
          shop_id: string
          status?: Database["public"]["Enums"]["proposal_status"]
          transcript?: string | null
        }
        Update: {
          changes?: NonNullable<Json>
          confirmed_changes?: Json | null
          created_at?: string
          decided_at?: string | null
          id?: string
          input_path?: string | null
          kind?: Database["public"]["Enums"]["proposal_kind"]
          owner_edited?: boolean | null
          shop_id?: string
          status?: Database["public"]["Enums"]["proposal_status"]
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "public_storefront"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "proposals_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          shop_id: string
        }
        ComputedFields: never
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          shop_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "public_storefront"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "push_subscriptions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        ComputedFields: never
        Insert: {
          count?: number
          key: string
          window_start: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          audio_deleted_at: string | null
          audio_path: string | null
          consent_at: string
          created_at: string
          id: string
          ip_hash: string | null
          is_hidden: boolean
          mentioned_product_ids: string[]
          sentiment: Database["public"]["Enums"]["sentiment"] | null
          shop_id: string
          status: Database["public"]["Enums"]["review_status"]
          stockout_product_ids: string[]
          summary: string | null
          transcript: string | null
        }
        ComputedFields: never
        Insert: {
          audio_deleted_at?: string | null
          audio_path?: string | null
          consent_at: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          is_hidden?: boolean
          mentioned_product_ids?: string[]
          sentiment?: Database["public"]["Enums"]["sentiment"] | null
          shop_id: string
          status?: Database["public"]["Enums"]["review_status"]
          stockout_product_ids?: string[]
          summary?: string | null
          transcript?: string | null
        }
        Update: {
          audio_deleted_at?: string | null
          audio_path?: string | null
          consent_at?: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          is_hidden?: boolean
          mentioned_product_ids?: string[]
          sentiment?: Database["public"]["Enums"]["sentiment"] | null
          shop_id?: string
          status?: Database["public"]["Enums"]["review_status"]
          stockout_product_ids?: string[]
          summary?: string | null
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "public_storefront"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "reviews_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          accepts_cash: boolean
          address: string | null
          category: string | null
          created_at: string
          delivers: boolean
          delivery_fee_paise: number | null
          delivery_min_paise: number | null
          delivery_radius_km: number | null
          demo_expires_at: string | null
          description: string | null
          free_delivery_above_paise: number | null
          hours: Json | null
          id: string
          is_demo: boolean
          is_published: boolean
          language: string
          lat: number | null
          lead_time_days: number
          lng: number | null
          name: string
          owner_id: string
          pay_on_delivery: boolean
          phone: string | null
          pincode: string | null
          review_period_days: number
          slug: string
          timezone: string
          updated_at: string
          upi_id: string | null
        }
        ComputedFields: never
        Insert: {
          accepts_cash?: boolean
          address?: string | null
          category?: string | null
          created_at?: string
          delivers?: boolean
          delivery_fee_paise?: number | null
          delivery_min_paise?: number | null
          delivery_radius_km?: number | null
          demo_expires_at?: string | null
          description?: string | null
          free_delivery_above_paise?: number | null
          hours?: Json | null
          id?: string
          is_demo?: boolean
          is_published?: boolean
          language?: string
          lat?: number | null
          lead_time_days?: number
          lng?: number | null
          name: string
          owner_id: string
          pay_on_delivery?: boolean
          phone?: string | null
          pincode?: string | null
          review_period_days?: number
          slug: string
          timezone?: string
          updated_at?: string
          upi_id?: string | null
        }
        Update: {
          accepts_cash?: boolean
          address?: string | null
          category?: string | null
          created_at?: string
          delivers?: boolean
          delivery_fee_paise?: number | null
          delivery_min_paise?: number | null
          delivery_radius_km?: number | null
          demo_expires_at?: string | null
          description?: string | null
          free_delivery_above_paise?: number | null
          hours?: Json | null
          id?: string
          is_demo?: boolean
          is_published?: boolean
          language?: string
          lat?: number | null
          lead_time_days?: number
          lng?: number | null
          name?: string
          owner_id?: string
          pay_on_delivery?: boolean
          phone?: string | null
          pincode?: string | null
          review_period_days?: number
          slug?: string
          timezone?: string
          updated_at?: string
          upi_id?: string | null
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          id: string
          idempotency_key: string
          kind: Database["public"]["Enums"]["movement_kind"]
          occurred_at: string
          product_id: string
          proposal_id: string | null
          qty: number
          shop_id: string
          source: Database["public"]["Enums"]["movement_source"]
          unit_price_paise: number | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          idempotency_key: string
          kind: Database["public"]["Enums"]["movement_kind"]
          occurred_at?: string
          product_id: string
          proposal_id?: string | null
          qty: number
          shop_id: string
          source: Database["public"]["Enums"]["movement_source"]
          unit_price_paise?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          idempotency_key?: string
          kind?: Database["public"]["Enums"]["movement_kind"]
          occurred_at?: string
          product_id?: string
          proposal_id?: string | null
          qty?: number
          shop_id?: string
          source?: Database["public"]["Enums"]["movement_source"]
          unit_price_paise?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_shop_id_fkey"
            columns: ["product_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "stock_movements_proposal_id_shop_id_fkey"
            columns: ["proposal_id", "shop_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id", "shop_id"]
          },
          {
            foreignKeyName: "stock_movements_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "public_storefront"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "stock_movements_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlist_items: {
        Row: {
          created_at: string
          product_id: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_storefront"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "wishlist_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      ai_spend_daily: {
        Row: {
          calls: number | null
          cost_usd: number | null
          day: string | null
          job: Database["public"]["Enums"]["ai_job"] | null
        }
        ComputedFields: never
        Relationships: []
      }
      public_storefront: {
        Row: {
          accepts_cash: boolean | null
          address: string | null
          delivers: boolean | null
          delivery_fee_paise: number | null
          delivery_min_paise: number | null
          delivery_radius_km: number | null
          free_delivery_above_paise: number | null
          hours: Json | null
          image_path: string | null
          in_stock: boolean | null
          language: string | null
          pay_on_delivery: boolean | null
          phone: string | null
          price_paise: number | null
          product_category: string | null
          product_id: string | null
          product_name: string | null
          shop_category: string | null
          shop_description: string | null
          shop_id: string | null
          shop_name: string | null
          slug: string | null
          timezone: string | null
          unit: string | null
          upi_id: string | null
        }
        ComputedFields: never
        Relationships: []
      }
    }
    Functions: {
      admin_today: { Args: Record<PropertyKey, never>; Returns: Json }
      ai_spend: {
        Args: { p_shop_id?: string }
        Returns: {
          shop_today_usd: number
          today_usd: number
          total_usd: number
        }[]
      }
      complete_order: { Args: { p_order_id: string }; Returns: undefined }
      confirm_proposal: {
        Args: { p_changes: Json; p_proposal_id: string }
        Returns: Json
      }
      hit_rate_limit: {
        Args: { p_key: string; p_window_seconds: number }
        Returns: number
      }
      nearby_shops: {
        Args: {
          p_lat: number
          p_limit?: number
          p_lng: number
          p_pincode: string
        }
        Returns: {
          address: string
          category: string
          distance_km: number
          hours: Json
          name: string
          pincode: string
          slug: string
          timezone: string
        }[]
      }
      undo_proposal: {
        Args: { p_proposal_id: string; p_window_seconds?: number }
        Returns: Json
      }
    }
    Enums: {
      ai_job:
        | "SETUP_EXTRACTION"
        | "COMMAND"
        | "BILL"
        | "SHELF"
        | "REVIEW"
        | "EXPLANATION"
        | "TRANSCRIBE"
        | "SEGMENT"
      ai_outcome:
        | "OK"
        | "SCHEMA_REJECTED"
        | "TIMEOUT"
        | "RATE_LIMITED"
        | "ERROR"
      breaker_state: "CLOSED" | "OPEN" | "HALF_OPEN"
      fulfilment: "PICKUP" | "DELIVERY"
      movement_kind: "SALE" | "DELIVERY" | "CORRECTION"
      movement_source: "VOICE" | "BILL" | "TAP" | "SEED" | "UNDO" | "ORDER"
      order_item_status: "PENDING" | "AVAILABLE" | "UNAVAILABLE"
      order_status: "NEW" | "ACCEPTED" | "READY" | "COMPLETED" | "CANCELLED"
      owner_action: "CONFIRMED" | "EDITED" | "REJECTED"
      proposal_kind: "SETUP" | "COMMAND" | "BILL" | "SHELF"
      proposal_status:
        | "PENDING"
        | "CONFIRMED"
        | "CANCELLED"
        | "FAILED"
        | "EXPIRED"
        | "UNDONE"
      review_status: "PENDING" | "ANALYZED" | "FAILED"
      sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE"
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
  public: {
    Enums: {
      ai_job: [
        "SETUP_EXTRACTION",
        "COMMAND",
        "BILL",
        "SHELF",
        "REVIEW",
        "EXPLANATION",
        "TRANSCRIBE",
        "SEGMENT",
      ],
      ai_outcome: ["OK", "SCHEMA_REJECTED", "TIMEOUT", "RATE_LIMITED", "ERROR"],
      breaker_state: ["CLOSED", "OPEN", "HALF_OPEN"],
      fulfilment: ["PICKUP", "DELIVERY"],
      movement_kind: ["SALE", "DELIVERY", "CORRECTION"],
      movement_source: ["VOICE", "BILL", "TAP", "SEED", "UNDO", "ORDER"],
      order_item_status: ["PENDING", "AVAILABLE", "UNAVAILABLE"],
      order_status: ["NEW", "ACCEPTED", "READY", "COMPLETED", "CANCELLED"],
      owner_action: ["CONFIRMED", "EDITED", "REJECTED"],
      proposal_kind: ["SETUP", "COMMAND", "BILL", "SHELF"],
      proposal_status: [
        "PENDING",
        "CONFIRMED",
        "CANCELLED",
        "FAILED",
        "EXPIRED",
        "UNDONE",
      ],
      review_status: ["PENDING", "ANALYZED", "FAILED"],
      sentiment: ["POSITIVE", "NEUTRAL", "NEGATIVE"],
    },
  },
} as const
