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
      // Check if it's the new format (time_interval or slot_based)
      if (dbSettings.setting_value.type === 'time_interval' || dbSettings.setting_value.type === 'slot_based') {
        console.log(`Found ${dbSettings.setting_value.type} format, extracting simple capacity values`)
        
        // Extract capacity values from the complex format
        let omakaseSeats = 12 // default
        let diningSeats = 24 // default
        
        if (dbSettings.setting_value.type === 'time_interval') {
          // For time interval, find the maximum capacity across all intervals
          const omakaseIntervals = dbSettings.setting_value.omakase?.intervals || []
          const diningIntervals = dbSettings.setting_value.dining?.intervals || []
          
          omakaseSeats = omakaseIntervals.reduce((max: number, interval: any) => 
            Math.max(max, interval.capacity || 0), 12)
          diningSeats = diningIntervals.reduce((max: number, interval: any) => 
            Math.max(max, interval.capacity || 0), 24)
        } else if (dbSettings.setting_value.type === 'slot_based') {
          // For slot-based, find the maximum enabled capacity
          const omakaseSlots = dbSettings.setting_value.omakase || []
          const diningSlots = dbSettings.setting_value.dining || []
          
          omakaseSeats = omakaseSlots
            .filter((slot: any) => slot.enabled)
            .reduce((max: number, slot: any) => Math.max(max, slot.covers || 0), 12)
          diningSeats = diningSlots
            .filter((slot: any) => slot.enabled)
            .reduce((max: number, slot: any) => Math.max(max, slot.covers || 0), 24)
        }
        
        console.log('Extracted simple capacity values:', { omakaseSeats, diningSeats })
        
        return NextResponse.json({
          success: true,
          settings: {
            omakaseSeats,
            diningSeats
          },
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