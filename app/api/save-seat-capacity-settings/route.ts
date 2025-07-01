import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { omakaseSeats, diningSeats } = await request.json()

    // Validate input
    if (typeof omakaseSeats !== 'number' || typeof diningSeats !== 'number' || 
        omakaseSeats < 0 || diningSeats < 0 || 
        omakaseSeats > 100 || diningSeats > 100) {
      return NextResponse.json(
        { success: false, error: 'Invalid seat capacity values. Must be numbers between 0 and 100.' },
        { status: 400 }
      )
    }

    // Use upsert to create or update settings
    // We'll store settings with a fixed key 'seat_capacity'
    const { data, error } = await supabaseAdmin
      .from('admin_settings')
      .upsert({
        setting_key: 'seat_capacity',
        setting_value: {
          omakaseSeats,
          diningSeats
        },
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'setting_key'
      })

    if (error) {
      console.error('Error saving seat capacity settings:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to save settings to database' },
        { status: 500 }
      )
    }

    console.log('Seat capacity settings saved successfully:', { omakaseSeats, diningSeats })

    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully',
      settings: {
        omakaseSeats,
        diningSeats
      }
    })
  } catch (error) {
    console.error('Error saving seat capacity settings:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error'
      },
      { status: 500 }
    )
  }
} 