import { createClient } from '@supabase/supabase-js'

// Supabase admin client for server-side operations only
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Helper function to get seat capacity settings from database with fallback
export async function getSeatCapacitySettings() {
  try {
    console.log('🔍 Fetching seat capacity settings from database...')
    
    // First, try to get settings from database
    const { data: dbSettings, error: dbError } = await supabaseAdmin
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'seat_capacity')
      .single()

    if (dbSettings && !dbError && dbSettings.setting_value) {
      // Check if using new time interval format
      if (dbSettings.setting_value.type === 'time_interval') {
        console.log('Using time interval capacity settings')
        return { 
          type: 'time_interval',
          data: dbSettings.setting_value,
          source: 'database' 
        }
      }
      // Legacy format support
      const omakaseSeats = dbSettings.setting_value.omakaseSeats
      const diningSeats = dbSettings.setting_value.diningSeats
      console.log('Loaded legacy seat capacity settings from database:', { omakaseSeats, diningSeats })
      return { omakaseSeats, diningSeats, source: 'database' }
    } else {
      // Fall back to environment variables if no database settings
      const omakaseSeats = parseInt(process.env.OMAKASE_SEATS || '12', 10)
      const diningSeats = parseInt(process.env.DINING_SEATS || '24', 10)
      console.log('Loaded seat capacity settings from environment:', { omakaseSeats, diningSeats })
      return { omakaseSeats, diningSeats, source: 'environment' }
    }
  } catch (error) {
    console.error('Error fetching seat capacity settings, using defaults:', error)
    // Return default settings on error
    return { omakaseSeats: 12, diningSeats: 24, source: 'default' }
  }
}

// Helper function to get capacity for a specific time
export function getCapacityForTime(capacitySettings: any, reservationType: 'omakase' | 'dining', timeStr: string): number {
  // If using time interval format
  if (capacitySettings.type === 'time_interval' && capacitySettings.data) {
    const intervals = capacitySettings.data[reservationType]?.intervals || []
    
    // If no intervals defined, return 0
    if (intervals.length === 0) {
      console.warn(`No time intervals defined for ${reservationType}`)
      return 0
    }
    
    // Convert time string to minutes for comparison
    const [hours, minutes] = timeStr.split(':').map(Number)
    const timeInMinutes = hours * 60 + minutes
    
    // Find the interval that contains this time
    for (const interval of intervals) {
      const [startHours, startMinutes] = interval.startTime.split(':').map(Number)
      const [endHours, endMinutes] = interval.endTime.split(':').map(Number)
      
      const startInMinutes = startHours * 60 + startMinutes
      let endInMinutes = endHours * 60 + endMinutes
      
      // Handle overnight intervals (e.g., 22:00 to 02:00)
      if (endInMinutes <= startInMinutes) {
        endInMinutes += 24 * 60
      }
      
      // Adjust time for overnight comparison
      let adjustedTimeInMinutes = timeInMinutes
      if (timeInMinutes < startInMinutes && endInMinutes > 24 * 60) {
        adjustedTimeInMinutes += 24 * 60
      }
      
      // Check if time falls within this interval
      if (adjustedTimeInMinutes >= startInMinutes && adjustedTimeInMinutes < endInMinutes) {
        return Math.max(0, interval.capacity || 0) // Ensure non-negative
      }
    }
    
    // No matching interval found, return 0
    console.log(`No interval found for ${reservationType} at ${timeStr}`)
    return 0
  }
  
  // Legacy format
  const capacity = reservationType === 'omakase' ? capacitySettings.omakaseSeats : capacitySettings.diningSeats
  return Math.max(0, capacity || 0) // Ensure non-negative
}

// Helper function to get enhanced closed dates from database
export async function getClosedDatesSettings() {
  try {
    console.log('🔍 Fetching enhanced closed dates from database...')
    
    // Try to get closed dates settings from database
    const { data: dbSettings, error: dbError } = await supabaseAdmin
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'closed_dates')
      .single()

    if (dbSettings && !dbError && dbSettings.setting_value) {
      // Use database settings if available
      const closedDates = dbSettings.setting_value.dates || []
      const closedWeekdays = dbSettings.setting_value.closedWeekdays || []
      const holidays = dbSettings.setting_value.holidays || []
      const shiftClosures = dbSettings.setting_value.shiftClosures || []
      console.log('Loaded enhanced closed dates from database:', { closedDates, closedWeekdays, holidaysCount: holidays.length, shiftClosuresCount: shiftClosures.length })
      return { closedDates, closedWeekdays, holidays, shiftClosures }
    } else {
      // No closed dates found, return empty arrays
      console.log('No closed dates found in database')
      return { closedDates: [], closedWeekdays: [], holidays: [], shiftClosures: [] }
    }
  } catch (error) {
    console.error('Error fetching closed dates, using empty arrays:', error)
    // Return empty arrays on error
    return { closedDates: [], closedWeekdays: [], holidays: [], shiftClosures: [] }
  }
}

// Helper function to check if a date is closed (backward compatibility)
export async function getClosedDates(): Promise<string[]> {
  const settings = await getClosedDatesSettings()
  return settings.closedDates
}

// Helper function to check if a date should be closed
export async function isDateClosed(dateStr: string): Promise<boolean> {
  const settings = await getClosedDatesSettings()
  const date = new Date(dateStr)
  const dayOfWeek = date.getDay()
  
  // Check specific closed dates
  if (settings.closedDates.includes(dateStr)) return true
  
  // Check weekly closures
  if (settings.closedWeekdays.includes(dayOfWeek)) return true
  
  // Check holidays
  if (settings.holidays.some((h: any) => h.date === dateStr && h.closed)) return true
  
  // Check shift closures for full day only
  if (settings.shiftClosures.some((sc: any) => sc.date === dateStr && sc.type === 'full_day')) return true
  
  return false
}

// Helper function to check if a specific shift is closed
export async function isShiftClosed(dateStr: string, shiftType: 'lunch' | 'dinner'): Promise<boolean> {
  const settings = await getClosedDatesSettings()
  
  // If the whole date is closed, the shift is also closed
  if (await isDateClosed(dateStr)) return true
  
  // Check shift-specific closures
  const shiftClosure = settings.shiftClosures.find((sc: any) => sc.date === dateStr)
  if (!shiftClosure) return false
  
  // Check if the specific shift is closed
  if (shiftType === 'lunch' && (shiftClosure.type === 'lunch_only' || shiftClosure.type === 'full_day')) return true
  if (shiftType === 'dinner' && (shiftClosure.type === 'dinner_only' || shiftClosure.type === 'full_day')) return true
  
  return false
}

// Get availability settings from database
export async function getAvailabilitySettings(): Promise<{
  omakaseAvailableDays: number[],
  diningAvailableDays: number[],
  diningAvailableShifts?: { [key: number]: ('lunch' | 'dinner')[] }
}> {
  try {
    console.log('🔍 Fetching availability settings from database...')
    
    const { data: dbSettings, error } = await supabaseAdmin
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'availability_settings')
      .single()

    if (error || !dbSettings?.setting_value) {
      console.log('No availability settings found, using defaults')
      return {
        omakaseAvailableDays: [4], // Default: Thursday only
        diningAvailableDays: [0, 1, 2, 3, 4, 5, 6] // Default: All days
      }
    }

    console.log('Loaded availability settings from database:', dbSettings.setting_value)
    return {
      omakaseAvailableDays: dbSettings.setting_value.omakaseAvailableDays || [4],
      diningAvailableDays: dbSettings.setting_value.diningAvailableDays || [0, 1, 2, 3, 4, 5, 6],
      diningAvailableShifts: dbSettings.setting_value.diningAvailableShifts || undefined
    }
  } catch (error) {
    console.error('Error fetching availability settings:', error)
    return {
      omakaseAvailableDays: [4], // Default: Thursday only
      diningAvailableDays: [0, 1, 2, 3, 4, 5, 6] // Default: All days
    }
  }
}

// Check if a reservation type is available on a specific date
export async function isReservationTypeAvailable(
  reservationType: 'omakase' | 'dining', 
  dateStr: string,
  timeStr?: string
): Promise<boolean> {
  try {
    const settings = await getAvailabilitySettings()
    const date = new Date(dateStr)
    const dayOfWeek = date.getDay()
    
    if (reservationType === 'omakase') {
      return settings.omakaseAvailableDays.includes(dayOfWeek)
    } else {
      // Check if dining is available on this day
      if (!settings.diningAvailableDays.includes(dayOfWeek)) {
        return false
      }
      
      // If we have shift settings and a time, check shift availability
      if (settings.diningAvailableShifts && timeStr) {
        const shifts = settings.diningAvailableShifts[dayOfWeek]
        if (!shifts || shifts.length === 0) {
          return false // No shifts available on this day
        }
        
        // Determine which shift based on time
        const hour = parseInt(timeStr.split(':')[0])
        const isLunchTime = hour < 15 // Before 3pm is lunch
        
        if (isLunchTime && !shifts.includes('lunch')) {
          return false // Lunch not available
        }
        if (!isLunchTime && !shifts.includes('dinner')) {
          return false // Dinner not available
        }
      }
      
      return true
    }
  } catch (error) {
    console.error('Error checking reservation type availability:', error)
    // Default to allow reservation on error
    return true
  }
}

 