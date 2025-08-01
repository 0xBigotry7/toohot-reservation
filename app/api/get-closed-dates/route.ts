import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    console.log('🔍 Fetching closed dates settings from database...')
    
    // Try to get closed dates settings from database
    const { data: dbSettings, error: dbError } = await supabaseAdmin
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'closed_dates')
      .single()

    console.log('🗄️ Database query result:', { dbSettings, dbError })

    let closedDates: string[] = []
    let closedWeekdays: number[] = []
    let holidays: any[] = []
    let shiftClosures: any[] = []
    let source: string

    if (dbSettings && !dbError && dbSettings.setting_value) {
      // Use database settings if available
      closedDates = dbSettings.setting_value.dates || []
      closedWeekdays = dbSettings.setting_value.closedWeekdays || []
      holidays = dbSettings.setting_value.holidays || []
      shiftClosures = dbSettings.setting_value.shiftClosures || []
      source = 'database'
      console.log('Loaded enhanced closed dates settings from database:', { 
        closedDates, 
        closedWeekdays, 
        holidaysCount: holidays.length,
        shiftClosuresCount: shiftClosures.length 
      })
    } else {
      // No closed dates found, return empty arrays
      source = 'default'
      console.log('No closed dates settings found, using empty arrays')
    }

    return NextResponse.json({
      success: true,
      closedDates,
      closedWeekdays,
      holidays,
      shiftClosures,
      source // For debugging - shows whether settings came from DB or default
    })
  } catch (error) {
    console.error('Error fetching closed dates settings:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch closed dates settings',
        closedDates: [],
        source: 'error'
      },
      { status: 500 }
    )
  }
} 