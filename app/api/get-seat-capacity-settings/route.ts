import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    console.log('🔍 Fetching seat capacity settings from database...')
    
    // First, try to get settings from database
    const { data: dbSettings, error: dbError } = await supabaseAdmin
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'seat_capacity')
      .single()

    console.log('🗄️ Database query result:', { dbSettings, dbError })

    let omakaseSeats: number
    let diningSeats: number
    let source: string

    if (dbSettings && !dbError && dbSettings.setting_value) {
      // Use database settings if available
      omakaseSeats = dbSettings.setting_value.omakaseSeats
      diningSeats = dbSettings.setting_value.diningSeats
      source = 'database'
      console.log('Loaded seat capacity settings from database:', { omakaseSeats, diningSeats })
    } else {
      // Fall back to environment variables if no database settings
      omakaseSeats = parseInt(process.env.OMAKASE_SEATS || '12', 10)
      diningSeats = parseInt(process.env.DINING_SEATS || '24', 10)
      source = 'environment'
      console.log('Loaded seat capacity settings from environment:', { omakaseSeats, diningSeats })
    }

    return NextResponse.json({
      success: true,
      settings: {
        omakaseSeats,
        diningSeats
      },
      source // For debugging - shows whether settings came from DB or env
    })
  } catch (error) {
    console.error('Error fetching seat capacity settings:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch settings',
        // Return default settings on error
        settings: {
          omakaseSeats: 12,
          diningSeats: 24
        },
        source: 'default'
      },
      { status: 500 }
    )
  }
} 