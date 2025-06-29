import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Get the current server-side auto-confirmation settings
    const autoConfirmOmakase = process.env.AUTO_CONFIRM_OMAKASE === 'true'
    const autoConfirmDining = process.env.AUTO_CONFIRM_DINING === 'true'

    return NextResponse.json({
      success: true,
      settings: {
        autoConfirmOmakase,
        autoConfirmDining
      }
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
        }
      },
      { status: 500 }
    )
  }
} 