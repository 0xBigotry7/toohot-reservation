import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { omakaseAvailableDays, diningAvailableDays, diningAvailableShifts } = await request.json()

    // Validate input
    if (!Array.isArray(omakaseAvailableDays) || !Array.isArray(diningAvailableDays)) {
      return NextResponse.json(
        { success: false, error: 'Both omakaseAvailableDays and diningAvailableDays must be arrays' },
        { status: 400 }
      )
    }

    // Validate day indices (0-6 for Sunday-Saturday)
    const validateDays = (days: number[], name: string) => {
      for (const day of days) {
        if (typeof day !== 'number' || day < 0 || day > 6) {
          return `${name} must contain numbers between 0-6 (0=Sunday, 6=Saturday)`
        }
      }
      return null
    }

    const omakaseError = validateDays(omakaseAvailableDays, 'omakaseAvailableDays')
    if (omakaseError) {
      return NextResponse.json({ success: false, error: omakaseError }, { status: 400 })
    }

    const diningError = validateDays(diningAvailableDays, 'diningAvailableDays')
    if (diningError) {
      return NextResponse.json({ success: false, error: diningError }, { status: 400 })
    }

    // Dining must have at least one day, but omakase can have no days (fully closed)
    if (diningAvailableDays.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Dining must be available on at least one day' },
        { status: 400 }
      )
    }

    // Remove duplicates and sort
    const uniqueOmakaseDays = Array.from(new Set(omakaseAvailableDays)).sort()
    const uniqueDiningDays = Array.from(new Set(diningAvailableDays)).sort()

    // Use upsert to create or update settings
    const { data, error } = await supabaseAdmin
      .from('admin_settings')
      .upsert({
        setting_key: 'availability_settings',
        setting_value: {
          omakaseAvailableDays: uniqueOmakaseDays,
          diningAvailableDays: uniqueDiningDays,
          diningAvailableShifts: diningAvailableShifts || {}
        },
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'setting_key'
      })

    if (error) {
      console.error('Error saving availability settings:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to save settings to database' },
        { status: 500 }
      )
    }

    console.log('Availability settings saved successfully:', { 
      omakaseAvailableDays: uniqueOmakaseDays, 
      diningAvailableDays: uniqueDiningDays 
    })

    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully',
      settings: {
        omakaseAvailableDays: uniqueOmakaseDays,
        diningAvailableDays: uniqueDiningDays
      }
    })
  } catch (error) {
    console.error('Error saving availability settings:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error'
      },
      { status: 500 }
    )
  }
} 