export interface Category {
  id: number;
  name: string;
  description: string;
  sort_order: number;
  created_at: string;
}

export interface Product {
  id: number;
  category_id: number;
  name: string;
  description: string;
  price: number;
  status: string; // 'active' | 'inactive'
  image_url: string;
  created_at: string;
  stock_count?: number; // Attached dynamically by backend
  custom_fields?: string; // Comma-separated extra fields configuration
}

export interface Card {
  id: number;
  product_id: number;
  code: string;
  status: string; // 'unsold' | 'sold'
  order_id: string | null;
  created_at: string;
  sold_at: string | null;
}

export interface Order {
  id: string;
  product_id: number;
  product_name: string;
  quantity: number;
  price: number;
  total_amount: number;
  contact_info: string;
  card_codes: string;
  created_at: string;
  custom_values?: string; // Serialized key-value JSON string
  exchange_code?: string; // Redemption code used
}

export interface SiteConfig {
  site_title: string;
  announcement: string;
  contact_info: string;
  payment_instructions: string;
}
