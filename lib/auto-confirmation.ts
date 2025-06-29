export interface AutoConfirmationSettings {
  autoConfirmOmakase: boolean
  autoConfirmDining: boolean
}

/**
 * Get auto-confirmation settings from environment variables
 */
export async function getAutoConfirmationSettings(): Promise<AutoConfirmationSettings> {
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