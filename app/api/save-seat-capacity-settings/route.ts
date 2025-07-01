import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { omakaseCapacity, diningCapacity } = await request.json()

    // Validate input
    if (typeof omakaseCapacity !== 'number' || typeof diningCapacity !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Invalid settings format - capacity values must be numbers' },
        { status: 400 }
      )
    }

    // Validate capacity values are positive
    if (omakaseCapacity < 1 || diningCapacity < 1) {
      return NextResponse.json(
        { success: false, error: 'Capacity values must be at least 1' },
        { status: 400 }
      )
    }

    // Validate capacity values are reasonable (max 200 seats)
    if (omakaseCapacity > 200 || diningCapacity > 200) {
      return NextResponse.json(
        { success: false, error: 'Capacity values cannot exceed 200 seats' },
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
          omakaseCapacity,
          diningCapacity
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

    console.log('Seat capacity settings saved successfully:', { omakaseCapacity, diningCapacity })

    return NextResponse.json({
      success: true,
      message: 'Seat capacity settings saved successfully',
      settings: {
        omakaseCapacity,
        diningCapacity
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