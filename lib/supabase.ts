import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Initialize Supabase client only when needed to avoid build-time errors
let supabase: SupabaseClient | null = null

function getSupabaseClient() {
  if (!supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL environment variable is not set')
    }
    
    if (!supabaseAnonKey) {
      throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable is not set')
    }
    
    supabase = createClient(supabaseUrl, supabaseAnonKey)
  }
  return supabase
}

// Export a function that returns the client instead of the client directly
export { getSupabaseClient as supabase }

// Database types - Updated to match enhanced schema
export interface OmakaseReservation {
  id: string
  customer_name: string
  customer_email: string
  customer_phone: string
  reservation_date: string
  reservation_time: string
  party_size: number
  special_requests?: string
  notes?: string // New: Internal admin notes
  confirmation_code?: string // New: Customer confirmation code
  cancellation_reason?: string // New: Reason for cancellation
  status: 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no-show' // Updated: All status options
  created_at: string
  updated_at: string
}

export interface TimeSlot {
  time: string
  available_seats: number
  total_seats: number
} 