import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface TimeInterval {
  id: string
  startTime: string
  endTime: string
  capacity: number
}

interface TimeIntervalCapacitySettings {
  type: 'time_interval'
  omakase: {
    intervals: TimeInterval[]
  }
  dining: {
    intervals: TimeInterval[]
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Check if it's the new time interval format
    if (body.type === 'time_interval') {
      // Validate time interval format
      const settings = body as TimeIntervalCapacitySettings
      
      // Validate omakase intervals
      if (!settings.omakase?.intervals || !Array.isArray(settings.omakase.intervals)) {
        return NextResponse.json(
          { success: false, error: 'Invalid omakase intervals format' },
          { status: 400 }
        )
      }
      
      // Validate dining intervals
      if (!settings.dining?.intervals || !Array.isArray(settings.dining.intervals)) {
        return NextResponse.json(
          { success: false, error: 'Invalid dining intervals format' },
          { status: 400 }
        )
      }
      
      // Validate each interval
      const validateInterval = (interval: TimeInterval): string | null => {
        if (!interval.id || !interval.startTime || !interval.endTime) {
          return 'Missing required fields in interval'
        }
        if (typeof interval.capacity !== 'number' || interval.capacity < 0 || interval.capacity > 200) {
          return 'Invalid capacity. Must be between 0 and 200'
        }
        return null
      }
      
      for (const interval of settings.omakase.intervals) {
        const error = validateInterval(interval)
        if (error) {
          return NextResponse.json(
            { success: false, error: `Omakase interval error: ${error}` },
            { status: 400 }
          )
        }
      }
      
      for (const interval of settings.dining.intervals) {
        const error = validateInterval(interval)
        if (error) {
          return NextResponse.json(
            { success: false, error: `Dining interval error: ${error}` },
            { status: 400 }
          )
        }
      }
      
      // Save the time interval settings
      const { data, error } = await supabaseAdmin
        .from('admin_settings')
        .upsert({
          setting_key: 'seat_capacity',
          setting_value: settings,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'setting_key'
        })

      if (error) {
        console.error('Error saving time interval capacity settings:', error)
        return NextResponse.json(
          { success: false, error: 'Failed to save settings to database' },
          { status: 500 }
        )
      }

      console.log('Time interval capacity settings saved successfully')

      return NextResponse.json({
        success: true,
        message: 'Time interval settings saved successfully',
        settings
      })
    } else {
      // Legacy format support
      const { omakaseSeats, diningSeats } = body

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
    }
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