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

    let omakaseCapacity: number
    let diningCapacity: number
    let source: string

    if (dbSettings && !dbError && dbSettings.setting_value) {
      // Use database settings if available
      omakaseCapacity = dbSettings.setting_value.omakaseCapacity || 12
      diningCapacity = dbSettings.setting_value.diningCapacity || 40
      source = 'database'
      console.log('Loaded seat capacity settings from database:', { omakaseCapacity, diningCapacity })
    } else {
      // Fall back to default values if no database settings
      omakaseCapacity = 12 // Default omakase capacity
      diningCapacity = 40  // Default dining capacity
      source = 'default'
      console.log('Using default seat capacity settings:', { omakaseCapacity, diningCapacity })
    }

    return NextResponse.json({
      success: true,
      settings: {
        omakaseCapacity,
        diningCapacity
      },
      source // For debugging - shows whether settings came from DB or defaults
    })
  } catch (error) {
    console.error('Error fetching seat capacity settings:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch settings',
        // Return default capacity settings on error
        settings: {
          omakaseCapacity: 12,
          diningCapacity: 40
        },
        source: 'error_fallback'
      },
      { status: 500 }
    )
  }
} 