import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface AutoConfirmationSettings {
  autoConfirmOmakase: boolean
  autoConfirmDining: boolean
}

/**
 * Get auto-confirmation settings from database, with environment variable fallback
 */
export async function getAutoConfirmationSettings(): Promise<AutoConfirmationSettings> {
  try {
    // Try to get settings from database first
    const { data: dbSettings, error: dbError } = await supabaseAdmin
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'auto_confirmation')
      .single()

    if (dbSettings && !dbError && dbSettings.setting_value) {
      // Use database settings if available
      return {
        autoConfirmOmakase: dbSettings.setting_value.autoConfirmOmakase,
        autoConfirmDining: dbSettings.setting_value.autoConfirmDining
      }
    }
  } catch (error) {
    console.error('Error fetching auto-confirmation settings from database:', error)
  }

  // Fallback to environment variables
  return {
    autoConfirmOmakase: process.env.AUTO_CONFIRM_OMAKASE === 'true',
    autoConfirmDining: process.env.AUTO_CONFIRM_DINING === 'true'
  }
}

/**
 * Determine if a reservation type should be auto-confirmed
 */
export async function shouldAutoConfirm(reservationType: 'omakase' | 'dining'): Promise<boolean> {
  const settings = await getAutoConfirmationSettings()
  return reservationType === 'omakase' ? settings.autoConfirmOmakase : settings.autoConfirmDining
}

/**
 * Get the appropriate initial status for a reservation
 */
export async function getInitialReservationStatus(reservationType: 'omakase' | 'dining'): Promise<'confirmed' | 'pending'> {
  const autoConfirm = await shouldAutoConfirm(reservationType)
  return autoConfirm ? 'confirmed' : 'pending'
} 