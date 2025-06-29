import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { autoConfirmOmakase, autoConfirmDining } = await request.json()

    // Validate input
    if (typeof autoConfirmOmakase !== 'boolean' || typeof autoConfirmDining !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Invalid settings format' },
        { status: 400 }
      )
    }

    // Use upsert to create or update settings
    // We'll store settings with a fixed key 'auto_confirmation'
    const { data, error } = await supabase()
      .from('admin_settings')
      .upsert({
        setting_key: 'auto_confirmation',
        setting_value: {
          autoConfirmOmakase,
          autoConfirmDining
        },
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'setting_key'
      })

    if (error) {
      console.error('Error saving auto-confirmation settings:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to save settings to database' },
        { status: 500 }
      )
    }

    console.log('Auto-confirmation settings saved successfully:', { autoConfirmOmakase, autoConfirmDining })

    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully',
      settings: {
        autoConfirmOmakase,
        autoConfirmDining
      }
    })
  } catch (error) {
    console.error('Error saving auto-confirmation settings:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error'
      },
      { status: 500 }
    )
  }
} 