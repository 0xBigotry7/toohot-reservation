import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Force dynamic rendering to prevent caching
export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    console.log('🔍 Fetching seat capacity v2 settings from database...')
    
    // Try to get v2 settings from database
    const { data: dbSettings, error: dbError } = await supabaseAdmin
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'seat_capacity_v2')
      .single()

    console.log('🗄️ Database query result:', { dbSettings, dbError })

    if (dbSettings && !dbError && dbSettings.setting_value) {
      console.log('Loaded seat capacity v2 settings from database')
      
      return NextResponse.json({
        success: true,
        settings: dbSettings.setting_value,
        source: 'database'
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      })
    } else {
      // If no v2 settings, try to get v1 settings for initialization
      const { data: v1Settings } = await supabaseAdmin
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'seat_capacity')
        .single()
      
      if (v1Settings?.setting_value) {
        // Convert v1 to slot-based format for initialization
        const omakaseSeats = v1Settings.setting_value.omakaseSeats || 12
        const diningSeats = v1Settings.setting_value.diningSeats || 24
        
        console.log('No v2 settings found, initializing from v1:', { omakaseSeats, diningSeats })
        
        return NextResponse.json({
          success: true,
          settings: {
            type: 'slot_based',
            slotDuration: 30,
            omakase: [],
            dining: []
          },
          source: 'default'
        }, {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          }
        })
      }
      
      // Return default if nothing exists
      return NextResponse.json({
        success: true,
        settings: {
          type: 'slot_based',
          slotDuration: 30,
          omakase: [],
          dining: []
        },
        source: 'default'
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      })
    }
  } catch (error) {
    console.error('Error fetching seat capacity v2 settings:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch settings',
        settings: {
          type: 'slot_based',
          slotDuration: 30,
          omakase: [],
          dining: []
        },
        source: 'error'
      },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      }
    )
  }
}