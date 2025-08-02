import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface TimeSlot {
  time: string
  covers: number
  enabled: boolean
}

interface SlotBasedCapacitySettings {
  type: 'slot_based'
  mode?: 'simple' | 'advanced' // Track which mode is being used
  slotDuration: 15 | 30
  omakase: TimeSlot[]
  dining: TimeSlot[]
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Only accept slot-based format for v2
    if (body.type !== 'slot_based') {
      return NextResponse.json(
        { success: false, error: 'Only slot-based format is supported in v2' },
        { status: 400 }
      )
    }

    const settings = body as SlotBasedCapacitySettings
    
    // Validate slot-based format
    if (typeof settings.slotDuration !== 'number' || ![15, 30].includes(settings.slotDuration)) {
      return NextResponse.json(
        { success: false, error: 'Invalid slot duration. Must be 15 or 30 minutes' },
        { status: 400 }
      )
    }
    
    // Validate slots
    const validateSlot = (slot: TimeSlot): string | null => {
      if (!slot.time || !/^\d{2}:\d{2}$/.test(slot.time)) {
        return 'Invalid time format'
      }
      if (typeof slot.covers !== 'number' || slot.covers < 0 || slot.covers > 999) {
        return 'Invalid covers. Must be between 0 and 999'
      }
      if (typeof slot.enabled !== 'boolean') {
        return 'Invalid enabled status'
      }
      return null
    }
    
    for (const slot of settings.omakase) {
      const error = validateSlot(slot)
      if (error) {
        return NextResponse.json(
          { success: false, error: `Omakase slot error: ${error}` },
          { status: 400 }
        )
      }
    }
    
    for (const slot of settings.dining) {
      const error = validateSlot(slot)
      if (error) {
        return NextResponse.json(
          { success: false, error: `Dining slot error: ${error}` },
          { status: 400 }
        )
      }
    }
    
    // Save the slot-based settings to v2 key
    const { data, error } = await supabaseAdmin
      .from('admin_settings')
      .upsert({
        setting_key: 'seat_capacity_v2',
        setting_value: {
          ...settings,
          mode: settings.mode || 'simple' // Default to simple if not specified
        },
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'setting_key'
      })

    if (error) {
      console.error('Error saving slot-based capacity settings v2:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to save settings to database' },
        { status: 500 }
      )
    }

    console.log('Slot-based capacity settings v2 saved successfully')

    return NextResponse.json({
      success: true,
      message: 'Slot-based settings v2 saved successfully',
      settings
    })
  } catch (error) {
    console.error('Error saving seat capacity settings v2:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error'
      },
      { status: 500 }
    )
  }
}