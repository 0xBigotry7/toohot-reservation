import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    // Try to get settings from database
    const { data: dbSettings, error: dbError } = await supabaseAdmin
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'availability_settings')
      .single()

    if (dbSettings && !dbError && dbSettings.setting_value) {
      console.log('Loaded availability settings from database:', dbSettings.setting_value)
      
      return NextResponse.json({
        success: true,
        settings: {
          omakaseAvailableDays: dbSettings.setting_value.omakaseAvailableDays || [4], // Default: Thursday only
          diningAvailableDays: dbSettings.setting_value.diningAvailableDays || [0, 1, 2, 3, 4, 5, 6], // Default: All days
          diningAvailableShifts: dbSettings.setting_value.diningAvailableShifts || {
            0: ['lunch', 'dinner'],
            1: ['lunch', 'dinner'],
            2: ['lunch', 'dinner'],
            3: ['lunch', 'dinner'],
            4: ['lunch', 'dinner'],
            5: ['lunch', 'dinner'],
            6: ['lunch', 'dinner']
          }
        },
        source: 'database'
      })
    }

    // Return default settings if not found in database
    console.log('No availability settings found in database, using defaults')
    return NextResponse.json({
      success: true,
      settings: {
        omakaseAvailableDays: [4], // Default: Thursday only
        diningAvailableDays: [0, 1, 2, 3, 4, 5, 6], // Default: All days
        diningAvailableShifts: {
          0: ['lunch', 'dinner'],
          1: ['lunch', 'dinner'],
          2: ['lunch', 'dinner'],
          3: ['lunch', 'dinner'],
          4: ['lunch', 'dinner'],
          5: ['lunch', 'dinner'],
          6: ['lunch', 'dinner']
        }
      },
      source: 'default'
    })

  } catch (error) {
    console.error('Error fetching availability settings:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch settings',
        // Return default settings on error
        settings: {
          omakaseAvailableDays: [4], // Default: Thursday only
          diningAvailableDays: [0, 1, 2, 3, 4, 5, 6], // Default: All days
          diningAvailableShifts: {
            0: ['lunch', 'dinner'],
            1: ['lunch', 'dinner'],
            2: ['lunch', 'dinner'],
            3: ['lunch', 'dinner'],
            4: ['lunch', 'dinner'],
            5: ['lunch', 'dinner'],
            6: ['lunch', 'dinner']
          }
        },
        source: 'default'
      },
      { status: 500 }
    )
  }
} 