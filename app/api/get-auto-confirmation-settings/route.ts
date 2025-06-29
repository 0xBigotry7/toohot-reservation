import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // First, try to get settings from database
    const { data: dbSettings, error: dbError } = await supabase()
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'auto_confirmation')
      .single()

    let autoConfirmOmakase: boolean
    let autoConfirmDining: boolean
    let source: string

    if (dbSettings && !dbError && dbSettings.setting_value) {
      // Use database settings if available
      autoConfirmOmakase = dbSettings.setting_value.autoConfirmOmakase
      autoConfirmDining = dbSettings.setting_value.autoConfirmDining
      source = 'database'
      console.log('Loaded auto-confirmation settings from database:', { autoConfirmOmakase, autoConfirmDining })
    } else {
      // Fall back to environment variables if no database settings
      autoConfirmOmakase = process.env.AUTO_CONFIRM_OMAKASE === 'true'
      autoConfirmDining = process.env.AUTO_CONFIRM_DINING === 'true'
      source = 'environment'
      console.log('Loaded auto-confirmation settings from environment:', { autoConfirmOmakase, autoConfirmDining })
    }

    return NextResponse.json({
      success: true,
      settings: {
        autoConfirmOmakase,
        autoConfirmDining
      },
      source // For debugging - shows whether settings came from DB or env
    })
  } catch (error) {
    console.error('Error fetching auto-confirmation settings:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch settings',
        // Return default recommended settings on error
        settings: {
          autoConfirmOmakase: false,
          autoConfirmDining: true
        },
        source: 'default'
      },
      { status: 500 }
    )
  }
} 