import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { mode } = await request.json()

    // Validate mode
    if (!mode || !['simple', 'advanced'].includes(mode)) {
      return NextResponse.json(
        { success: false, error: 'Invalid mode. Must be "simple" or "advanced"' },
        { status: 400 }
      )
    }

    // First, get the existing v2 settings
    const { data: existingSettings, error: fetchError } = await supabaseAdmin
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'seat_capacity_v2')
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = not found
      console.error('Error fetching existing settings:', fetchError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch existing settings' },
        { status: 500 }
      )
    }

    // Prepare the updated settings
    let updatedSettings = {
      type: 'slot_based' as const,
      mode,
      slotDuration: 30,
      omakase: [],
      dining: []
    }

    // If settings exist, preserve the slot data
    if (existingSettings?.setting_value) {
      updatedSettings = {
        ...existingSettings.setting_value,
        mode // Only update the mode
      }
    }

    // Save the updated settings
    const { error: saveError } = await supabaseAdmin
      .from('admin_settings')
      .upsert({
        setting_key: 'seat_capacity_v2',
        setting_value: updatedSettings,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'setting_key'
      })

    if (saveError) {
      console.error('Error saving capacity mode:', saveError)
      return NextResponse.json(
        { success: false, error: 'Failed to save capacity mode' },
        { status: 500 }
      )
    }

    console.log(`Capacity mode updated to: ${mode}`)

    return NextResponse.json({
      success: true,
      message: `Capacity mode updated to ${mode}`,
      settings: updatedSettings
    })

  } catch (error) {
    console.error('Error updating capacity mode:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error'
      },
      { status: 500 }
    )
  }
}