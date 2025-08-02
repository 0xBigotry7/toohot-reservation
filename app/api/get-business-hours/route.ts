import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    console.log('🔍 Fetching business hours from database...')
    
    // Try to get business hours from database
    const { data: dbSettings, error: dbError } = await supabaseAdmin
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'business_hours')
      .single()

    if (dbSettings && !dbError && dbSettings.setting_value) {
      console.log('Loaded business hours from database')
      
      return NextResponse.json({
        success: true,
        settings: dbSettings.setting_value,
        source: 'database'
      })
    } else {
      // Return default business hours if none exist
      const defaultHours = {
        0: { isOpen: true, lunch: { start: '12:00', end: '15:00' }, dinner: { start: '17:00', end: '22:00' } }, // Sunday
        1: { isOpen: true, lunch: { start: '12:00', end: '15:00' }, dinner: { start: '17:00', end: '22:00' } }, // Monday
        2: { isOpen: true, lunch: { start: '12:00', end: '15:00' }, dinner: { start: '17:00', end: '22:00' } }, // Tuesday
        3: { isOpen: true, lunch: { start: '12:00', end: '15:00' }, dinner: { start: '17:00', end: '22:00' } }, // Wednesday
        4: { isOpen: true, lunch: { start: '12:00', end: '15:00' }, dinner: { start: '17:00', end: '22:00' } }, // Thursday
        5: { isOpen: true, lunch: { start: '12:00', end: '15:00' }, dinner: { start: '17:00', end: '22:00' } }, // Friday
        6: { isOpen: true, lunch: { start: '12:00', end: '15:00' }, dinner: { start: '17:00', end: '22:00' } }, // Saturday
      }
      
      console.log('No business hours found, returning defaults')
      
      return NextResponse.json({
        success: true,
        settings: defaultHours,
        source: 'default'
      })
    }
  } catch (error) {
    console.error('Error fetching business hours:', error)
    
    // Return default hours on error
    const defaultHours = {
      0: { isOpen: true, lunch: { start: '12:00', end: '15:00' }, dinner: { start: '17:00', end: '22:00' } },
      1: { isOpen: true, lunch: { start: '12:00', end: '15:00' }, dinner: { start: '17:00', end: '22:00' } },
      2: { isOpen: true, lunch: { start: '12:00', end: '15:00' }, dinner: { start: '17:00', end: '22:00' } },
      3: { isOpen: true, lunch: { start: '12:00', end: '15:00' }, dinner: { start: '17:00', end: '22:00' } },
      4: { isOpen: true, lunch: { start: '12:00', end: '15:00' }, dinner: { start: '17:00', end: '22:00' } },
      5: { isOpen: true, lunch: { start: '12:00', end: '15:00' }, dinner: { start: '17:00', end: '22:00' } },
      6: { isOpen: true, lunch: { start: '12:00', end: '15:00' }, dinner: { start: '17:00', end: '22:00' } },
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch settings',
        settings: defaultHours,
        source: 'error'
      },
      { status: 500 }
    )
  }
}