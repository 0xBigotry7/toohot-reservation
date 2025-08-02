import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const businessHours = await request.json()

    // Validate the structure
    for (let day = 0; day < 7; day++) {
      if (!businessHours.hasOwnProperty(day)) {
        return NextResponse.json(
          { success: false, error: `Missing schedule for day ${day}` },
          { status: 400 }
        )
      }

      const schedule = businessHours[day]
      if (typeof schedule.isOpen !== 'boolean') {
        return NextResponse.json(
          { success: false, error: `Invalid isOpen value for day ${day}` },
          { status: 400 }
        )
      }

      if (schedule.isOpen) {
        // Validate time slots if the day is open
        const validateTimeSlot = (slot: any, name: string) => {
          if (!slot) return // Slot is optional
          if (!slot.start || !slot.end) {
            throw new Error(`Invalid ${name} time for day ${day}`)
          }
          if (!/^\d{2}:\d{2}$/.test(slot.start) || !/^\d{2}:\d{2}$/.test(slot.end)) {
            throw new Error(`Invalid ${name} time format for day ${day}`)
          }
        }

        validateTimeSlot(schedule.lunch, 'lunch')
        validateTimeSlot(schedule.dinner, 'dinner')
      }
    }

    // Save to database
    const { data, error } = await supabaseAdmin
      .from('admin_settings')
      .upsert({
        setting_key: 'business_hours',
        setting_value: businessHours,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'setting_key'
      })

    if (error) {
      console.error('Error saving business hours:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to save settings to database' },
        { status: 500 }
      )
    }

    console.log('Business hours saved successfully')

    return NextResponse.json({
      success: true,
      message: 'Business hours saved successfully',
      settings: businessHours
    })
  } catch (error) {
    console.error('Error saving business hours:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}