import { createClient } from '@supabase/supabase-js'

// Supabase admin client for server-side operations only
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Helper function to get seat capacity settings from database with fallback
export async function getSeatCapacitySettings() {
  try {
    console.log('🔍 Fetching seat capacity settings from database...')
    
    // First, try to get settings from database
    const { data: dbSettings, error: dbError } = await supabaseAdmin
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'seat_capacity')
      .single()

    if (dbSettings && !dbError && dbSettings.setting_value) {
      // Use database settings if available
      const omakaseSeats = dbSettings.setting_value.omakaseSeats
      const diningSeats = dbSettings.setting_value.diningSeats
      console.log('Loaded seat capacity settings from database:', { omakaseSeats, diningSeats })
      return { omakaseSeats, diningSeats, source: 'database' }
    } else {
      // Fall back to environment variables if no database settings
      const omakaseSeats = parseInt(process.env.OMAKASE_SEATS || '12', 10)
      const diningSeats = parseInt(process.env.DINING_SEATS || '24', 10)
      console.log('Loaded seat capacity settings from environment:', { omakaseSeats, diningSeats })
      return { omakaseSeats, diningSeats, source: 'environment' }
    }
  } catch (error) {
    console.error('Error fetching seat capacity settings, using defaults:', error)
    // Return default settings on error
    return { omakaseSeats: 12, diningSeats: 24, source: 'default' }
  }
}

 