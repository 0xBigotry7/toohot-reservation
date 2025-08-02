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

    if (dbSettings && !dbError && dbSettings.setting_value) {
      // Check if it's the new time interval format
      if (dbSettings.setting_value.type === 'time_interval') {
        console.log('Loaded time interval capacity settings from database')
        
        return NextResponse.json({
          success: true,
          settings: dbSettings.setting_value,
          source: 'database'
        })
      } else {
        // Legacy format
        const omakaseSeats = dbSettings.setting_value.omakaseSeats
        const diningSeats = dbSettings.setting_value.diningSeats
        console.log('Loaded legacy seat capacity settings from database:', { omakaseSeats, diningSeats })
        
        return NextResponse.json({
          success: true,
          settings: {
            omakaseSeats,
            diningSeats
          },
          source: 'database'
        })
      }
    } else {
      // Fall back to environment variables if no database settings
      const omakaseSeats = parseInt(process.env.OMAKASE_SEATS || '12', 10)
      const diningSeats = parseInt(process.env.DINING_SEATS || '24', 10)
      console.log('Loaded seat capacity settings from environment:', { omakaseSeats, diningSeats })
      
      return NextResponse.json({
        success: true,
        settings: {
          omakaseSeats,
          diningSeats
        },
        source: 'environment'
      })
    }
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