import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { closedDates, closedWeekdays, holidays } = await request.json()

    // Validate closed dates
    if (!Array.isArray(closedDates)) {
      return NextResponse.json(
        { success: false, error: 'closedDates must be an array of date strings' },
        { status: 400 }
      )
    }

    // Validate each date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    for (const dateStr of closedDates) {
      if (typeof dateStr !== 'string' || !dateRegex.test(dateStr)) {
        return NextResponse.json(
          { success: false, error: `Invalid date format: ${dateStr}. Must be YYYY-MM-DD format.` },
          { status: 400 }
        )
      }
      
      // Additional validation: check if date is valid
      const date = new Date(dateStr)
      if (isNaN(date.getTime()) || date.toISOString().split('T')[0] !== dateStr) {
        return NextResponse.json(
          { success: false, error: `Invalid date: ${dateStr}` },
          { status: 400 }
        )
      }
    }

    // Validate closed weekdays
    if (!Array.isArray(closedWeekdays)) {
      return NextResponse.json(
        { success: false, error: 'closedWeekdays must be an array of numbers (0-6)' },
        { status: 400 }
      )
    }

    for (const weekday of closedWeekdays) {
      if (typeof weekday !== 'number' || weekday < 0 || weekday > 6) {
        return NextResponse.json(
          { success: false, error: 'closedWeekdays must contain numbers between 0-6 (0=Sunday, 6=Saturday)' },
          { status: 400 }
        )
      }
    }

    // Validate holidays
    if (!Array.isArray(holidays)) {
      return NextResponse.json(
        { success: false, error: 'holidays must be an array of holiday objects' },
        { status: 400 }
      )
    }

    // Remove duplicates and sort dates
    const uniqueSortedDates = Array.from(new Set(closedDates)).sort()
    const uniqueSortedWeekdays = Array.from(new Set(closedWeekdays)).sort()

    // Use upsert to create or update settings
    const { data, error } = await supabaseAdmin
      .from('admin_settings')
      .upsert({
        setting_key: 'closed_dates',
        setting_value: {
          dates: uniqueSortedDates,
          closedWeekdays: uniqueSortedWeekdays,
          holidays: holidays
        },
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'setting_key'
      })

    if (error) {
      console.error('Error saving closed dates settings:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to save settings to database' },
        { status: 500 }
      )
    }

    console.log('Enhanced closed dates settings saved successfully:', { 
      closedDates: uniqueSortedDates,
      closedWeekdays: uniqueSortedWeekdays,
      holidaysCount: holidays.length
    })

    return NextResponse.json({
      success: true,
      message: 'Closed dates settings saved successfully',
      closedDates: uniqueSortedDates,
      closedWeekdays: uniqueSortedWeekdays,
      holidays: holidays
    })
  } catch (error) {
    console.error('Error saving closed dates settings:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error'
      },
      { status: 500 }
    )
  }
} 