'use client'

import { useEffect, useState, useRef } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addDays, getDay, startOfWeek, addMonths, subMonths } from 'date-fns'
import { supabase } from '../lib/supabase'
import { nanoid } from 'nanoid'
import { useToast } from '../hooks/use-toast'
import Image from 'next/image'
import TrendChart from '../components/TrendChart'
import { useRouter } from 'next/navigation'
import LoginForm from '../components/LoginForm'
import CommunicationHistoryModal from '../components/CommunicationHistoryModal'

interface Reservation {
  id: string
  confirmation_code: string
  customer_name: string
  customer_email: string
  customer_phone: string
  reservation_date: string
  reservation_time: string
  party_size: number
  special_requests?: string
  status: string
  created_at: string
  cancellation_reason?: string
  notes?: string
  type: 'omakase' | 'dining'
  duration_minutes?: number
  // Payment fields for omakase
  payment_status?: string
  prepayment_amount?: number
  prepayment_base_price?: number
  prepayment_tax_amount?: number
  prepaid_at?: string
  stripe_charge_id?: string
  cancellation_refund_percentage?: number
  // Payment fields for dining
  payment_method_saved?: boolean
  no_show_fee_charged?: boolean
  no_show_fee_amount?: number
  no_show_fee_charged_at?: string
  stripe_customer_id?: string
}

interface EditReservation {
  id: string
  customer_name: string
  customer_email: string
  customer_phone: string
  reservation_date: string
  reservation_time: string
  party_size: number
  special_requests: string
  notes: string
  type: 'omakase' | 'dining' // Added to support dynamic time slots
}

interface NewReservation {
  customer_name: string
  customer_email: string
  customer_phone: string
  reservation_date: string
  reservation_time: string
  party_size: number
  type: 'omakase' | 'dining'
  special_requests: string
  notes: string
}

// Use environment variable for admin password (for demo only; real apps should use server-side auth)
const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;

  // Note: These labels will be dynamically translated using the t function
const RESERVATION_STATUSES = [
  { value: 'pending', labelKey: 'pending', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'confirmed', labelKey: 'confirmed', color: 'bg-green-100 text-green-800' },
  { value: 'seated', labelKey: 'seated', color: 'bg-blue-100 text-blue-800' },
  { value: 'completed', labelKey: 'completed', color: 'bg-purple-100 text-purple-800' },
  { value: 'cancelled', labelKey: 'cancelled', color: 'bg-red-100 text-red-800' },
  { value: 'no-show', labelKey: 'noShow', color: 'bg-gray-100 text-gray-800' }
]

const CANCELLATION_REASONS = [
  'Customer requested',
  'Restaurant unavailable',
  'No show',
  'Duplicate booking',
  'Weather/emergency',
  'Other'
]

// Time slots are now generated dynamically based on reservation type and party size

export default function AdminDashboard() {
  const router = useRouter()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [userRole, setUserRole] = useState<'admin' | 'reservations' | null>(null)
  const [username, setUsername] = useState<string>('')
  const [showLogin, setShowLogin] = useState(false)
  const [loginError, setLoginError] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [days, setDays] = useState<Date[]>([]);
  const [currentViewMonth, setCurrentViewMonth] = useState<Date>(new Date());
  const [calendarReservations, setCalendarReservations] = useState<{ [date: string]: Reservation[] }>({});
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showCancelled, setShowCancelled] = useState(false)
  const [showPending, setShowPending] = useState(false)
  const [editingReservation, setEditingReservation] = useState<EditReservation | null>(null)
  const [showNewReservationForm, setShowNewReservationForm] = useState(false)
  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const [newReservation, setNewReservation] = useState<NewReservation>({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    reservation_date: '',
    reservation_time: '17:00',
    party_size: 2,
    type: 'omakase',
    special_requests: '',
    notes: ''
  })
  const [stats, setStats] = useState({
    todayReservations: 0,
    weekReservations: 0,
    totalRevenue: 0,
    avgPartySize: 0,
    // Trend data: [previous, current, next]
    dailyTrend: [0, 0, 0], // yesterday, today, tomorrow
    weeklyTrend: [0, 0, 0], // last week, this week, next week  
    revenueTrend: [0, 0, 0], // last week revenue, this week, projected next week
    partySizeTrend: [0, 0, 0] // last week avg, this week, projected next week
  })
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState({
    autoConfirmOmakase: false, // Will be loaded from server
    autoConfirmDining: true   // Default recommendation: auto-confirm dining
  })
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  
  // Seat capacity settings
  const [seatCapacity, setSeatCapacity] = useState({
    omakaseCapacity: 12, // Default omakase capacity
    diningCapacity: 40   // Default dining capacity
  })
  const [capacityLoaded, setCapacityLoaded] = useState(false)
  
  // Closed dates settings
  const [closedDates, setClosedDates] = useState<string[]>([])
  const [closedDatesLoaded, setClosedDatesLoaded] = useState(false)
  const [newClosedDate, setNewClosedDate] = useState('')
  const [closedWeekdays, setClosedWeekdays] = useState<number[]>([]) // 0=Sunday, 1=Monday, etc.
  const [holidays, setHolidays] = useState<{date: string, name: string, closed: boolean}[]>([])
  const [shiftClosures, setShiftClosures] = useState<{date: string, type: 'full_day' | 'lunch_only' | 'dinner_only'}[]>([])
  const [newShiftClosure, setNewShiftClosure] = useState({ date: '', type: 'full_day' as 'full_day' | 'lunch_only' | 'dinner_only' })
  
  // Availability settings (using getDay() values: 0=Sunday, 1=Monday, etc.)
  const [availabilitySettings, setAvailabilitySettings] = useState({
    omakaseAvailableDays: [4], // Default: Thursday only (4 = Thursday in getDay() values)
    diningAvailableDays: [0, 1, 2, 3, 4, 5, 6], // Default: All days (Sunday-Saturday)
    diningAvailableShifts: {
      0: ['lunch', 'dinner'] as ('lunch' | 'dinner')[],
      1: ['lunch', 'dinner'] as ('lunch' | 'dinner')[],
      2: ['lunch', 'dinner'] as ('lunch' | 'dinner')[],
      3: ['lunch', 'dinner'] as ('lunch' | 'dinner')[],
      4: ['lunch', 'dinner'] as ('lunch' | 'dinner')[],
      5: ['lunch', 'dinner'] as ('lunch' | 'dinner')[],
      6: ['lunch', 'dinner'] as ('lunch' | 'dinner')[]
    }
  })
  const [availabilityLoaded, setAvailabilityLoaded] = useState(false)
  
  // Business hours settings
  const [businessHours, setBusinessHours] = useState({
    lunch: {
      openTime: '12:00',    // 12:00 PM (noon)
      closeTime: '15:00',   // 3:00 PM (last seating 2:30 PM)
    },
    dinner: {
      openTime: '17:00',    // 5:00 PM
      closeTime: '22:00',   // 10:00 PM
    },
    slotDuration: 30        // 30 minutes between slots
  })
  const [businessHoursLoaded, setBusinessHoursLoaded] = useState(false)
  
  // Settings save loading states
  const [savingAutoConfirm, setSavingAutoConfirm] = useState(false)
  const [savingCapacity, setSavingCapacity] = useState(false)
  const [savingAvailability, setSavingAvailability] = useState(false)
  
  // Settings section collapse states
  const [expandedSections, setExpandedSections] = useState({
    language: false,
    autoConfirmation: false,
    seatCapacity: false,
    availability: false,
    closedDates: false
  })
  const [language, setLanguage] = useState<'en' | 'zh'>('en')

  // Settings modal ref for click outside detection
  const settingsModalRef = useRef<HTMLDivElement>(null)
  
  // Mobile menu state
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  
  // Refund modal state
  const [showRefundModal, setShowRefundModal] = useState(false)
  const [refundingReservation, setRefundingReservation] = useState<Reservation | null>(null)
  const [refundType, setRefundType] = useState<'full' | 'partial'>('full')
  const [refundPercentage, setRefundPercentage] = useState(100)
  const [refundReason, setRefundReason] = useState('')
  const [processingRefund, setProcessingRefund] = useState(false)
  
  // Cancellation modal state
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancellingReservation, setCancellingReservation] = useState<Reservation | null>(null)
  const [cancellationReason, setCancellationReason] = useState('')
  const [processingCancellation, setProcessingCancellation] = useState(false)
  
  // Communication history modal state
  const [showCommunicationModal, setShowCommunicationModal] = useState(false)
  const [communicationReservation, setCommunicationReservation] = useState<Reservation | null>(null)
  
  // Dining no-show charge modal state
  const [showDiningChargeModal, setShowDiningChargeModal] = useState(false)
  const [chargingReservation, setChargingReservation] = useState<Reservation | null>(null)
  const [processingDiningCharge, setProcessingDiningCharge] = useState(false)
  
  // Dining refund modal state
  const [showDiningRefundModal, setShowDiningRefundModal] = useState(false)
  const [refundingDiningReservation, setRefundingDiningReservation] = useState<Reservation | null>(null)
  const [diningRefundReason, setDiningRefundReason] = useState('')
  const [processingDiningRefund, setProcessingDiningRefund] = useState(false)

  // Helper function to parse dates in local timezone (fixes UTC/timezone bugs)
  const parseLocalDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day) // month is 0-indexed
  }

  // Load language preference from localStorage on mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem('toohot-language') as 'en' | 'zh'
    if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'zh')) {
      setLanguage(savedLanguage)
    }
  }, [])

  // Handle click outside settings modal and mobile menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showSettings && settingsModalRef.current && !settingsModalRef.current.contains(event.target as Node)) {
        setShowSettings(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSettings])

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (showMobileMenu && !target.closest('header')) {
        setShowMobileMenu(false)
      }
    }

    if (showMobileMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showMobileMenu])

  // Save language preference to localStorage when changed
  const handleLanguageChange = (newLanguage: 'en' | 'zh') => {
    setLanguage(newLanguage)
    localStorage.setItem('toohot-language', newLanguage)
  }

  // Reset time selection when reservation type or party size changes
  useEffect(() => {
    if (showNewReservationForm) {
      const availableSlots = generateTimeSlots(newReservation.type, newReservation.party_size)
      if (!availableSlots.includes(newReservation.reservation_time)) {
        // If current time is not available, select the first available slot
        setNewReservation(prev => ({
          ...prev,
          reservation_time: availableSlots[0] || '17:00'
        }))
      }
    }
  }, [newReservation.type, newReservation.party_size, showNewReservationForm]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  // Generate time slots based on reservation type and party size
  const generateTimeSlots = (reservationType: 'omakase' | 'dining', partySize: number = 2) => {
    // Omakase uses fixed time slots
    if (reservationType === 'omakase') {
      return ['17:00', '19:00']
    }
    
    // Dining uses business hours with dynamic calculation for both lunch and dinner
    const slots: string[] = []
    
    // Calculate dining duration based on party size
    const diningDurationMinutes = partySize <= 4 ? 60 : 90 // 1 hour for ≤4, 1.5 hours for ≥5
    
    // Generate slots for both lunch and dinner periods
    const periods = [businessHours.lunch, businessHours.dinner]
    
    periods.forEach(period => {
      // Parse business hours for this period
      const [openHour, openMin] = period.openTime.split(':').map(Number)
      const [closeHour, closeMin] = period.closeTime.split(':').map(Number)
      
      const openTimeMinutes = openHour * 60 + openMin
      const closeTimeMinutes = closeHour * 60 + closeMin
      
      // Last seating is 30 minutes before closing, but also consider dining duration
      const bufferMinutes = Math.max(30, diningDurationMinutes) // Ensure guests have enough time
      const lastSeatingMinutes = closeTimeMinutes - bufferMinutes
      
      // Generate slots every 30 minutes from open to last seating
      for (let minutes = openTimeMinutes; minutes <= lastSeatingMinutes; minutes += businessHours.slotDuration) {
        const hours = Math.floor(minutes / 60)
        const mins = minutes % 60
        const timeString = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
        slots.push(timeString)
      }
    })
    
    return slots.sort() // Sort chronologically
  }

  // Get available time slots for current reservation form
  const getAvailableTimeSlots = () => {
    if (showNewReservationForm) {
      return generateTimeSlots(newReservation.type, newReservation.party_size)
    } else if (editingReservation) {
      return generateTimeSlots(editingReservation.type, editingReservation.party_size)
    }
    return ['17:00', '19:00'] // Default fallback
  }

  // Generate holidays for current year (only future holidays)
  const generateHolidays = (year: number) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const holidays = [
      // US Federal Holidays
      { date: `${year}-01-01`, name: "New Year's Day" },
      { date: getMLKDay(year), name: "Martin Luther King Jr. Day" },
      { date: getPresidentsDay(year), name: "Presidents Day" },
      { date: getEaster(year), name: "Easter Sunday" },
      { date: getMothersDay(year), name: "Mother's Day" },
      { date: getMemorialDay(year), name: "Memorial Day" },
      { date: getFathersDay(year), name: "Father's Day" },
      { date: `${year}-07-04`, name: "Independence Day" },
      { date: getLaborDay(year), name: "Labor Day" },
      { date: getColumbusDay(year), name: "Columbus Day" },
      { date: `${year}-10-31`, name: "Halloween" },
      { date: `${year}-11-11`, name: "Veterans Day" },
      { date: getThanksgiving(year), name: "Thanksgiving" },
      { date: `${year}-12-25`, name: "Christmas Day" },
      
      // Chinese Holidays
      { date: getChineseNewYear(year), name: "Chinese New Year (Spring Festival)" },
    ]
    
    // Filter out past holidays and sort chronologically
    const futureHolidays = holidays
      .filter(h => new Date(h.date) >= today)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    
    return futureHolidays.map(h => ({ ...h, closed: false }))
  }

  // Helper functions for calculating holiday dates
  const getMLKDay = (year: number) => {
    // Third Monday in January
    const jan1 = new Date(year, 0, 1)
    const firstMonday = new Date(year, 0, 1 + (8 - jan1.getDay()) % 7)
    const thirdMonday = new Date(firstMonday.getTime() + 14 * 24 * 60 * 60 * 1000)
    return thirdMonday.toISOString().split('T')[0]
  }

  const getPresidentsDay = (year: number) => {
    // Third Monday in February
    const feb1 = new Date(year, 1, 1)
    const firstMonday = new Date(year, 1, 1 + (8 - feb1.getDay()) % 7)
    const thirdMonday = new Date(firstMonday.getTime() + 14 * 24 * 60 * 60 * 1000)
    return thirdMonday.toISOString().split('T')[0]
  }

  const getMemorialDay = (year: number) => {
    // Last Monday in May
    const may31 = new Date(year, 4, 31)
    const lastMonday = new Date(year, 4, 31 - (may31.getDay() + 6) % 7)
    return lastMonday.toISOString().split('T')[0]
  }

  const getLaborDay = (year: number) => {
    // First Monday in September
    const sep1 = new Date(year, 8, 1)
    const firstMonday = new Date(year, 8, 1 + (8 - sep1.getDay()) % 7)
    return firstMonday.toISOString().split('T')[0]
  }

  const getColumbusDay = (year: number) => {
    // Second Monday in October
    const oct1 = new Date(year, 9, 1)
    const firstMonday = new Date(year, 9, 1 + (8 - oct1.getDay()) % 7)
    const secondMonday = new Date(firstMonday.getTime() + 7 * 24 * 60 * 60 * 1000)
    return secondMonday.toISOString().split('T')[0]
  }

  const getThanksgiving = (year: number) => {
    // Fourth Thursday in November
    const nov1 = new Date(year, 10, 1)
    const firstThursday = new Date(year, 10, 1 + (11 - nov1.getDay()) % 7)
    const fourthThursday = new Date(firstThursday.getTime() + 21 * 24 * 60 * 60 * 1000)
    return fourthThursday.toISOString().split('T')[0]
  }

  const getEaster = (year: number) => {
    // Easter calculation (simplified)
    const a = year % 19
    const b = Math.floor(year / 100)
    const c = year % 100
    const d = Math.floor(b / 4)
    const e = b % 4
    const f = Math.floor((b + 8) / 25)
    const g = Math.floor((b - f + 1) / 3)
    const h = (19 * a + b - d - g + 15) % 30
    const i = Math.floor(c / 4)
    const k = c % 4
    const l = (32 + 2 * e + 2 * i - h - k) % 7
    const m = Math.floor((a + 11 * h + 22 * l) / 451)
    const month = Math.floor((h + l - 7 * m + 114) / 31)
    const day = ((h + l - 7 * m + 114) % 31) + 1
    return new Date(year, month - 1, day).toISOString().split('T')[0]
  }

  const getMothersDay = (year: number) => {
    // Second Sunday in May
    const may1 = new Date(year, 4, 1)
    const firstSunday = new Date(year, 4, 1 + (7 - may1.getDay()) % 7)
    const secondSunday = new Date(firstSunday.getTime() + 7 * 24 * 60 * 60 * 1000)
    return secondSunday.toISOString().split('T')[0]
  }

  const getFathersDay = (year: number) => {
    // Third Sunday in June
    const jun1 = new Date(year, 5, 1)
    const firstSunday = new Date(year, 5, 1 + (7 - jun1.getDay()) % 7)
    const thirdSunday = new Date(firstSunday.getTime() + 14 * 24 * 60 * 60 * 1000)
    return thirdSunday.toISOString().split('T')[0]
  }

  const getChineseNewYear = (year: number) => {
    // Simplified Chinese New Year dates (actual dates vary)
    const chineseNewYearDates: { [key: number]: string } = {
      2024: '2024-02-10',
      2025: '2025-01-29',
      2026: '2026-02-17',
      2027: '2027-02-06',
      2028: '2028-01-26',
      2029: '2029-02-13',
      2030: '2030-02-03'
    }
    return chineseNewYearDates[year] || `${year}-02-01`
  }

  // Calendar navigation functions
  const goToPreviousMonth = () => {
    const newMonth = subMonths(currentViewMonth, 1);
    // Allow viewing up to 6 months back for historical data
    const earliestAllowed = subMonths(new Date(), 6);
    if (newMonth >= startOfMonth(earliestAllowed)) {
      setCurrentViewMonth(newMonth);
    }
  };

  const goToNextMonth = () => {
    const newMonth = addMonths(currentViewMonth, 1);
    // Allow viewing up to 6 months ahead for planning purposes
    const latestAllowed = addMonths(new Date(), 6);
    if (newMonth <= startOfMonth(latestAllowed)) {
      setCurrentViewMonth(newMonth);
    }
  };

  const goToToday = () => {
    setCurrentViewMonth(new Date());
  };

  // Check if a date should be closed (specific date, weekday, or holiday)
  const isDateClosed = (dateStr: string) => {
    // Fix timezone issue: parse date in local timezone instead of UTC
    const date = parseLocalDate(dateStr)
    const jsWeekday = date.getDay() // JavaScript weekday (0=Sunday, 1=Monday, etc.)
    
    // Check specific closed dates FIRST
    if (closedDates.includes(dateStr)) {
      return true
    }
    
    // Check weekly closures (using getDay() values: 0=Sunday, 1=Monday, etc.)
    if (closedWeekdays.includes(jsWeekday)) {
      return true
    }
    
    // Check holidays
    if (holidays.some(h => h.date === dateStr && h.closed)) {
      return true
    }
    
    return false
  }

  // Comprehensive Translation system
  const translations = {
    en: {
      // Header & Navigation
      toohotAdmin: "TooHot Admin",
      reservationManagementDashboard: "Reservation Management Dashboard",
      newReservation: "New Reservation",
      emailTemplates: "Email Templates",
      customerCRM: "Customer CRM",
      analytics: "Analytics",
      settings: "Settings",
      logout: "Logout",
      loadingDashboard: "Loading dashboard...",
      
      // Calendar & Overview
      daysOverview: "Calendar Overview",
      calendarConfirmed: "Confirmed",
      actionRequired: "Action Required",
      calendarToday: "Today",
      selectDateToView: "Select a date to view reservations",
      noReservationsForDate: "No reservations for this date",
      
      // Search & Filters
      searchAllReservations: "Search all reservations...",
      allStatuses: "All Statuses",
      showCancelled: "Show Cancelled",
      showPending: "Show Pending",
      searchResults: "Search Results",
      
      // Reservation Types
      omakaseType: "Omakase",
      diningType: "Dining",
      
      // Reservation Actions
      confirm: "Confirm",
      edit: "Edit",
      cancelAction: "Cancel",
      communicationHistory: "Communication History",
      viewCommunications: "View Communications",
      
      // Status Labels
      pending: "Pending",
      confirmed: "Confirmed",
      seated: "Seated",
      completed: "Completed",
      cancelled: "Cancelled",
      noShow: "No Show",
      
      // Reservation Details
      email: "Email",
      phone: "Phone",
      confirmation: "Confirmation",
      revenue: "Revenue",
      created: "Created",
      specialRequests: "Special Requests",
      internalNotes: "Internal Notes",
      cancellationReason: "Cancellation Reason",
      specialRequest: "Special Request",
      
      // Statistics Dashboard
      reservationStatistics: "Reservation Statistics",
      todayReservations: "Today's Reservations",
      weekReservations: "This Week",
      totalRevenue: "Total Revenue",
      avgPartySize: "Avg Party Size",
      systemStatus: "System Status",
      database: "Database",
      emailService: "Email Service",
      apiStatus: "API Status",
      connected: "Connected",
      active: "Active",
      healthy: "Healthy",
      
      // Trends
      daily: "Daily",
      weekly: "Weekly",
      
      // Forms - New Reservation
      createNewReservation: "Create New Reservation",
      reservationType: "Reservation Type",
      omakaseReservations: "Omakase Reservations",
      omakaseDesc: "$99/person • 11-course tasting menu",
      diningReservations: "À la Carte Dining",
      diningDesc: "Flexible pricing • Menu selection",
      customerName: "Customer Name",
      customerEmail: "Customer Email", 
      customerPhone: "Customer Phone",
      reservationDate: "Reservation Date",
      reservationTime: "Reservation Time",
      partySize: "Party Size",
      specialRequestsLabel: "Special Requests",
      internalNotesLabel: "Internal Notes",
      createReservation: "Create Reservation",
      
      // Forms - Edit Reservation
      editReservation: "Edit Reservation",
      saveChanges: "Save Changes",
      
      // Settings Modal
      reservationSettings: "Reservation Settings",
      autoConfirmationSettings: "Auto-Confirmation Settings",
      autoConfirmDescription: "Choose which reservation types should be automatically confirmed without manual approval. Auto-confirmed reservations will immediately send confirmation emails to customers.",
      autoConfirmed: "✅ Automatically confirmed - no manual approval needed",
      requiresConfirmation: "⏳ Requires manual confirmation - will remain pending until approved",
      language: "Language",
      languageDesc: "Choose your preferred language for the admin interface",
      english: "English",
      chinese: "中文",
      loadingSettings: "Loading current settings...",
      saveSettings: "Save Settings",
      
      // Seat Capacity Settings
      seatCapacitySettings: "Seat Capacity Settings",
      seatCapacityDescription: "Configure the maximum number of seats available for each reservation type. This controls how many guests can be accommodated at any given time slot.",
      omakaseCapacityLabel: "Omakase Maximum Seats",
      diningCapacityLabel: "À la Carte Maximum Seats",
      capacityHelpText: "Seats (1-200)",
      loadingCapacitySettings: "Loading seat capacity settings...",
      
      // Availability Settings
      availabilitySettings: "Reservation Type Availability",
      availabilityDescription: "Configure which days of the week each reservation type is available. This controls when customers can book omakase vs dining reservations.",
      omakaseAvailabilityLabel: "Omakase Available Days",
      diningAvailabilityLabel: "À la Carte Available Days",
      diningShiftLabel: "Available Shifts",
      lunchShift: "Lunch",
      dinnerShift: "Dinner",
      noShiftsWarning: "At least one shift must be selected",
      availabilityHelpText: "Select the days when this reservation type is available",
      loadingAvailabilitySettings: "Loading availability settings...",
      availabilityNote: "Note: Customers can only book the selected reservation type on the enabled days",
      
      // Closed Dates Settings
      closedDatesSettings: "Closed Dates Management",
      closedDatesDescription: "Manually close specific dates, recurring weekdays, or holidays for reservations. Holiday management works for the current year only.",
      closedDatesLabel: "Specific Closed Dates",
      addClosedDate: "Add Date",
      removeClosedDate: "Remove",
      noClosedDates: "No dates are currently closed",
      loadingClosedDates: "Loading closed dates...",
      closedDatePlaceholder: "Select a date to close",
      
      // Shift-based closures
      shiftClosuresLabel: "Shift-Based Closures",
      shiftClosuresDesc: "Close specific shifts (lunch or dinner) on certain dates",
      addShiftClosure: "Add Shift Closure",
      shiftType: "Shift Type",
      fullDay: "Full Day",
      lunchOnly: "Lunch Only",
      dinnerOnly: "Dinner Only",
      noShiftClosures: "No shift-based closures set",
      
      // Weekly Closures
      weeklyClosuresLabel: "Weekly Closures",
      weeklyClosuresDesc: "Close specific days of the week (e.g., all Tuesdays)",
      noWeeklyClosures: "No weekly closures set",
      
      // Holidays
      holidaysLabel: "Holiday Management",
      holidaysDesc: "Quick toggle for common holidays (US + Chinese Spring Festival)",
      toggleAllHolidays: "Toggle All",
      
      // Weekday names
      weekdays: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      
      // Messages & Notifications
      loading: "Loading...",
      settingsSavedTitle: "Settings Saved Successfully! 🌐",
      settingsSavedDesc: "Auto-confirmation now controls ALL reservation sources",
      settingsFailedTitle: "Failed to Save Settings ❌",
      settingsFailedDesc: "Network error - please try again",
      contactRequired: "⚠️ Please provide either an email address or phone number",
      contactProvided: "✅ Contact information provided:",
      emailOrPhoneRequired: "(Email or Phone required)",
      reservationCreatedTitle: "Reservation Created Successfully! 🎉",
      reservationUpdatedTitle: "Reservation Updated Successfully! ✨",
      reservationCancelledTitle: "Reservation Cancelled 📅",
      statusUpdatedTitle: "Status Updated Successfully! ✅",
      errorTitle: "Error",
      
      // Cancellation Reasons
      customerRequested: "Customer requested",
      restaurantUnavailable: "Restaurant unavailable", 
      noShowReason: "No show",
      duplicateBooking: "Duplicate booking",
      weatherEmergency: "Weather/emergency",
      otherReason: "Other",
      
      // Prompts
      cancelReservationPrompt: "Please provide a reason for cancellation:",
      commonReasons: "Common reasons:",
      
      // Day names
      monday: "Mon",
      tuesday: "Tue", 
      wednesday: "Wed",
      thursday: "Thu",
      friday: "Fri",
      saturday: "Sat",
      sunday: "Sun",
      
      // Payment fields
      paymentStatus: "Payment Status",
      paymentAmount: "Payment Amount",
      paymentDate: "Payment Date",
      refundAmount: "Refund Amount",
      refundButton: "Process Refund",
      refundHistory: "Refund History",
      unpaid: "Unpaid",
      paid: "Paid",
      refunded: "Refunded",
      partiallyRefunded: "Partially Refunded",
      failed: "Failed",
      refundModalTitle: "Process Refund",
      refundTypeLabel: "Refund Type",
      fullRefund: "Full Refund",
      partialRefund: "Partial Refund",
      refundPercentageLabel: "Refund Percentage",
      refundReasonLabel: "Refund Reason",
      processingRefund: "Processing refund...",
      refundSuccessTitle: "Refund Processed Successfully! 💸",
      refundSuccessDesc: "The customer will receive their refund within 5-10 business days",
      refundFailedTitle: "Refund Failed ❌",
      refundFailedDesc: "Please check the payment details and try again",
      
      // Cancellation Modal
      cancelModalTitle: "Confirm Cancellation",
      cancelModalWarning: "Warning: This action cannot be undone",
      refundPolicyTitle: "Refund Policy",
      automaticRefundNote: "Automatic refund will be processed based on policy:",
      hoursBeforeReservation: "Hours before reservation",
      refundPercentageText: "refund",
      noRefundWarning: "No refund will be issued (less than 24 hours notice)",
      selectCancellationReason: "Select cancellation reason",
      processingCancellation: "Processing cancellation...",
      confirmCancel: "Confirm Cancellation",
      cancelButton: "Cancel"
    },
    zh: {
      // Header & Navigation
      toohotAdmin: "TooHot 管理后台",
      reservationManagementDashboard: "预订管理仪表板",
      newReservation: "新建预订",
      emailTemplates: "邮件模板",
      customerCRM: "客户管理",
      analytics: "数据分析",
      settings: "设置",
      logout: "退出登录",
      loadingDashboard: "正在加载仪表板...",
      
      // Calendar & Overview
      daysOverview: "日历概览",
      calendarConfirmed: "已确认",
      actionRequired: "需要操作",
      calendarToday: "今天",
      selectDateToView: "选择日期查看预订",
      noReservationsForDate: "此日期无预订",
      
      // Search & Filters
      searchAllReservations: "搜索所有预订...",
      allStatuses: "所有状态",
      showCancelled: "显示已取消",
      showPending: "显示待定",
      searchResults: "搜索结果",
      
      // Reservation Types
      omakaseType: "无菜单料理",
      diningType: "单点餐饮",
      
      // Reservation Actions
      confirm: "确认",
      edit: "编辑",
      cancelAction: "取消",
      communicationHistory: "通信历史",
      viewCommunications: "查看通信记录",
      
      // Status Labels
      pending: "待确认",
      confirmed: "已确认",
      seated: "已入座",
      completed: "已完成",
      cancelled: "已取消",
      noShow: "未出现",
      
      // Reservation Details
      email: "邮箱",
      phone: "电话",
      confirmation: "确认码",
      revenue: "收入",
      created: "创建时间",
      specialRequests: "特殊要求",
      internalNotes: "内部备注",
      cancellationReason: "取消原因",
      specialRequest: "特殊要求",
      
      // Statistics Dashboard
      reservationStatistics: "预订统计",
      todayReservations: "今日预订",
      weekReservations: "本周预订",
      totalRevenue: "总收入",
      avgPartySize: "平均聚会人数",
      systemStatus: "系统状态",
      database: "数据库",
      emailService: "邮件服务",
      apiStatus: "API状态",
      connected: "已连接",
      active: "活跃",
      healthy: "健康",
      
      // Trends
      daily: "每日",
      weekly: "每周",
      
      // Forms - New Reservation
      createNewReservation: "创建新预订",
      reservationType: "预订类型",
      omakaseReservations: "无菜单料理预订",
      omakaseDesc: "99美元/人 • 11道菜品尝套餐",
      diningReservations: "单点餐饮预订",
      diningDesc: "灵活定价 • 菜单选择",
      customerName: "客户姓名",
      customerEmail: "客户邮箱",
      customerPhone: "客户电话",
      reservationDate: "预订日期",
      reservationTime: "预订时间",
      partySize: "聚会人数",
      specialRequestsLabel: "特殊要求",
      internalNotesLabel: "内部备注",
      createReservation: "创建预订",
      
      // Forms - Edit Reservation
      editReservation: "编辑预订",
      saveChanges: "保存更改",
      
      // Settings Modal
      reservationSettings: "预订设置",
      autoConfirmationSettings: "自动确认设置",
      autoConfirmDescription: "选择哪些预订类型应该自动确认而无需手动批准。自动确认的预订将立即向客户发送确认邮件。",
      autoConfirmed: "✅ 自动确认 - 无需手动批准",
      requiresConfirmation: "⏳ 需要手动确认 - 将保持待定状态直到批准",
      language: "语言",
      languageDesc: "选择管理界面的首选语言",
      english: "English",
      chinese: "中文",
      loadingSettings: "正在加载当前设置...",
      saveSettings: "保存设置",
      
      // Seat Capacity Settings
      seatCapacitySettings: "座位容量设置",
      seatCapacityDescription: "配置每种预订类型的最大可用座位数。这控制在任何给定时间段可以容纳多少客人。",
      omakaseCapacityLabel: "无菜单料理最大座位数",
      diningCapacityLabel: "单点餐饮最大座位数",
      capacityHelpText: "座位数 (1-200)",
      loadingCapacitySettings: "正在加载座位容量设置...",
      
      // Availability Settings
      availabilitySettings: "预订类型可用性",
      availabilityDescription: "配置每种预订类型在一周中哪些天可用。这控制客户何时可以预订无菜单料理或单点餐饮。",
      omakaseAvailabilityLabel: "无菜单料理可用天数",
      diningAvailabilityLabel: "单点餐饮可用天数",
      diningShiftLabel: "可用班次",
      lunchShift: "午餐",
      dinnerShift: "晚餐",
      noShiftsWarning: "至少必须选择一个班次",
      availabilityHelpText: "选择此预订类型可用的天数",
      loadingAvailabilitySettings: "正在加载可用性设置...",
      availabilityNote: "注意：客户只能在启用的天数预订所选的预订类型",
      
      // Closed Dates Settings
      closedDatesSettings: "关闭日期管理",
      closedDatesDescription: "手动关闭特定日期、每周重复日期或节假日的预订。节假日管理仅适用于当前年份。",
      closedDatesLabel: "特定关闭日期",
      addClosedDate: "添加日期",
      removeClosedDate: "移除",
      noClosedDates: "目前没有关闭的日期",
      loadingClosedDates: "正在加载关闭日期...",
      closedDatePlaceholder: "选择要关闭的日期",
      
      // Shift-based closures
      shiftClosuresLabel: "班次关闭",
      shiftClosuresDesc: "关闭特定日期的特定班次（午餐或晚餐）",
      addShiftClosure: "添加班次关闭",
      shiftType: "班次类型",
      fullDay: "全天",
      lunchOnly: "仅午餐",
      dinnerOnly: "仅晚餐",
      noShiftClosures: "未设置班次关闭",
      
      // Weekly Closures
      weeklyClosuresLabel: "每周关闭",
      weeklyClosuresDesc: "关闭特定的星期几（例如，所有周二）",
      noWeeklyClosures: "未设置每周关闭",
      
      // Holidays
      holidaysLabel: "节假日管理",
      holidaysDesc: "快速切换常见节假日（美国节日 + 中国春节）",
      toggleAllHolidays: "全部切换",
      
      // Weekday names
      weekdays: ["周日", "周一", "周二", "周三", "周四", "周五", "周六"],
      
      // Messages & Notifications
      loading: "加载中...",
      settingsSavedTitle: "设置保存成功！🌐",
      settingsSavedDesc: "自动确认现在控制所有预订来源",
      settingsFailedTitle: "保存设置失败 ❌",
      settingsFailedDesc: "网络错误 - 请重试",
      contactRequired: "⚠️ 请提供邮箱地址或电话号码",
      contactProvided: "✅ 已提供联系方式：",
      emailOrPhoneRequired: "(邮箱或电话必填其一)",
      reservationCreatedTitle: "预订创建成功！🎉",
      reservationUpdatedTitle: "预订更新成功！✨",
      reservationCancelledTitle: "预订已取消 📅",
      statusUpdatedTitle: "状态更新成功！✅",
      errorTitle: "错误",
      
      // Cancellation Reasons
      customerRequested: "客户要求",
      restaurantUnavailable: "餐厅不可用",
      noShowReason: "未出现",
      duplicateBooking: "重复预订",
      weatherEmergency: "天气/紧急情况",
      otherReason: "其他",
      
      // Prompts
      cancelReservationPrompt: "请提供取消原因：",
      commonReasons: "常见原因：",
      
      // Day names
      monday: "周一",
      tuesday: "周二",
      wednesday: "周三", 
      thursday: "周四",
      friday: "周五",
      saturday: "周六",
      sunday: "周日",
      
      // Payment fields
      paymentStatus: "支付状态",
      paymentAmount: "支付金额",
      paymentDate: "支付日期",
      refundAmount: "退款金额",
      refundButton: "处理退款",
      refundHistory: "退款历史",
      unpaid: "未支付",
      paid: "已支付",
      refunded: "已退款",
      partiallyRefunded: "部分退款",
      failed: "失败",
      refundModalTitle: "处理退款",
      refundTypeLabel: "退款类型",
      fullRefund: "全额退款",
      partialRefund: "部分退款",
      refundPercentageLabel: "退款百分比",
      refundReasonLabel: "退款原因",
      processingRefund: "正在处理退款...",
      refundSuccessTitle: "退款处理成功！💸",
      refundSuccessDesc: "客户将在5-10个工作日内收到退款",
      refundFailedTitle: "退款失败 ❌",
      refundFailedDesc: "请检查支付详情并重试",
      
      // Cancellation Modal
      cancelModalTitle: "确认取消",
      cancelModalWarning: "警告：此操作无法撤销",
      refundPolicyTitle: "退款政策",
      automaticRefundNote: "将根据政策自动处理退款：",
      hoursBeforeReservation: "预订前小时数",
      refundPercentageText: "退款",
      noRefundWarning: "不会退款（少于24小时通知）",
      selectCancellationReason: "选择取消原因",
      processingCancellation: "正在处理取消...",
      confirmCancel: "确认取消",
      cancelButton: "取消"
    }
  }

  const t = translations[language]

  // Helper function to get translated status label
  const getStatusLabel = (statusValue: string) => {
    const status = RESERVATION_STATUSES.find(s => s.value === statusValue)
    return status ? t[status.labelKey as keyof typeof t] : statusValue
  }

  const { toast } = useToast();

  // Role-based authentication check
  useEffect(() => {
    const isAuthenticated = localStorage.getItem('admin-authenticated')
    const storedRole = localStorage.getItem('user-role') as 'admin' | 'reservations' | null
    const storedUsername = localStorage.getItem('username')
    
    if (isAuthenticated === 'true' && storedRole) {
      setAuthenticated(true)
      setUserRole(storedRole)
      setUsername(storedUsername || '')
      setLoading(false)
      return
    }
    
    // Show login form instead of prompt
    setShowLogin(true)
    setLoading(false)
  }, [])

  // Handle successful login
  const handleLogin = (role: 'admin' | 'reservations') => {
    const storedUsername = localStorage.getItem('username') || ''
    setAuthenticated(true)
    setUserRole(role)
    setUsername(storedUsername)
    setShowLogin(false)
    setLoginError('')
  }

  // Handle login error
  const handleLoginError = (message: string) => {
    setLoginError(message)
    setTimeout(() => setLoginError(''), 5000) // Clear error after 5 seconds
  }

  useEffect(() => {
    if (!authenticated) return
    fetchReservations()
    fetchAutoConfirmationSettings()
    fetchSeatCapacitySettings()
    fetchAvailabilitySettings()
    fetchClosedDates()
  }, [authenticated]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAutoConfirmationSettings = async () => {
    try {
      const response = await fetch('/api/get-auto-confirmation-settings')
      const data = await response.json()
      
      if (data.success && data.settings) {
        setSettings({
          autoConfirmOmakase: data.settings.autoConfirmOmakase,
          autoConfirmDining: data.settings.autoConfirmDining
        })
      }
      setSettingsLoaded(true)
    } catch (error) {
      console.error('Failed to fetch auto-confirmation settings:', error)
      // Keep default settings on error
      setSettingsLoaded(true)
    }
  }

  const fetchSeatCapacitySettings = async () => {
    try {
      const response = await fetch('/api/get-seat-capacity-settings')
      const data = await response.json()
      
      if (data.success && data.settings) {
        setSeatCapacity({
          omakaseCapacity: data.settings.omakaseSeats,
          diningCapacity: data.settings.diningSeats
        })
      }
      setCapacityLoaded(true)
    } catch (error) {
      console.error('Failed to fetch seat capacity settings:', error)
      // Keep default settings on error
      setCapacityLoaded(true)
    }
  }

  // Database stores: Sunday=0, Monday=1, Tuesday=2, Wednesday=3, Thursday=4, Friday=5, Saturday=6
  // Calendar UI shows: Monday=0, Tuesday=1, Wednesday=2, Thursday=3, Friday=4, Saturday=5, Sunday=6
  
  // No conversion functions needed - using getDay() values directly throughout

  const fetchAvailabilitySettings = async () => {
    try {
      const response = await fetch('/api/get-availability-settings')
      const data = await response.json()
      
      if (data.success && data.settings) {
        // Use getDay() values directly - no conversion needed
        const omakaseWeekdays = data.settings.omakaseAvailableDays || [4] // Default: Thursday (getDay = 4)
        const diningWeekdays = data.settings.diningAvailableDays || [0, 1, 2, 3, 4, 5, 6] // Default: All days
        
        setAvailabilitySettings({
          omakaseAvailableDays: omakaseWeekdays,
          diningAvailableDays: diningWeekdays,
          diningAvailableShifts: data.settings.diningAvailableShifts || {
            0: ['lunch', 'dinner'],
            1: ['lunch', 'dinner'],
            2: ['lunch', 'dinner'],
            3: ['lunch', 'dinner'],
            4: ['lunch', 'dinner'],
            5: ['lunch', 'dinner'],
            6: ['lunch', 'dinner']
          }
        })
      }
      setAvailabilityLoaded(true)
    } catch (error) {
      console.error('Failed to fetch availability settings:', error)
      // Keep default settings on error
      setAvailabilityLoaded(true)
    }
  }

  const fetchClosedDates = async () => {
    try {
      const response = await fetch('/api/get-closed-dates')
      const data = await response.json()
      
      if (data.success) {
        setClosedDates(data.closedDates || [])
        setClosedWeekdays(data.closedWeekdays || [])
        setShiftClosures(data.shiftClosures || [])
        
        // Handle holidays more robustly
        const savedHolidays = data.holidays || []
        const currentYear = new Date().getFullYear()
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        // Filter saved holidays to only include future dates from current year
        const currentYearSavedHolidays = savedHolidays.filter((h: any) => {
          const holidayDate = new Date(h.date)
          return holidayDate >= today && holidayDate.getFullYear() === currentYear
        })
        
        // Generate fresh holidays for current year
        const defaultHolidays = generateHolidays(currentYear)
        
        // Smart merge: prefer saved holiday state if the holiday name matches (more robust than date matching)
        const mergedHolidays = defaultHolidays.map(defaultHoliday => {
          const saved = currentYearSavedHolidays.find((h: any) => 
            h.name === defaultHoliday.name || h.date === defaultHoliday.date
          )
          return saved || defaultHoliday
        })
        
        setHolidays(mergedHolidays)
      }
      setClosedDatesLoaded(true)
    } catch (error) {
      console.error('Failed to fetch closed dates:', error)
      // Initialize with current year holidays on error
      const currentYear = new Date().getFullYear()
      setHolidays(generateHolidays(currentYear))
      setClosedDatesLoaded(true)
    }
  }

  // Enhanced closed dates management
  const saveClosedDatesSettings = async () => {
    try {
      const response = await fetch('/api/save-closed-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          closedDates,
          closedWeekdays,
          holidays,
          shiftClosures 
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast({
          title: "Closed Dates Updated! 🚫",
          description: "All closure settings have been saved",
        })
        return true
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Failed to save closed dates:', error)
      toast({
        title: t.errorTitle,
        description: "Failed to save closure settings. Please try again.",
      })
      return false
    }
  }

  const addClosedDate = async () => {
    if (!newClosedDate) return
    
    // Check if date is already in the list
    if (closedDates.includes(newClosedDate)) {
      toast({
        title: t.errorTitle,
        description: "This date is already closed",
      })
      return
    }
    
    const updatedDates = [...closedDates, newClosedDate].sort()
    setClosedDates(updatedDates)
    setNewClosedDate('')
    
    // Auto-save with updated data
    try {
      const response = await fetch('/api/save-closed-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          closedDates: updatedDates,  // Use updated dates
          closedWeekdays,
          holidays,
          shiftClosures 
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast({
          title: "Date Closed! 🚫",
          description: "Date added to closed list",
        })
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Failed to save closed date:', error)
      toast({
        title: "Error",
        description: "Failed to save closed date. Please try again.",
      })
    }
  }

  const removeClosedDate = async (dateToRemove: string) => {
    const updatedDates = closedDates.filter(date => date !== dateToRemove)
    setClosedDates(updatedDates)
    
    // Auto-save with updated data
    try {
      const response = await fetch('/api/save-closed-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          closedDates: updatedDates,  // Use updated dates
          closedWeekdays,
          holidays,
          shiftClosures 
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast({
          title: "Date Reopened! ✅",
          description: "Date removed from closed list",
        })
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Failed to save closed date removal:', error)
      toast({
        title: "Error",
        description: "Failed to remove closed date. Please try again.",
      })
    }
  }

  const toggleWeekday = async (weekdayValue: number) => {
    // closedWeekdays now contains getDay() values directly
    const updatedWeekdays = closedWeekdays.includes(weekdayValue)
      ? closedWeekdays.filter(d => d !== weekdayValue)
      : [...closedWeekdays, weekdayValue].sort()
    
    setClosedWeekdays(updatedWeekdays)
    
    // Auto-save - now using getDay() values directly
    try {
      const response = await fetch('/api/save-closed-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          closedDates,
          closedWeekdays: updatedWeekdays,  // Send getDay() values directly
          holidays,
          shiftClosures 
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Refresh the closed dates state from the server to ensure sync
        await fetchClosedDates()
        
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        const dayName = dayNames[weekdayValue]
        const isNowClosed = updatedWeekdays.includes(weekdayValue)
        toast({
          title: `${dayName} ${isNowClosed ? 'Closed' : 'Opened'}! 📅`,
          description: `${dayName}s are now ${isNowClosed ? 'closed' : 'open'} for reservations`,
        })
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Failed to save weekday toggle:', error)
      toast({
        title: "Error",
        description: "Failed to save weekday setting. Please try again.",
      })
      // Revert the state change on error
      setClosedWeekdays(closedWeekdays)
    }
  }

  const toggleHoliday = async (holidayDate: string) => {
    const updatedHolidays = holidays.map(h => 
      h.date === holidayDate ? { ...h, closed: !h.closed } : h
    )
    setHolidays(updatedHolidays)
    
    // Auto-save with updated holidays data
    try {
      const response = await fetch('/api/save-closed-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          closedDates,
          closedWeekdays,
          holidays: updatedHolidays,  // Use the updated holidays directly
          shiftClosures
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast({
          title: "Holiday Updated! 🎉",
          description: "Holiday setting saved successfully",
        })
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Failed to save holiday setting:', error)
      toast({
        title: "Error",
        description: "Failed to save holiday setting. Please try again.",
      })
    }
  }

  const toggleAllHolidays = async () => {
    const allClosed = holidays.every(h => h.closed)
    const updatedHolidays = holidays.map(h => ({ ...h, closed: !allClosed }))
    setHolidays(updatedHolidays)
    
    // Auto-save with updated holidays data
    try {
      const response = await fetch('/api/save-closed-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          closedDates,
          closedWeekdays,
          holidays: updatedHolidays,  // Use the updated holidays directly
          shiftClosures
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast({
          title: "All Holidays Updated! 🎉",
          description: `All holidays ${allClosed ? 'opened' : 'closed'} successfully`,
        })
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Failed to save all holidays setting:', error)
      toast({
        title: "Error",
        description: "Failed to save holiday settings. Please try again.",
      })
    }
  }

  const toggleOmakaseDay = (weekdayValue: number) => {
    const currentDays = availabilitySettings.omakaseAvailableDays
    const updatedDays = currentDays.includes(weekdayValue)
      ? currentDays.filter(d => d !== weekdayValue)
      : [...currentDays, weekdayValue].sort()
    
    setAvailabilitySettings({
      ...availabilitySettings,
      omakaseAvailableDays: updatedDays
    })
  }

  const toggleDiningDay = (weekdayValue: number) => {
    const currentDays = availabilitySettings.diningAvailableDays
    const updatedDays = currentDays.includes(weekdayValue)
      ? currentDays.filter(d => d !== weekdayValue)
      : [...currentDays, weekdayValue].sort()
    
    // When removing a day, also remove its shifts
    const updatedShifts = { ...availabilitySettings.diningAvailableShifts }
    if (!updatedDays.includes(weekdayValue)) {
      updatedShifts[weekdayValue] = []
    } else if (!updatedShifts[weekdayValue] || updatedShifts[weekdayValue].length === 0) {
      // When adding a day, default to both shifts
      updatedShifts[weekdayValue] = ['lunch', 'dinner']
    }
    
    setAvailabilitySettings({
      ...availabilitySettings,
      diningAvailableDays: updatedDays,
      diningAvailableShifts: updatedShifts
    })
  }

  const toggleDiningShift = (weekdayValue: number, shift: 'lunch' | 'dinner') => {
    const currentShifts = availabilitySettings.diningAvailableShifts[weekdayValue] || []
    let updatedShifts: ('lunch' | 'dinner')[]
    
    if (currentShifts.includes(shift)) {
      // Remove the shift
      updatedShifts = currentShifts.filter(s => s !== shift)
    } else {
      // Add the shift
      updatedShifts = [...currentShifts, shift].sort()
    }
    
    // Update dining available days based on shifts
    let updatedDays = [...availabilitySettings.diningAvailableDays]
    if (updatedShifts.length === 0) {
      // No shifts available, remove the day
      updatedDays = updatedDays.filter(d => d !== weekdayValue)
    } else if (!updatedDays.includes(weekdayValue)) {
      // Has shifts but day not in list, add it
      updatedDays = [...updatedDays, weekdayValue].sort()
    }
    
    setAvailabilitySettings({
      ...availabilitySettings,
      diningAvailableDays: updatedDays,
      diningAvailableShifts: {
        ...availabilitySettings.diningAvailableShifts,
        [weekdayValue]: updatedShifts
      }
    })
  }

  // Individual save functions for settings
  const saveAutoConfirmationSettings = async () => {
    setSavingAutoConfirm(true)
    try {
      const response = await fetch('/api/save-auto-confirmation-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoConfirmOmakase: settings.autoConfirmOmakase,
          autoConfirmDining: settings.autoConfirmDining
        })
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Auto-Confirmation Saved! ⚡",
          description: "Settings updated successfully",
        })
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Error saving auto-confirmation settings:', error)
      toast({
        title: t.settingsFailedTitle,
        description: "Failed to save auto-confirmation settings",
      })
    } finally {
      setSavingAutoConfirm(false)
    }
  }

  const saveSeatCapacitySettings = async () => {
    setSavingCapacity(true)
    try {
      const response = await fetch('/api/save-seat-capacity-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          omakaseSeats: seatCapacity.omakaseCapacity,
          diningSeats: seatCapacity.diningCapacity
        })
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Seat Capacity Saved! 🪑",
          description: `Omakase: ${seatCapacity.omakaseCapacity} seats, Dining: ${seatCapacity.diningCapacity} seats`,
        })
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Error saving seat capacity settings:', error)
      toast({
        title: t.settingsFailedTitle,
        description: "Failed to save seat capacity settings",
      })
    } finally {
      setSavingCapacity(false)
    }
  }

  const saveAvailabilitySettings = async () => {
    setSavingAvailability(true)
    try {
      // Use getDay() values directly - no conversion needed
      const response = await fetch('/api/save-availability-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          omakaseAvailableDays: availabilitySettings.omakaseAvailableDays,
          diningAvailableDays: availabilitySettings.diningAvailableDays,
          diningAvailableShifts: availabilitySettings.diningAvailableShifts
        })
      })

      const data = await response.json()

      if (data.success) {
        // Convert getDay() values to day names for display
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        const omakaseDays = availabilitySettings.omakaseAvailableDays.length > 0 
          ? availabilitySettings.omakaseAvailableDays.map(pos => dayNames[pos]).join(', ')
          : 'Closed (no days selected)'
        const diningDays = availabilitySettings.diningAvailableDays.map(pos => dayNames[pos]).join(', ')
        toast({
          title: "Availability Settings Saved! 📅",
          description: `Omakase: ${omakaseDays} | Dining: ${diningDays}`,
        })
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Error saving availability settings:', error)
      toast({
        title: t.settingsFailedTitle,
        description: "Failed to save availability settings",
      })
    } finally {
      setSavingAvailability(false)
    }
  }

  const addShiftClosure = async () => {
    if (!newShiftClosure.date) {
      toast({
        title: "⚠️ Please select a date",
        description: "A date is required for shift closure",
      })
      return
    }

    // Check if this date already has a shift closure
    const existingClosure = shiftClosures.find(sc => sc.date === newShiftClosure.date)
    if (existingClosure) {
      toast({
        title: "⚠️ Date already has a shift closure",
        description: `${newShiftClosure.date} already has a ${existingClosure.type.replace('_', ' ')} closure`,
      })
      return
    }

    // Check if this date is already fully closed
    if (closedDates.includes(newShiftClosure.date)) {
      toast({
        title: "⚠️ Date is already fully closed",
        description: `${newShiftClosure.date} is already marked as fully closed`,
      })
      return
    }

    const updatedShiftClosures = [...shiftClosures, newShiftClosure].sort((a, b) => a.date.localeCompare(b.date))
    setShiftClosures(updatedShiftClosures)
    setNewShiftClosure({ date: '', type: 'full_day' })

    // Auto-save
    try {
      const response = await fetch('/api/save-closed-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          closedDates,
          closedWeekdays,
          holidays,
          shiftClosures: updatedShiftClosures
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        const shiftTypeText = newShiftClosure.type === 'lunch_only' ? 'lunch' : 
                              newShiftClosure.type === 'dinner_only' ? 'dinner' : 'full day'
        toast({
          title: "Shift closure added! 🕐",
          description: `${newShiftClosure.date} - ${shiftTypeText} is now closed`,
        })
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Failed to save:', error)
      // Revert on error
      setShiftClosures(shiftClosures)
      toast({
        title: "Failed to add shift closure ❌",
        description: "Please try again",
      })
    }
  }

  const removeShiftClosure = async (dateToRemove: string) => {
    const updatedShiftClosures = shiftClosures.filter(sc => sc.date !== dateToRemove)
    setShiftClosures(updatedShiftClosures)

    // Auto-save
    try {
      const response = await fetch('/api/save-closed-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          closedDates,
          closedWeekdays,
          holidays,
          shiftClosures: updatedShiftClosures
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast({
          title: "Shift closure removed! 🕐",
          description: `${dateToRemove} shift restrictions removed`,
        })
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Failed to save:', error)
      // Revert on error
      setShiftClosures(shiftClosures)
      toast({
        title: "Failed to remove shift closure ❌",
        description: "Please try again",
      })
    }
  }

  useEffect(() => {
    // Generate days for the current viewing month
    const monthStart = startOfMonth(currentViewMonth);
    const monthEnd = endOfMonth(currentViewMonth);
    const daysArr = eachDayOfInterval({
      start: monthStart,
      end: monthEnd,
    });
    
    setDays(daysArr);
  }, [currentViewMonth]);

  const fetchReservations = async () => {
    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      const start = addDays(now, -180); // Fetch 6 months back for historical data
      const end = addDays(now, 180); // Fetch 6 months ahead for full navigation range
      
      // Fetch both omakase and dining reservations
      const [omakaseResponse, diningResponse] = await Promise.all([
        supabase()
          .from('omakase_reservations')
          .select('*')
          .gte('reservation_date', format(start, 'yyyy-MM-dd'))
          .lte('reservation_date', format(end, 'yyyy-MM-dd'))
          .order('reservation_date', { ascending: true })
          .order('reservation_time', { ascending: true }),
        supabase()
          .from('dining_reservations')
          .select('*')
          .gte('reservation_date', format(start, 'yyyy-MM-dd'))
          .lte('reservation_date', format(end, 'yyyy-MM-dd'))
          .order('reservation_date', { ascending: true })
          .order('reservation_time', { ascending: true })
      ]);
      
      if (omakaseResponse.error) throw omakaseResponse.error;
      if (diningResponse.error) throw diningResponse.error;
      
      // Combine and mark reservation types
      const omakaseReservations = (omakaseResponse.data || []).map(r => ({ ...r, type: 'omakase' as const }));
      const diningReservations = (diningResponse.data || []).map(r => ({ ...r, type: 'dining' as const }));
      
      // Filter out omakase reservations with pending payment status
      const filteredOmakaseReservations = omakaseReservations.filter(r => r.payment_status !== 'pending');
      
      const allReservations = [...filteredOmakaseReservations, ...diningReservations];
      
      // Sort by date and time
      allReservations.sort((a, b) => {
        const dateCompare = a.reservation_date.localeCompare(b.reservation_date);
        if (dateCompare !== 0) return dateCompare;
        return a.reservation_time.localeCompare(b.reservation_time);
      });
      
      setReservations(allReservations);
      
      // Group by date
      const grouped: { [date: string]: Reservation[] } = {};
      allReservations.forEach((r: Reservation) => {
        const key = r.reservation_date;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(r);
      });
      setCalendarReservations(grouped);
      
      // Calculate stats
      calculateStats(allReservations);
    } catch (err: any) {
      setError(err.message || 'Failed to load reservations');
    } finally {
      setLoading(false);
    }
  }



  const calculateStats = (reservationsData: Reservation[]) => {
    const currentDate = new Date()
    const today = format(currentDate, 'yyyy-MM-dd')
    const yesterday = format(new Date(currentDate.getTime() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
    const tomorrow = format(new Date(currentDate.getTime() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
    
    // Calculate Monday-Sunday week (Monday = start of week)
    const dayOfWeek = currentDate.getDay() // 0 = Sunday, 1 = Monday, etc.
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Handle Sunday as 6 days from Monday
    const weekStart = format(new Date(currentDate.getTime() - daysFromMonday * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
    const weekEnd = format(new Date(currentDate.getTime() + (6 - daysFromMonday) * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
    
    // Last week and next week calculations
    const lastWeekStart = format(new Date(currentDate.getTime() - (daysFromMonday + 7) * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
    const lastWeekEnd = format(new Date(currentDate.getTime() - (daysFromMonday + 1) * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
    const nextWeekStart = format(new Date(currentDate.getTime() + (7 - daysFromMonday) * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
    const nextWeekEnd = format(new Date(currentDate.getTime() + (13 - daysFromMonday) * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
    
    // Filter out cancelled and pending reservations for all stats (pending means payment not successful yet)
    const activeReservations = reservationsData.filter(r => 
      r.status !== 'cancelled' && 
      r.status !== 'pending'
    )
    
    // Daily calculations
    const yesterdayReservations = activeReservations.filter(r => r.reservation_date === yesterday).length
    const todayReservations = activeReservations.filter(r => r.reservation_date === today).length
    const tomorrowReservations = activeReservations.filter(r => r.reservation_date === tomorrow).length
    
    // Weekly calculations
    const lastWeekReservations = activeReservations.filter(r => r.reservation_date >= lastWeekStart && r.reservation_date <= lastWeekEnd).length
    const weekReservations = activeReservations.filter(r => r.reservation_date >= weekStart && r.reservation_date <= weekEnd).length
    const nextWeekReservations = activeReservations.filter(r => r.reservation_date >= nextWeekStart && r.reservation_date <= nextWeekEnd).length
    
    // Revenue calculations
    const getRevenueForPeriod = (start: string, end: string) => {
      return activeReservations
        .filter(r => r.reservation_date >= start && r.reservation_date <= end && (r.status === 'confirmed' || r.status === 'completed'))
        .reduce((sum, r) => {
          const pricePerPerson = r.type === 'omakase' ? 99 : 40
          return sum + (r.party_size * pricePerPerson)
        }, 0)
    }
    
    const lastWeekRevenue = getRevenueForPeriod(lastWeekStart, lastWeekEnd)
    const totalRevenue = getRevenueForPeriod(weekStart, weekEnd)
    const nextWeekRevenue = getRevenueForPeriod(nextWeekStart, nextWeekEnd)
    
    // Party size calculations
    const getAvgPartySizeForPeriod = (start: string, end: string) => {
      const confirmedReservations = activeReservations.filter(r => 
        r.reservation_date >= start && r.reservation_date <= end && (r.status === 'confirmed' || r.status === 'completed')
      )
      return confirmedReservations.length > 0 ? 
        confirmedReservations.reduce((sum, r) => sum + r.party_size, 0) / confirmedReservations.length : 0
    }
    
    const lastWeekAvgPartySize = getAvgPartySizeForPeriod(lastWeekStart, lastWeekEnd)
    const avgPartySize = getAvgPartySizeForPeriod(weekStart, weekEnd)
    const nextWeekAvgPartySize = getAvgPartySizeForPeriod(nextWeekStart, nextWeekEnd)
    
    setStats({
      todayReservations,
      weekReservations,
      totalRevenue,
      avgPartySize: Math.round(avgPartySize * 10) / 10,
      dailyTrend: [yesterdayReservations, todayReservations, tomorrowReservations],
      weeklyTrend: [lastWeekReservations, weekReservations, nextWeekReservations],
      revenueTrend: [lastWeekRevenue, totalRevenue, nextWeekRevenue],
      partySizeTrend: [
        Math.round(lastWeekAvgPartySize * 10) / 10,
        Math.round(avgPartySize * 10) / 10,
        Math.round(nextWeekAvgPartySize * 10) / 10
      ]
    })
  }

  const filteredReservations = (reservationsForDate: Reservation[]) => {
    return reservationsForDate.filter(reservation => {
      // First check if we should show cancelled reservations
      if (reservation.status === 'cancelled' && !showCancelled) {
        return false;
      }

      // Check if we should show pending reservations
      if (reservation.status === 'pending' && !showPending) {
        return false;
      }

      // Then apply other filters
      const matchesSearch = searchTerm === '' || 
        reservation.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        reservation.customer_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        reservation.customer_phone.includes(searchTerm) ||
        reservation.confirmation_code?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || reservation.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }

  // Calculate capacity utilization for a specific date
  const calculateCapacityForDate = (reservationsForDay: Reservation[]) => {
    if (!reservationsForDay || reservationsForDay.length === 0) {
      return { percentage: 0, omakaseUsed: 0, diningUsed: 0, totalUsed: 0, totalCapacity: seatCapacity.omakaseCapacity + seatCapacity.diningCapacity }
    }

    // Filter out cancelled and pending reservations (pending means payment not successful yet)
    const activeReservations = reservationsForDay.filter(r => 
      r.status !== 'cancelled' && 
      r.status !== 'pending'
    )
    
    // Calculate used seats by type
    const omakaseUsed = activeReservations
      .filter(r => r.type === 'omakase')
      .reduce((sum, r) => sum + r.party_size, 0)
    
    const diningUsed = activeReservations
      .filter(r => r.type === 'dining')
      .reduce((sum, r) => sum + r.party_size, 0)

    const totalUsed = omakaseUsed + diningUsed
    const totalCapacity = seatCapacity.omakaseCapacity + seatCapacity.diningCapacity
    const percentage = totalCapacity > 0 ? (totalUsed / totalCapacity) * 100 : 0

    return {
      percentage: Math.min(percentage, 100), // Cap at 100%
      omakaseUsed,
      diningUsed,
      totalUsed,
      totalCapacity,
      omakaseCapacity: seatCapacity.omakaseCapacity,
      diningCapacity: seatCapacity.diningCapacity
    }
  }

  // Global search across all reservations
  const searchAllReservations = () => {
    if (!searchTerm) return [];
    return reservations.filter(reservation => {
      // First check if we should show cancelled reservations
      if (reservation.status === 'cancelled' && !showCancelled) {
        return false;
      }

      // Check if we should show pending reservations
      if (reservation.status === 'pending' && !showPending) {
        return false;
      }

      // Then apply other filters
      const matchesSearch = 
        reservation.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        reservation.customer_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        reservation.customer_phone.includes(searchTerm) ||
        reservation.confirmation_code?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || reservation.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }

  const searchResults = searchTerm.trim() ? searchAllReservations() : []

  const handleEditReservation = (reservation: Reservation) => {
    setEditingReservation({
      id: reservation.id,
      customer_name: reservation.customer_name,
      customer_email: reservation.customer_email,
      customer_phone: reservation.customer_phone,
      reservation_date: reservation.reservation_date,
      reservation_time: reservation.reservation_time,
      party_size: reservation.party_size,
      special_requests: reservation.special_requests || '',
      notes: reservation.notes || '',
      type: reservation.type
    })
  }

  const handleSaveEdit = async () => {
    if (!editingReservation) return
    
    try {
      const updates = {
        customer_name: editingReservation.customer_name,
        customer_email: editingReservation.customer_email,
        customer_phone: editingReservation.customer_phone,
        reservation_date: editingReservation.reservation_date,
        reservation_time: editingReservation.reservation_time,
        party_size: editingReservation.party_size,
        special_requests: editingReservation.special_requests,
        notes: editingReservation.notes
      }

      // Find the reservation to get its type
      const currentReservation = reservations.find(r => r.id === editingReservation.id)
      if (!currentReservation) {
        throw new Error('Reservation not found')
      }

      const response = await fetch('/api/update-reservation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: editingReservation.id, 
          updates,
          type: currentReservation.type
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Update failed')
      }
      
      toast({
        title: 'Reservation Updated',
        description: 'The reservation has been successfully updated.',
      })
      
      setEditingReservation(null)
      fetchReservations()
    } catch (error: any) {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update the reservation. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const processCancellation = async () => {
    if (!cancellingReservation || !cancellationReason.trim()) return

    setProcessingCancellation(true)
    
    try {
      await handleCancelReservation(cancellingReservation.id, cancellationReason.trim())
      setShowCancelModal(false)
      setCancellingReservation(null)
      setCancellationReason('')
    } catch (error) {
      // Error is already handled in handleCancelReservation
    } finally {
      setProcessingCancellation(false)
    }
  }

  const handleCancelReservation = async (reservationId: string, reason: string) => {
    try {
      // Find the reservation to get its type
      const currentReservation = reservations.find(r => r.id === reservationId)
      if (!currentReservation) {
        throw new Error('Reservation not found')
      }

      // First, update the reservation status
      const updates = {
        status: 'cancelled',
        cancellation_reason: reason
      }

      const response = await fetch('/api/update-reservation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: reservationId, 
          updates,
          type: currentReservation.type
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Cancellation failed')
      }

      const updatedReservation = await response.json()

      // Database triggers will handle cancellation email
      
      toast({
        title: 'Reservation Cancelled',
        description: 'The reservation has been cancelled successfully.',
      })
      
      fetchReservations()
    } catch (error: any) {
      toast({
        title: 'Cancellation Failed',
        description: error.message || 'Failed to cancel the reservation. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleRefund = (reservation: Reservation) => {
    setRefundingReservation(reservation)
    setRefundType('full')
    setRefundPercentage(100)
    setRefundReason('')
    setShowRefundModal(true)
  }

  const processRefund = async () => {
    if (!refundingReservation || !refundingReservation.stripe_charge_id) return

    setProcessingRefund(true)
    
    try {
      // Calculate refund amount considering already refunded amounts
      let refundAmount: number;
      let actualRefundPercentage: number;
      
      if (refundingReservation.payment_status === 'partially_refunded' && refundingReservation.cancellation_refund_percentage) {
        const remainingPercentage = 100 - refundingReservation.cancellation_refund_percentage;
        if (refundType === 'full') {
          refundAmount = Math.round((refundingReservation.prepayment_amount! * remainingPercentage) / 100);
          actualRefundPercentage = remainingPercentage;
        } else {
          refundAmount = Math.round((refundingReservation.prepayment_amount! * remainingPercentage * refundPercentage) / 10000);
          actualRefundPercentage = Math.round((remainingPercentage * refundPercentage) / 100);
        }
      } else {
        if (refundType === 'full') {
          refundAmount = refundingReservation.prepayment_amount!;
          actualRefundPercentage = 100;
        } else {
          refundAmount = Math.round((refundingReservation.prepayment_amount! * refundPercentage) / 100);
          actualRefundPercentage = refundPercentage;
        }
      }

      const response = await fetch('/api/stripe/process-refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationId: refundingReservation.id,
          chargeId: refundingReservation.stripe_charge_id,
          amount: refundAmount,
          reason: refundReason || 'Admin initiated refund',
          refundPercentage: actualRefundPercentage
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Refund failed')
      }

      const result = await response.json()

      toast({
        title: t.refundSuccessTitle,
        description: t.refundSuccessDesc,
      })

      // Update local reservation state
      setReservations(prev => prev.map(r => 
        r.id === refundingReservation.id 
          ? { 
              ...r, 
              payment_status: actualRefundPercentage === 100 || 
                (r.cancellation_refund_percentage && r.cancellation_refund_percentage + actualRefundPercentage >= 100) 
                ? 'refunded' 
                : 'partially_refunded',
              cancellation_refund_percentage: r.cancellation_refund_percentage 
                ? r.cancellation_refund_percentage + actualRefundPercentage 
                : actualRefundPercentage
            }
          : r
      ))

      setShowRefundModal(false)
      setRefundingReservation(null)
    } catch (error: any) {
      toast({
        title: t.refundFailedTitle,
        description: error.message || t.refundFailedDesc,
        variant: 'destructive',
      })
    } finally {
      setProcessingRefund(false)
    }
  }

  const handleDiningNoShowCharge = (reservation: Reservation) => {
    setChargingReservation(reservation)
    setShowDiningChargeModal(true)
  }

  const processDiningNoShowCharge = async () => {
    if (!chargingReservation) return

    setProcessingDiningCharge(true)
    
    try {
      const chargeAmount = (chargingReservation.party_size || 1) * 2500 // $25 per person in cents

      const response = await fetch('/api/stripe/charge-dining-fee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationId: chargingReservation.id,
          chargeType: 'no_show',
          amount: chargeAmount
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Charge failed')
      }

      const result = await response.json()

      toast({
        title: 'No-Show Fee Charged ✓',
        description: `Successfully charged $${(chargeAmount / 100).toFixed(2)} for ${chargingReservation.party_size} guests`,
      })

      // Update local reservation state
      setReservations(prev => prev.map(r => 
        r.id === chargingReservation.id 
          ? { 
              ...r, 
              no_show_fee_charged: true,
              no_show_fee_amount: chargeAmount,
              no_show_fee_charged_at: new Date().toISOString(),
              stripe_charge_id: result.chargeId
            }
          : r
      ))

      setShowDiningChargeModal(false)
      setChargingReservation(null)
    } catch (error: any) {
      toast({
        title: 'Charge Failed ✗',
        description: error.message || 'Failed to charge no-show fee',
        variant: 'destructive',
      })
    } finally {
      setProcessingDiningCharge(false)
    }
  }

  const handleDiningRefund = (reservation: Reservation) => {
    setRefundingDiningReservation(reservation)
    setDiningRefundReason('')
    setShowDiningRefundModal(true)
  }

  const processDiningRefund = async () => {
    if (!refundingDiningReservation || !refundingDiningReservation.stripe_charge_id) return

    setProcessingDiningRefund(true)
    
    try {
      const refundAmount = refundingDiningReservation.no_show_fee_amount || 0

      const response = await fetch('/api/stripe/refund-dining-fee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationId: refundingDiningReservation.id,
          chargeId: refundingDiningReservation.stripe_charge_id,
          amount: refundAmount,
          reason: diningRefundReason || 'Admin initiated refund'
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Refund failed')
      }

      const result = await response.json()

      toast({
        title: 'Refund Processed ✓',
        description: `Successfully refunded $${(refundAmount / 100).toFixed(2)}`,
      })

      // Update local reservation state
      setReservations(prev => prev.map(r => 
        r.id === refundingDiningReservation.id 
          ? { 
              ...r, 
              no_show_fee_charged: false
            }
          : r
      ))

      setShowDiningRefundModal(false)
      setRefundingDiningReservation(null)
    } catch (error: any) {
      toast({
        title: 'Refund Failed ✗',
        description: error.message || 'Failed to process refund',
        variant: 'destructive',
      })
    } finally {
      setProcessingDiningRefund(false)
    }
  }

  const handleCreateReservation = async () => {
    // Validate required fields
    if (!newReservation.customer_name.trim()) {
      toast({
        title: 'Validation Error ❌',
        description: 'Customer name is required',
      })
      return
    }

    if (!newReservation.customer_email.trim() && !newReservation.customer_phone.trim()) {
      toast({
        title: 'Validation Error ❌',
        description: 'Please provide either an email address or phone number',
      })
      return
    }

    if (!newReservation.reservation_date) {
      toast({
        title: 'Validation Error ❌',
        description: 'Reservation date is required',
      })
      return
    }

    try {
      // Let the API determine the correct status based on auto-confirmation settings
      // Remove hardcoded status and confirmation_code to let the API handle it
      const reservationData = {
        ...newReservation
        // status and confirmation_code will be determined by the API based on settings
      }

      const response = await fetch('/api/create-reservation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reservationData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Creation failed')
      }
      
      toast({
        title: 'Reservation Created',
        description: 'New reservation has been created successfully.',
      })
      
      setShowNewReservationForm(false)
      setNewReservation({
        customer_name: '',
        customer_email: '',
        customer_phone: '',
        reservation_date: '',
        reservation_time: '17:00',
        party_size: 2,
        type: 'omakase',
        special_requests: '',
        notes: ''
      })
      fetchReservations()
    } catch (error: any) {
      toast({
        title: 'Creation Failed',
        description: error.message || 'Failed to create the reservation. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleStatusChange = async (reservationId: string, newStatus: string) => {
    try {
      // Find the current reservation to check its current status and type
      const currentReservation = reservations.find(r => r.id === reservationId)
      if (!currentReservation) {
        throw new Error('Reservation not found')
      }
      
      const previousStatus = currentReservation?.status
      const reservationType = currentReservation.type
      
      let updates: any = { status: newStatus }
      
      // If changing to confirmed status from any other status
      if (newStatus === 'confirmed' && previousStatus !== 'confirmed') {
        // Clear cancellation data if coming from cancelled status
        if (previousStatus === 'cancelled') {
          updates.cancellation_reason = null
        }
        // Generate confirmation code if it doesn't exist
        if (!currentReservation?.confirmation_code) {
          updates.confirmation_code = Math.random().toString(36).substring(2, 8).toUpperCase()
        }
      }

      const response = await fetch('/api/update-reservation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: reservationId, 
          updates,
          type: reservationType // Pass the reservation type to the API
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Status update failed')
      }

      const updatedReservation = await response.json()

      // Log status change for monitoring (emails now handled by Supabase)
      console.log(`Reservation ${reservationId} status changed to ${newStatus} (emails handled by Supabase)`)
      
      // Check if automatic refund was processed
      if (updatedReservation.type === 'omakase' && 
          newStatus === 'cancelled' && 
          updatedReservation.payment_status && 
          (updatedReservation.payment_status === 'refunded' || updatedReservation.payment_status === 'partially_refunded')) {
        
        const refundPercentage = updatedReservation.cancellation_refund_percentage || 0
        toast({
          title: t.statusUpdatedTitle,
          description: refundPercentage > 0 
            ? `Reservation cancelled with ${refundPercentage}% automatic refund based on cancellation policy`
            : 'Reservation cancelled. No refund due based on cancellation policy.',
        })
      } else {
        toast({
          title: t.statusUpdatedTitle,
          description: `Reservation status changed to ${getStatusLabel(newStatus)}.`,
        })
      }
      
      fetchReservations()
    } catch (error: any) {
      toast({
        title: 'Status Update Failed',
        description: error.message || 'Failed to update the reservation status.',
        variant: 'destructive',
      })
    }
  }

  const logout = () => {
    localStorage.removeItem('admin-authenticated')
    localStorage.removeItem('user-role')
    localStorage.removeItem('username')
    setAuthenticated(false)
    setUserRole(null)
    setUsername('')
    setShowLogin(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        {/* Background Image */}
        <div 
          className="fixed inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: 'url(/background_with_logo.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed'
          }}
        />
        {/* Background Overlay */}
        <div className="fixed inset-0 bg-white/30 backdrop-blur-[1px]" />
        
        <div className="text-center relative z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-copper mx-auto"></div>
          <p className="mt-4 text-copper elegant-subtitle">{t.loadingDashboard}</p>
        </div>
      </div>
    )
  }

  if (showLogin || !authenticated) {
    return (
      <div className="relative">
        <LoginForm onLogin={handleLogin} onError={handleLoginError} />
        {loginError && (
          <div className="fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-xl shadow-lg z-50">
            {loginError}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Background Image */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url(/background_with_logo.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
      />
      {/* Background Overlay */}
      <div className="fixed inset-0 bg-white/30 backdrop-blur-[1px]" />
      
      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <header className="liquid-glass shadow py-4 sm:py-6 px-4 sm:px-8">
        <div className="flex items-center justify-between">
          {/* Brand Section */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative">
              <Image 
                src="/logo_transparent.png" 
                alt="TooHot Restaurant Logo" 
                width={40}
                height={40}
                className="object-contain sm:w-12 sm:h-12"
                priority
              />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-playfair text-copper font-semibold">
                {t.toohotAdmin}
              </h1>
              <p className="text-xs sm:text-sm text-charcoal mt-1 hidden sm:block">{t.reservationManagementDashboard}</p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-3">
            {/* User Role Indicator */}
            <div className="flex items-center gap-2 mr-4">
              <div className={`w-3 h-3 rounded-full ${userRole === 'admin' ? 'bg-purple-500' : 'bg-green-500'}`}></div>
              <span className="text-sm text-charcoal/70 font-medium">
                {userRole === 'admin' ? 'Admin' : 'Manager'} | {username}
              </span>
            </div>
            
            {/* Admin-only navigation */}
            {userRole === 'admin' && (
              <>
                <button
                  onClick={() => router.push('/email-templates')}
                  className="group relative bg-gradient-to-r from-pink-600 to-rose-600 text-white px-4 py-3 rounded-xl hover:from-pink-700 hover:to-rose-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
                >
                  <span className="text-lg">📧</span>
                  <span className="text-sm">{t.emailTemplates}</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </button>
                <button
                  onClick={() => router.push('/crm')}
                  className="group relative bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-4 py-3 rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
                >
                  <span className="text-lg">👥</span>
                  <span className="text-sm">{t.customerCRM}</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </button>
                <button
                  onClick={() => router.push('/analytics')}
                  className="group relative bg-gradient-to-r from-orange-600 to-red-600 text-white px-4 py-3 rounded-xl hover:from-orange-700 hover:to-red-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
                >
                  <span className="text-lg">📊</span>
                  <span className="text-sm">{t.analytics}</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </button>
                <div className="w-px h-8 bg-copper/20"></div>
              </>
            )}
            
            <button
              onClick={() => setShowSettings(true)}
              className="group relative bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-3 rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
            >
              <span className="text-lg">⚙️</span>
              <span className="text-sm">{t.settings}</span>
              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="md:hidden p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors duration-200"
          >
            <div className="w-6 h-6 flex flex-col justify-center items-center">
              <div className={`w-5 h-0.5 bg-copper transition-all duration-300 ${showMobileMenu ? 'rotate-45 translate-y-1' : ''}`}></div>
              <div className={`w-5 h-0.5 bg-copper transition-all duration-300 mt-1 ${showMobileMenu ? 'opacity-0' : ''}`}></div>
              <div className={`w-5 h-0.5 bg-copper transition-all duration-300 mt-1 ${showMobileMenu ? '-rotate-45 -translate-y-1' : ''}`}></div>
            </div>
          </button>
        </div>

        {/* Mobile Menu */}
        {showMobileMenu && (
          <div className="md:hidden mt-4 pt-4 border-t border-copper/20">
            {/* Mobile User Role Indicator */}
            <div className="flex items-center gap-2 mb-4 px-2">
              <div className={`w-3 h-3 rounded-full ${userRole === 'admin' ? 'bg-purple-500' : 'bg-green-500'}`}></div>
              <span className="text-sm text-charcoal/70 font-medium">
                {userRole === 'admin' ? 'Admin' : 'Manager'} | {username}
              </span>
            </div>
            
            <div className="flex flex-col gap-2">
              {/* Admin-only mobile navigation */}
              {userRole === 'admin' && (
                <>
                  <button
                    onClick={() => {
                      router.push('/email-templates')
                      setShowMobileMenu(false)
                    }}
                    className="group relative bg-gradient-to-r from-pink-600 to-rose-600 text-white px-4 py-3 rounded-xl hover:from-pink-700 hover:to-rose-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
                  >
                    <span className="text-lg">📧</span>
                    <span className="text-sm">{t.emailTemplates}</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </button>
                  <button
                    onClick={() => {
                      router.push('/crm')
                      setShowMobileMenu(false)
                    }}
                    className="group relative bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-4 py-3 rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
                  >
                    <span className="text-lg">👥</span>
                    <span className="text-sm">{t.customerCRM}</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </button>
                  <button
                    onClick={() => {
                      router.push('/analytics')
                      setShowMobileMenu(false)
                    }}
                    className="group relative bg-gradient-to-r from-orange-600 to-red-600 text-white px-4 py-3 rounded-xl hover:from-orange-700 hover:to-red-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
                  >
                    <span className="text-lg">📊</span>
                    <span className="text-sm">{t.analytics}</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </button>
                </>
              )}
              
              <button
                onClick={() => {
                  setShowSettings(true)
                  setShowMobileMenu(false)
                }}
                className="group relative bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-3 rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
              >
                <span className="text-lg">⚙️</span>
                <span className="text-sm">{t.settings}</span>
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto py-4 sm:py-8 px-4">
        {/* Calendar and Reservations Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8 mb-8 sm:mb-12">
          
          {/* Calendar View - Left Side */}
          <div className="lg:col-span-1">
            <div className="flex flex-col mb-4 sm:mb-6">
              {/* Calendar navigation header */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={goToPreviousMonth}
                  disabled={subMonths(currentViewMonth, 1) < startOfMonth(subMonths(new Date(), 6))}
                  className="p-2 rounded-lg bg-sand-beige/60 hover:bg-sand-beige transition-colors text-copper disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ←
                </button>
                <div className="flex flex-col items-center">
                  <h2 className="text-lg sm:text-xl font-playfair text-copper">
                    {format(currentViewMonth, 'MMMM yyyy')}
                  </h2>
                  <button
                    onClick={goToToday}
                    className="text-xs text-copper/70 hover:text-copper transition-colors"
                  >
                    {t.calendarToday}
                  </button>
                </div>
                <button
                  onClick={goToNextMonth}
                  disabled={addMonths(currentViewMonth, 1) > startOfMonth(addMonths(new Date(), 6))}
                  className="p-2 rounded-lg bg-sand-beige/60 hover:bg-sand-beige transition-colors text-copper disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  →
                </button>
              </div>
              
              {/* Legend */}
              <div className="flex items-center justify-center gap-4 text-xs text-charcoal/60">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>{t.calendarConfirmed}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span>{t.actionRequired}</span>
                </div>
              </div>
            </div>
            <div className="liquid-glass rounded-2xl shadow-lg p-4 sm:p-8 overflow-x-auto wabi-sabi-border backdrop-blur-xl border border-white/20">
              {/* Calendar header: Sun-Sat */}
                              <div className="grid grid-cols-7 mb-3">
                  {[t.sunday, t.monday, t.tuesday, t.wednesday, t.thursday, t.friday, t.saturday].map((d) => (
                    <div key={d} className="text-center font-playfair text-copper text-sm pb-2 font-semibold">{d}</div>
                  ))}
                </div>
                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-2">
                {/* Calculate offset for first day */}
                {(() => {
                  const firstDay = days[0];
                  const jsWeekday = firstDay.getDay(); // Use native JavaScript getDay() for consistency
                  // Sunday-first format: use getDay() directly as offset
                  const offset = jsWeekday;
                  return Array.from({ length: offset }).map((_, i) => (
                    <div key={`empty-${i}`} />
                  ));
                })()}
                {days.map((day, dayIndex) => {
                  const key = format(day, 'yyyy-MM-dd');
                  const reservationsForDay = calendarReservations[key] || [];
                  const hasConfirmed = reservationsForDay.some(r => r.status === 'confirmed' || r.status === 'seated' || r.status === 'completed');
                  const hasPending = reservationsForDay.some(r => r.status === 'pending');
                  const capacity = calculateCapacityForDate(reservationsForDay);
                  const isClosedDate = isDateClosed(key);
                  const isPastDate = day < new Date(new Date().setHours(0, 0, 0, 0));
                  

                  
                  return (
                    <button
                      key={key}
                      className={`relative flex flex-col items-center justify-center p-2 sm:p-3 rounded-xl border transition-all text-xs sm:text-sm min-h-[60px] sm:min-h-[80px] overflow-hidden
                        ${isPastDate 
                          ? 'border-gray-300 bg-gray-100/60 cursor-default opacity-60' 
                          : isClosedDate 
                          ? 'border-red-400 bg-red-100/60 shadow-red-200/50 shadow-md hover:bg-sand-beige/40 cursor-pointer' 
                          : isToday(day) 
                          ? 'border-copper bg-sand-beige/60 shadow hover:bg-sand-beige/40 cursor-pointer' 
                          : 'border-transparent bg-white/40 hover:bg-sand-beige/40 cursor-pointer'}
                        ${selectedDate && isSameDay(day, selectedDate) ? 'ring-2 ring-copper' : ''}
                        ${isClosedDate && !isPastDate ? 'opacity-80' : ''}
                      `}
                      onClick={() => !isPastDate && setSelectedDate(day)}
                      title={isPastDate 
                        ? 'Past date' 
                        : isClosedDate 
                        ? 'This date is closed for reservations' 
                        : `${capacity.totalUsed}/${capacity.totalCapacity} seats (${capacity.percentage.toFixed(0)}% full)`}
                    >
                      {/* Water Fill Background using theme copper colors - only for future dates */}
                      {!isPastDate && (
                        <>
                          <div 
                            className="absolute inset-0 bg-gradient-to-t from-copper/40 via-copper/30 to-copper/10 transition-all duration-700 ease-out rounded-xl"
                            style={{
                              transform: `translateY(${100 - capacity.percentage}%)`,
                              opacity: capacity.percentage > 0 ? 0.8 : 0
                            }}
                          />
                          
                          {/* Enhanced fill for high capacity */}
                          {capacity.percentage > 80 && (
                            <div className="absolute inset-0 bg-gradient-to-t from-amber-600/50 via-amber-500/40 to-amber-400/20 animate-pulse rounded-xl" />
                          )}
                          
                          {/* Over capacity warning */}
                          {capacity.percentage >= 100 && (
                            <div className="absolute inset-0 bg-gradient-to-t from-red-500/60 via-red-400/50 to-red-300/30 animate-pulse rounded-xl" />
                          )}
                        </>
                      )}
                      
                      {/* Content - positioned above the water fill */}
                      <div className="relative z-10 flex flex-col items-center justify-center">
                        <span className={`font-playfair text-lg font-semibold ${
                          isPastDate ? 'text-gray-500' 
                          : isClosedDate ? 'text-red-700' 
                          : 'text-ink-black'
                        }`}>
                          {format(day, 'd')}
                        </span>
                        

                        
                        {/* Closed date indicator */}
                        {isClosedDate && !isPastDate && (
                          <div className="text-red-600 text-lg mt-1">
                            🚫
                          </div>
                        )}
                        
                        {/* Simple capacity info - only show if not closed and not past */}
                        {!isClosedDate && !isPastDate && (
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-xs text-copper font-medium">{reservationsForDay.filter(r => r.status !== 'cancelled' && r.status !== 'pending').length}</span>
                            <div className="flex items-center gap-0.5">
                              {hasPending && <div className="w-2 h-2 bg-red-500 rounded-full"></div>}
                              {hasConfirmed && <div className="w-2 h-2 bg-green-500 rounded-full"></div>}
                            </div>
                          </div>
                        )}
                        
                        {/* For past dates, show reservation count if any */}
                        {isPastDate && reservationsForDay.filter(r => r.status !== 'cancelled' && r.status !== 'pending').length > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-xs text-gray-500 font-medium">{reservationsForDay.filter(r => r.status !== 'cancelled' && r.status !== 'pending').length}</span>
                            <div className="flex items-center gap-0.5">
                              {hasPending && <div className="w-2 h-2 bg-gray-400 rounded-full"></div>}
                              {hasConfirmed && <div className="w-2 h-2 bg-gray-500 rounded-full"></div>}
                            </div>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Daily Reservations List - Right Side */}
          <div className="lg:col-span-2">
            {/* Primary Action - New Reservation */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <h2 className="text-lg sm:text-xl font-playfair text-copper">{t.reservationManagementDashboard}</h2>
              <button
                onClick={() => setShowNewReservationForm(true)}
                className="group relative bg-gradient-to-r from-emerald-600 to-green-600 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-2xl hover:from-emerald-700 hover:to-green-700 transition-all duration-300 font-bold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-center text-base sm:text-lg"
              >
                <span className="text-xl sm:text-2xl">+</span>
                <span>{t.newReservation}</span>
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </button>
            </div>

            {/* Search and Filter Controls - Always visible */}
            <div className="flex flex-col gap-4 mb-4 sm:mb-6">
              <div className="flex flex-col gap-4">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-copper/60 text-lg">🔍</span>
                  </div>
                  <input
                    type="text"
                    placeholder={t.searchAllReservations}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-12 pr-4 py-3 w-full rounded-xl border border-white/20 bg-white/50 backdrop-blur-sm focus:ring-2 focus:ring-copper/20 focus:border-copper/20 transition-all duration-300 placeholder:text-charcoal/40 text-sm sm:text-base"
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-3 rounded-xl border border-white/20 bg-white/50 backdrop-blur-sm focus:ring-2 focus:ring-copper/20 focus:border-copper/20 transition-all duration-300 text-charcoal w-full sm:min-w-[150px] text-sm sm:text-base"
                  >
                    <option value="all">{t.allStatuses}</option>
                                          {RESERVATION_STATUSES.map(status => (
                        <option key={status.value} value={status.value}>
                          {t[status.labelKey as keyof typeof t]}
                        </option>
                      ))}
                  </select>
                  <label className="flex items-center gap-2 px-4 py-3 rounded-xl border border-white/20 bg-white/50 backdrop-blur-sm cursor-pointer hover:bg-white/60 transition-all duration-300 w-full sm:w-auto justify-center sm:justify-start">
                    <input
                      type="checkbox"
                      checked={showCancelled}
                      onChange={(e) => setShowCancelled(e.target.checked)}
                      className="form-checkbox h-5 w-5 text-copper rounded border-copper/20 focus:ring-copper"
                    />
                    <span className="text-charcoal text-sm sm:text-base">{t.showCancelled}</span>
                  </label>
                  <label className="flex items-center gap-2 px-4 py-3 rounded-xl border border-white/20 bg-white/50 backdrop-blur-sm cursor-pointer hover:bg-white/60 transition-all duration-300 w-full sm:w-auto justify-center sm:justify-start">
                    <input
                      type="checkbox"
                      checked={showPending}
                      onChange={(e) => setShowPending(e.target.checked)}
                      className="form-checkbox h-5 w-5 text-copper rounded border-copper/20 focus:ring-copper"
                    />
                    <span className="text-charcoal text-sm sm:text-base">{t.showPending}</span>
                  </label>
                </div>
              </div>
            </div>

            {searchTerm.trim() ? (
              <>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
                  <h3 className="text-xl font-playfair text-copper mb-4 md:mb-0">
                    Search Results ({searchResults.length} found)
                  </h3>
                </div>

                {/* Search Results List */}
                <div className="space-y-4">
                  {searchResults.map((reservation) => (
                    <div 
                      key={reservation.id} 
                      className="group relative p-4 rounded-xl bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-all duration-300 ease-out border border-white/10 cursor-pointer shadow-lg hover:shadow-xl"
                      onClick={() => setExpandedCard(expandedCard === reservation.id ? null : reservation.id)}
                    >
                      {/* Compact View - Always Visible */}
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-4 mb-2">
                            <div className="font-playfair text-lg text-ink-black font-semibold">{reservation.customer_name}</div>
                            <div className={`px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
                              reservation.type === 'omakase' 
                                ? 'bg-purple-100 text-purple-800' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              <span>{reservation.type === 'omakase' ? '🍣' : '🍽️'}</span>
                              <span>{reservation.type === 'omakase' ? 'Omakase' : 'Dining'}</span>
                            </div>
                            <div className="text-copper text-sm font-semibold">
                              📅 {format(parseLocalDate(reservation.reservation_date), 'MMM d')}
                            </div>
                            <div className="text-charcoal text-sm">
                              👥 <span className="font-semibold">{reservation.party_size}</span>
                            </div>
                            {reservation.special_requests && (
                              <div className="bg-amber-100 text-amber-800 px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                                <span>⚠️</span>
                                <span>Special Request</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${RESERVATION_STATUSES.find(s => s.value === reservation.status)?.color || 'bg-gray-100 text-gray-800'}`}>
                              {getStatusLabel(reservation.status)}
                            </span>
                            <span className="text-copper font-mono text-lg font-bold">{reservation.reservation_time}</span>
                          </div>
                        </div>

                        {/* Action Buttons - Always Visible */}
                        <div className="flex flex-wrap gap-2 ml-4">
                          {reservation.status === 'pending' && (
                            <button
                              className="group relative bg-gradient-to-r from-emerald-600 to-green-600 text-white px-4 py-2 rounded-xl hover:from-emerald-700 hover:to-green-700 transition-all duration-300 font-semibold text-sm shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-1"
                              onClick={async (e) => {
                                e.stopPropagation();
                                await handleStatusChange(reservation.id, 'confirmed');
                              }}
                            >
                              <span className="text-sm">✓</span>
                              <span>Confirm</span>
                              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            </button>
                          )}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditReservation(reservation);
                            }}
                            className="group relative liquid-glass bg-gradient-to-r from-copper/80 to-amber-600/80 text-white px-4 py-2 rounded-xl hover:from-copper hover:to-amber-700 transition-all duration-300 font-semibold text-sm shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-1 backdrop-blur-sm border border-white/20"
                          >
                            <span className="text-sm">✏️</span>
                            <span>Edit</span>
                            <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-sand-beige/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                          </button>

                          {reservation.status !== 'cancelled' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setCancellingReservation(reservation);
                                setCancellationReason('');
                                setShowCancelModal(true);
                              }}
                              className="group relative liquid-glass bg-gradient-to-r from-red-400/80 to-rose-500/80 text-white px-4 py-2 rounded-xl hover:from-red-500 hover:to-rose-600 transition-all duration-300 font-semibold text-sm shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-1 backdrop-blur-sm border border-white/20"
                            >
                              <span className="text-sm">✕</span>
                              <span>Cancel</span>
                              <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-sand-beige/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            </button>
                          )}

                          {/* Status Change Dropdown */}
                          <select
                            value={reservation.status}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleStatusChange(reservation.id, e.target.value);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="px-3 py-2 border-2 border-copper/30 rounded-xl text-xs focus:ring-2 focus:ring-copper/50 focus:border-copper transition-all duration-300 liquid-glass bg-sand-beige/60 backdrop-blur-sm shadow-lg hover:shadow-xl font-semibold transform hover:-translate-y-0.5 text-ink-black hover:bg-sand-beige/80"
                          >
                            {RESERVATION_STATUSES.map(status => (
                              <option key={status.value} value={status.value}>{t[status.labelKey as keyof typeof t]}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Expanded Details - Show on Hover/Click */}
                      {expandedCard === reservation.id && (
                        <div className="mt-4 pt-4 border-t border-copper/20 animate-in slide-in-from-top-2 duration-200">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-charcoal">
                            <div>
                              <span className="font-semibold text-copper">{t.email}:</span> {reservation.customer_email}
                            </div>
                            <div>
                              <span className="font-semibold text-copper">{t.phone}:</span> {reservation.customer_phone}
                            </div>
                            <div>
                              <span className="font-semibold text-copper">{t.confirmation}:</span> <span className="font-mono">{reservation.confirmation_code}</span>
                            </div>
                            <div>
                              <span className="font-semibold text-copper">{t.revenue}:</span> ${reservation.party_size * (reservation.type === 'omakase' ? 99 : 40)}
                            </div>
                            <div>
                              <span className="font-semibold text-copper">{t.created}:</span> {format(new Date(reservation.created_at), 'MMM d, yyyy')}
                            </div>
                            {/* Payment Information for Omakase */}
                            {reservation.type === 'omakase' && reservation.payment_status && (
                              <>
                                <div>
                                  <span className="font-semibold text-copper">{t.paymentStatus}:</span>{' '}
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                    reservation.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                                    reservation.payment_status === 'refunded' ? 'bg-blue-100 text-blue-800' :
                                    reservation.payment_status === 'partially_refunded' ? 'bg-yellow-100 text-yellow-800' :
                                    reservation.payment_status === 'failed' ? 'bg-red-100 text-red-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {t[reservation.payment_status as keyof typeof t] || reservation.payment_status}
                                  </span>
                                </div>
                                {reservation.prepayment_amount && (
                                  <div>
                                    <span className="font-semibold text-copper">{t.paymentAmount}:</span> ${(reservation.prepayment_amount / 100).toFixed(2)}
                                    {reservation.prepayment_tax_amount && (
                                      <span className="text-xs text-gray-600 ml-2">
                                        (Base: ${(reservation.prepayment_base_price! / 100).toFixed(2)} + Tax: ${(reservation.prepayment_tax_amount / 100).toFixed(2)})
                                      </span>
                                    )}
                                  </div>
                                )}
                                {reservation.prepaid_at && (
                                  <div>
                                    <span className="font-semibold text-copper">{t.paymentDate}:</span> {format(new Date(reservation.prepaid_at), 'MMM d, yyyy h:mm a')}
                                  </div>
                                )}
                              </>
                            )}
                          </div>

                          {/* Refund Button for Paid Omakase Reservations */}
                          {reservation.type === 'omakase' && 
                           reservation.payment_status === 'paid' && 
                           reservation.stripe_charge_id &&
                           (reservation.status === 'cancelled' || reservation.status === 'no-show') && (
                            <div className="mt-4 flex justify-end">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRefund(reservation);
                                }}
                                className="group relative liquid-glass bg-gradient-to-r from-blue-500/80 to-indigo-600/80 text-white px-4 py-2 rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 font-semibold text-sm shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2 backdrop-blur-sm border border-white/20"
                              >
                                <span>💸</span>
                                <span>{t.refundButton}</span>
                                <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-sand-beige/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                              </button>
                            </div>
                          )}

                          {/* View Communications Button */}
                          <div className="mt-4 flex justify-end">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setCommunicationReservation(reservation);
                                setShowCommunicationModal(true);
                              }}
                              className="group relative liquid-glass bg-gradient-to-r from-purple-500/80 to-indigo-600/80 text-white px-4 py-2 rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-300 font-semibold text-sm shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-1 backdrop-blur-sm border border-white/20"
                            >
                              <span className="text-sm">📧</span>
                              <span>{t.viewCommunications}</span>
                              <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-sand-beige/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            </button>
                          </div>

                          {reservation.special_requests && (
                            <div className="mt-3 p-3 bg-white/30 rounded-lg">
                              <span className="font-semibold text-copper">{t.specialRequests}:</span>
                              <p className="mt-1 text-charcoal">{reservation.special_requests}</p>
                            </div>
                          )}

                          {reservation.notes && (
                            <div className="mt-3 p-3 bg-white/30 rounded-lg">
                              <span className="font-semibold text-copper">{t.internalNotes}:</span>
                              <p className="mt-1 text-charcoal">{reservation.notes}</p>
                            </div>
                          )}

                          {reservation.cancellation_reason && (
                            <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                              <span className="font-semibold text-red-600">{t.cancellationReason}:</span>
                              <p className="mt-1 text-red-600">{reservation.cancellation_reason}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : selectedDate ? (
              <>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
                  <h3 className="text-xl font-playfair text-copper mb-4 md:mb-0">
                    {format(selectedDate, 'MMMM d, yyyy')}
                  </h3>
                </div>

                {/* Reservations List */}
                <div className="space-y-4">
                  {calendarReservations[format(selectedDate, 'yyyy-MM-dd')] ? (
                    filteredReservations(calendarReservations[format(selectedDate, 'yyyy-MM-dd')]).map((reservation) => (
                      <div 
                        key={reservation.id} 
                        className="group relative p-4 rounded-xl bg-sand-beige/40 hover:bg-sand-beige/60 transition-all duration-300 ease-out border border-white/20 cursor-pointer"
                        onClick={() => setExpandedCard(expandedCard === reservation.id ? null : reservation.id)}
                      >
                        {/* Compact View - Always Visible */}
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-4 mb-2">
                              <div className="font-playfair text-lg text-ink-black font-semibold">{reservation.customer_name}</div>
                              <div className={`px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
                                reservation.type === 'omakase' 
                                  ? 'bg-purple-100 text-purple-800' 
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                <span>{reservation.type === 'omakase' ? '🍣' : '🍽️'}</span>
                                <span>{reservation.type === 'omakase' ? 'Omakase' : 'Dining'}</span>
                              </div>
                              <div className="text-copper text-sm font-semibold">
                                📅 {format(parseLocalDate(reservation.reservation_date), 'MMM d')}
                              </div>
                              <div className="text-charcoal text-sm">
                                👥 <span className="font-semibold">{reservation.party_size}</span>
                              </div>
                              {reservation.special_requests && (
                                <div className="bg-amber-100 text-amber-800 px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                                  <span>⚠️</span>
                                  <span>Special Request</span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${RESERVATION_STATUSES.find(s => s.value === reservation.status)?.color || 'bg-gray-100 text-gray-800'}`}>
                                {getStatusLabel(reservation.status)}
                              </span>
                              <span className="text-copper font-mono text-lg font-bold">{reservation.reservation_time}</span>
                            </div>
                          </div>

                          {/* Action Buttons - Always Visible */}
                          <div className="flex flex-wrap gap-2 ml-4">
                            {reservation.status === 'pending' && (
                              <button
                                className="group relative bg-gradient-to-r from-emerald-600 to-green-600 text-white px-4 py-2 rounded-xl hover:from-emerald-700 hover:to-green-700 transition-all duration-300 font-semibold text-sm shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-1"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await handleStatusChange(reservation.id, 'confirmed');
                                }}
                              >
                                <span className="text-sm">✓</span>
                                <span>Confirm</span>
                                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                              </button>
                            )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditReservation(reservation);
                              }}
                              className="group relative liquid-glass bg-gradient-to-r from-copper/80 to-amber-600/80 text-white px-4 py-2 rounded-xl hover:from-copper hover:to-amber-700 transition-all duration-300 font-semibold text-sm shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-1 backdrop-blur-sm border border-white/20"
                            >
                              <span className="text-sm">✏️</span>
                              <span>Edit</span>
                              <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-sand-beige/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            </button>

                            {reservation.status !== 'cancelled' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCancellingReservation(reservation);
                                  setCancellationReason('');
                                  setShowCancelModal(true);
                                }}
                                className="group relative liquid-glass bg-gradient-to-r from-red-400/80 to-rose-500/80 text-white px-4 py-2 rounded-xl hover:from-red-500 hover:to-rose-600 transition-all duration-300 font-semibold text-sm shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-1 backdrop-blur-sm border border-white/20"
                              >
                                <span className="text-sm">✕</span>
                                <span>Cancel</span>
                                <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-sand-beige/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                              </button>
                            )}

                            {/* Status Change Dropdown */}
                            <select
                              value={reservation.status}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleStatusChange(reservation.id, e.target.value);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="px-3 py-2 border-2 border-copper/30 rounded-xl text-xs focus:ring-2 focus:ring-copper/50 focus:border-copper transition-all duration-300 liquid-glass bg-sand-beige/60 backdrop-blur-sm shadow-lg hover:shadow-xl font-semibold transform hover:-translate-y-0.5 text-ink-black hover:bg-sand-beige/80"
                            >
                              {RESERVATION_STATUSES.map(status => (
                                <option key={status.value} value={status.value}>{t[status.labelKey as keyof typeof t]}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Expanded Details - Show on Hover/Click */}
                        {expandedCard === reservation.id && (
                          <div className="mt-4 pt-4 border-t border-copper/20 animate-in slide-in-from-top-2 duration-200">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-charcoal">
                              <div>
                                <span className="font-semibold text-copper">{t.email}:</span> {reservation.customer_email}
                              </div>
                              <div>
                                <span className="font-semibold text-copper">{t.phone}:</span> {reservation.customer_phone}
                              </div>
                              <div>
                                <span className="font-semibold text-copper">{t.confirmation}:</span> <span className="font-mono">{reservation.confirmation_code}</span>
                              </div>
                              <div>
                                <span className="font-semibold text-copper">{t.revenue}:</span> ${reservation.party_size * (reservation.type === 'omakase' ? 99 : 40)}
                              </div>
                              <div>
                                <span className="font-semibold text-copper">{t.created}:</span> {format(new Date(reservation.created_at), 'MMM d, yyyy')}
                              </div>
                              {/* Payment Information for Omakase */}
                              {reservation.type === 'omakase' && reservation.payment_status && (
                                <>
                                  <div>
                                    <span className="font-semibold text-copper">{t.paymentStatus}:</span>{' '}
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                      reservation.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                                      reservation.payment_status === 'refunded' ? 'bg-blue-100 text-blue-800' :
                                      reservation.payment_status === 'partially_refunded' ? 'bg-yellow-100 text-yellow-800' :
                                      reservation.payment_status === 'failed' ? 'bg-red-100 text-red-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>
                                      {t[reservation.payment_status as keyof typeof t] || reservation.payment_status}
                                    </span>
                                  </div>
                                  {reservation.prepayment_amount && (
                                    <div>
                                      <span className="font-semibold text-copper">{t.paymentAmount}:</span> ${(reservation.prepayment_amount / 100).toFixed(2)}
                                      {reservation.prepayment_tax_amount && (
                                        <span className="text-xs text-gray-600 ml-2">
                                          (Base: ${(reservation.prepayment_base_price! / 100).toFixed(2)} + Tax: ${(reservation.prepayment_tax_amount / 100).toFixed(2)})
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {reservation.prepaid_at && (
                                    <div>
                                      <span className="font-semibold text-copper">{t.paymentDate}:</span> {format(new Date(reservation.prepaid_at), 'MMM d, yyyy h:mm a')}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>

                            {/* Refund Button for Paid Omakase Reservations */}
                            {reservation.type === 'omakase' && 
                             reservation.payment_status === 'paid' && 
                             reservation.stripe_charge_id &&
                             (reservation.status === 'cancelled' || reservation.status === 'no-show') && (
                              <div className="mt-4 flex justify-end">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRefund(reservation);
                                  }}
                                  className="group relative liquid-glass bg-gradient-to-r from-blue-500/80 to-indigo-600/80 text-white px-4 py-2 rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 font-semibold text-sm shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2 backdrop-blur-sm border border-white/20"
                                >
                                  <span>💸</span>
                                  <span>{t.refundButton}</span>
                                  <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-sand-beige/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                </button>
                              </div>
                            )}

                            {/* Payment Information for Dining */}
                            {reservation.type === 'dining' && reservation.payment_method_saved && (
                              <div className="mt-3 p-3 bg-white/30 rounded-lg">
                                <span className="font-semibold text-copper">Payment Status:</span>
                                <div className="mt-2 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm">Payment Method Saved:</span>
                                    <span className="text-sm font-medium">✓ Yes</span>
                                  </div>
                                  {reservation.no_show_fee_charged && (
                                    <>
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm">No-Show Fee Charged:</span>
                                        <span className="text-sm font-medium text-red-600">
                                          ${((reservation.no_show_fee_amount || 0) / 100).toFixed(2)}
                                        </span>
                                      </div>
                                      {reservation.no_show_fee_charged_at && (
                                        <div className="flex items-center justify-between">
                                          <span className="text-sm">Charged At:</span>
                                          <span className="text-sm">{format(new Date(reservation.no_show_fee_charged_at), 'MMM d, h:mm a')}</span>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* No-Show Charge Button for Dining Reservations */}
                            {reservation.type === 'dining' && 
                             reservation.status === 'no-show' && 
                             reservation.payment_method_saved &&
                             !reservation.no_show_fee_charged && (
                              <div className="mt-4 flex justify-end gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDiningNoShowCharge(reservation);
                                  }}
                                  className="group relative liquid-glass bg-gradient-to-r from-red-500/80 to-rose-600/80 text-white px-4 py-2 rounded-xl hover:from-red-600 hover:to-rose-700 transition-all duration-300 font-semibold text-sm shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2 backdrop-blur-sm border border-white/20"
                                >
                                  <span>💳</span>
                                  <span>Charge No-Show Fee</span>
                                  <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-sand-beige/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                </button>
                              </div>
                            )}

                            {/* Refund Button for Charged Dining No-Show Fees */}
                            {reservation.type === 'dining' && 
                             reservation.no_show_fee_charged && 
                             reservation.stripe_charge_id && (
                              <div className="mt-4 flex justify-end">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDiningRefund(reservation);
                                  }}
                                  className="group relative liquid-glass bg-gradient-to-r from-blue-500/80 to-indigo-600/80 text-white px-4 py-2 rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 font-semibold text-sm shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2 backdrop-blur-sm border border-white/20"
                                >
                                  <span>💸</span>
                                  <span>Refund No-Show Fee</span>
                                  <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-sand-beige/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                </button>
                              </div>
                            )}

                            {/* View Communications Button */}
                            <div className="mt-4 flex justify-end">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCommunicationReservation(reservation);
                                  setShowCommunicationModal(true);
                                }}
                                className="group relative liquid-glass bg-gradient-to-r from-purple-500/80 to-indigo-600/80 text-white px-4 py-2 rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-300 font-semibold text-sm shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-1 backdrop-blur-sm border border-white/20"
                              >
                                <span className="text-sm">📧</span>
                                <span>{t.viewCommunications}</span>
                                <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-sand-beige/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                              </button>
                            </div>

                            {reservation.special_requests && (
                              <div className="mt-3 p-3 bg-white/30 rounded-lg">
                                <span className="font-semibold text-copper">{t.specialRequests}:</span>
                                <p className="mt-1 text-charcoal">{reservation.special_requests}</p>
                              </div>
                            )}

                            {reservation.notes && (
                              <div className="mt-3 p-3 bg-white/30 rounded-lg">
                                <span className="font-semibold text-copper">{t.internalNotes}:</span>
                                <p className="mt-1 text-charcoal">{reservation.notes}</p>
                              </div>
                            )}

                            {reservation.cancellation_reason && (
                              <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                                <span className="font-semibold text-red-600">{t.cancellationReason}:</span>
                                <p className="mt-1 text-red-600">{reservation.cancellation_reason}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-charcoal/60">
                      {t.noReservationsForDate}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-charcoal/60">
                {t.selectDateToView}
              </div>
            )}


          </div>
        </div>

        {/* Stats Cards - Moved After Calendar/Reservations */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-12">
          <div className="group relative liquid-glass p-4 sm:p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 wabi-sabi-border overflow-hidden transform hover:-translate-y-0.5">
            <div className="absolute top-0 right-0 w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-copper/20 to-transparent rounded-full transform translate-x-4 sm:translate-x-6 -translate-y-4 sm:-translate-y-6"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs sm:text-sm font-semibold text-copper">{t.todayReservations}</h3>
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-copper/20 to-copper/10 rounded-lg flex items-center justify-center">
                  <span className="text-sm sm:text-lg">📅</span>
                </div>
              </div>
              <div className="flex items-end justify-between mb-2">
                <p className="text-2xl sm:text-3xl font-bold text-ink-black">{stats.todayReservations}</p>
                <TrendChart 
                  data={stats.dailyTrend} 
                  width={40} 
                  height={16}
                  className="mb-1 sm:w-[50px] sm:h-[20px]"
                />
              </div>
              <p className="text-xs text-charcoal/60 hidden sm:block">Active reservations • Yesterday → Today → Tomorrow</p>
              <p className="text-xs text-charcoal/60 sm:hidden">{t.daily}</p>
            </div>
          </div>
          
          <div className="group relative liquid-glass p-4 sm:p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 wabi-sabi-border overflow-hidden transform hover:-translate-y-0.5">
            <div className="absolute top-0 right-0 w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-emerald-500/20 to-transparent rounded-full transform translate-x-4 sm:translate-x-6 -translate-y-4 sm:-translate-y-6"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs sm:text-sm font-semibold text-copper">{t.weekReservations}</h3>
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 rounded-lg flex items-center justify-center">
                  <span className="text-sm sm:text-lg">📊</span>
                </div>
              </div>
              <div className="flex items-end justify-between mb-2">
                <p className="text-2xl sm:text-3xl font-bold text-ink-black">{stats.weekReservations}</p>
                <TrendChart 
                  data={stats.weeklyTrend} 
                  width={40} 
                  height={16}
                  className="mb-1 sm:w-[50px] sm:h-[20px]"
                />
              </div>
              <p className="text-xs text-charcoal/60 hidden sm:block">Weekly bookings • Last → This → Next Week</p>
              <p className="text-xs text-charcoal/60 sm:hidden">{t.weekly}</p>
            </div>
          </div>
          
          <div className="group relative liquid-glass p-4 sm:p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 wabi-sabi-border overflow-hidden transform hover:-translate-y-0.5">
            <div className="absolute top-0 right-0 w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-amber-500/20 to-transparent rounded-full transform translate-x-4 sm:translate-x-6 -translate-y-4 sm:-translate-y-6"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs sm:text-sm font-semibold text-copper">{t.totalRevenue}</h3>
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-amber-500/20 to-amber-500/10 rounded-lg flex items-center justify-center">
                  <span className="text-sm sm:text-lg">💰</span>
                </div>
              </div>
              <div className="flex items-end justify-between mb-2">
                <p className="text-xl sm:text-3xl font-bold text-ink-black">${stats.totalRevenue.toLocaleString()}</p>
                <TrendChart 
                  data={stats.revenueTrend} 
                  width={40} 
                  height={16}
                  className="mb-1 sm:w-[50px] sm:h-[20px]"
                />
              </div>
              <p className="text-xs text-charcoal/60 hidden sm:block">Confirmed bookings • Weekly revenue trend</p>
              <p className="text-xs text-charcoal/60 sm:hidden">{t.totalRevenue}</p>
            </div>
          </div>
          
          <div className="group relative liquid-glass p-4 sm:p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 wabi-sabi-border overflow-hidden transform hover:-translate-y-0.5">
            <div className="absolute top-0 right-0 w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-purple-500/20 to-transparent rounded-full transform translate-x-4 sm:translate-x-6 -translate-y-4 sm:-translate-y-6"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs sm:text-sm font-semibold text-copper">{t.avgPartySize}</h3>
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-purple-500/20 to-purple-500/10 rounded-lg flex items-center justify-center">
                  <span className="text-sm sm:text-lg">👥</span>
                </div>
              </div>
              <div className="flex items-end justify-between mb-2">
                <p className="text-2xl sm:text-3xl font-bold text-ink-black">{stats.avgPartySize}</p>
                <TrendChart 
                  data={stats.partySizeTrend} 
                  width={40} 
                  height={16}
                  className="mb-1 sm:w-[50px] sm:h-[20px]"
                />
              </div>
              <p className="text-xs text-charcoal/60 hidden sm:block">People per table • Weekly average trend</p>
              <p className="text-xs text-charcoal/60 sm:hidden">{t.avgPartySize}</p>
            </div>
          </div>
        </section>

        {/* System Status */}
        <section className="liquid-glass p-4 sm:p-8 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-500 wabi-sabi-border transform hover:-translate-y-1">
          <h3 className="elegant-subtitle text-copper mb-4 sm:mb-6 text-lg sm:text-xl">{t.systemStatus}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-white/40 rounded-xl">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-ink-black font-medium text-sm sm:text-base">{t.database}</span>
              <span className="font-bold text-green-600 ml-auto text-sm sm:text-base">{t.connected}</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-white/40 rounded-xl">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-ink-black font-medium text-sm sm:text-base">{t.emailService}</span>
              <span className="font-bold text-green-600 ml-auto text-sm sm:text-base">{t.active}</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-white/40 rounded-xl">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-ink-black font-medium text-sm sm:text-base">{t.apiStatus}</span>
              <span className="font-bold text-green-600 ml-auto text-sm sm:text-base">{t.healthy}</span>
            </div>
          </div>
        </section>
      </main>

      {/* Edit Reservation Modal */}
      {editingReservation && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-gradient-to-br from-sand-beige/95 to-white/90 backdrop-blur-xl rounded-3xl p-4 sm:p-8 max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl border border-copper/20">
            <div className="flex items-center justify-between mb-4 sm:mb-8">
              <h2 className="text-xl sm:text-3xl font-playfair text-copper">{t.editReservation}</h2>
              <button
                onClick={() => setEditingReservation(null)}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-sand-beige/60 hover:bg-sand-beige/80 flex items-center justify-center transition-colors duration-200"
              >
                <span className="text-gray-600 text-sm sm:text-base">✕</span>
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-ink-black mb-2 sm:mb-3">{t.customerName}</label>
                <input
                  type="text"
                  value={editingReservation.customer_name}
                  onChange={(e) => setEditingReservation({...editingReservation, customer_name: e.target.value})}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-copper/20 rounded-xl focus:ring-2 focus:ring-copper focus:border-copper transition-all duration-300 bg-sand-beige/40 text-ink-black placeholder:text-gray-500 text-sm sm:text-base"
                />
              </div>
              
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-ink-black mb-2 sm:mb-3">{t.customerEmail}</label>
                <input
                  type="email"
                  value={editingReservation.customer_email}
                  onChange={(e) => setEditingReservation({...editingReservation, customer_email: e.target.value})}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-copper/20 rounded-xl focus:ring-2 focus:ring-copper focus:border-copper transition-all duration-300 bg-sand-beige/40 text-ink-black placeholder:text-gray-500 text-sm sm:text-base"
                />
              </div>
              
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-ink-black mb-2 sm:mb-3">{t.customerPhone}</label>
                <input
                  type="tel"
                  value={editingReservation.customer_phone}
                  onChange={(e) => setEditingReservation({...editingReservation, customer_phone: e.target.value})}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-copper/20 rounded-xl focus:ring-2 focus:ring-copper focus:border-copper transition-all duration-300 bg-sand-beige/40 text-ink-black placeholder:text-gray-500 text-sm sm:text-base"
                />
              </div>
              
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-ink-black mb-2 sm:mb-3">{t.partySize}</label>
                <input
                  type="number"
                  min="1"
                  max="15"
                  value={editingReservation.party_size}
                  onChange={(e) => setEditingReservation({...editingReservation, party_size: parseInt(e.target.value)})}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-copper/20 rounded-xl focus:ring-2 focus:ring-copper focus:border-copper transition-all duration-300 bg-sand-beige/40 text-ink-black placeholder:text-gray-500 text-sm sm:text-base"
                />
              </div>
              
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-ink-black mb-2 sm:mb-3">{t.reservationDate}</label>
                <input
                  type="date"
                  value={editingReservation.reservation_date}
                  onChange={(e) => setEditingReservation({...editingReservation, reservation_date: e.target.value})}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-copper/20 rounded-xl focus:ring-2 focus:ring-copper focus:border-copper transition-all duration-300 bg-sand-beige/40 text-ink-black text-sm sm:text-base"
                />
              </div>
              
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-ink-black mb-2 sm:mb-3">{t.reservationTime}</label>
                <select
                  value={editingReservation.reservation_time}
                  onChange={(e) => setEditingReservation({...editingReservation, reservation_time: e.target.value})}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-copper/20 rounded-xl focus:ring-2 focus:ring-copper focus:border-copper transition-all duration-300 bg-sand-beige/40 text-ink-black text-sm sm:text-base"
                >
                  {getAvailableTimeSlots().map(time => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="mb-4 sm:mb-6">
              <label className="block text-xs sm:text-sm font-semibold text-ink-black mb-2 sm:mb-3">{t.specialRequestsLabel}</label>
              <textarea
                value={editingReservation.special_requests}
                onChange={(e) => setEditingReservation({...editingReservation, special_requests: e.target.value})}
                rows={3}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-copper/20 rounded-xl focus:ring-2 focus:ring-copper focus:border-copper transition-all duration-300 bg-sand-beige/40 text-ink-black placeholder:text-gray-500 text-sm sm:text-base"
                placeholder="Any special dietary requirements or requests..."
              />
            </div>
            
            <div className="mb-6 sm:mb-8">
              <label className="block text-xs sm:text-sm font-semibold text-ink-black mb-2 sm:mb-3">{t.internalNotesLabel}</label>
              <textarea
                value={editingReservation.notes}
                onChange={(e) => setEditingReservation({...editingReservation, notes: e.target.value})}
                rows={2}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-copper/20 rounded-xl focus:ring-2 focus:ring-copper focus:border-copper transition-all duration-300 bg-sand-beige/40 text-ink-black placeholder:text-gray-500 text-sm sm:text-base"
                placeholder="Internal notes (not visible to customer)"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-end pt-4 sm:pt-6 border-t border-copper/20">
              <button
                onClick={() => setEditingReservation(null)}
                className="group relative px-4 sm:px-8 py-2 sm:py-3 border-2 border-gray-300 rounded-xl hover:border-gray-400 transition-all duration-300 font-semibold bg-white shadow-sm hover:shadow-md transform hover:-translate-y-0.5 text-sm sm:text-base order-2 sm:order-1"
              >
                <span>Cancel</span>
              </button>
              <button
                onClick={handleSaveEdit}
                className="group relative bg-gradient-to-r from-emerald-600 to-green-600 text-white px-4 sm:px-8 py-2 sm:py-3 rounded-xl hover:from-emerald-700 hover:to-green-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-sm sm:text-base order-1 sm:order-2"
              >
                <span>{t.saveChanges}</span>
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Reservation Modal */}
      {showNewReservationForm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-sand-beige/95 to-white/90 backdrop-blur-xl rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-copper/20">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-playfair text-copper">Create New Reservation</h2>
              <button
                onClick={() => setShowNewReservationForm(false)}
                className="w-10 h-10 rounded-full bg-sand-beige/60 hover:bg-sand-beige/80 flex items-center justify-center transition-colors duration-200"
              >
                <span className="text-gray-600">✕</span>
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div>
                <label className="block text-sm font-semibold text-ink-black mb-3">Customer Name *</label>
                <input
                  type="text"
                  value={newReservation.customer_name}
                  onChange={(e) => setNewReservation({...newReservation, customer_name: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-copper/20 rounded-xl focus:ring-2 focus:ring-copper focus:border-copper transition-all duration-300 bg-sand-beige/40 text-ink-black placeholder:text-gray-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-ink-black mb-3">
                  Email <span className="text-gray-500 font-normal">{t.emailOrPhoneRequired}</span>
                </label>
                <input
                  type="email"
                  value={newReservation.customer_email}
                  onChange={(e) => setNewReservation({...newReservation, customer_email: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-copper/20 rounded-xl focus:ring-2 focus:ring-copper focus:border-copper transition-all duration-300 bg-sand-beige/40 text-ink-black placeholder:text-gray-500"
                  placeholder="customer@email.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-ink-black mb-3">
                  Phone <span className="text-gray-500 font-normal">{t.emailOrPhoneRequired}</span>
                </label>
                <input
                  type="tel"
                  value={newReservation.customer_phone}
                  onChange={(e) => setNewReservation({...newReservation, customer_phone: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-copper/20 rounded-xl focus:ring-2 focus:ring-copper focus:border-copper transition-all duration-300 bg-sand-beige/40 text-ink-black placeholder:text-gray-500"
                  placeholder="(555) 123-4567"
                />
                {/* Contact validation indicator */}
                {!newReservation.customer_email && !newReservation.customer_phone && (
                  <p className="text-xs text-red-500 mt-1">{t.contactRequired}</p>
                )}
                {(newReservation.customer_email || newReservation.customer_phone) && (
                  <p className="text-xs text-green-600 mt-1">
                    {t.contactProvided} {newReservation.customer_email ? 'Email' : ''}{newReservation.customer_email && newReservation.customer_phone ? ' & ' : ''}{newReservation.customer_phone ? 'Phone' : ''}
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-ink-black mb-3">Party Size *</label>
                <input
                  type="number"
                  min="1"
                  max="15"
                  value={newReservation.party_size}
                  onChange={(e) => setNewReservation({...newReservation, party_size: parseInt(e.target.value)})}
                  className="w-full px-4 py-3 border-2 border-copper/20 rounded-xl focus:ring-2 focus:ring-copper focus:border-copper transition-all duration-300 bg-sand-beige/40 text-ink-black placeholder:text-gray-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-ink-black mb-3">Reservation Type *</label>
                <select
                  value={newReservation.type}
                  onChange={(e) => setNewReservation({...newReservation, type: e.target.value as 'omakase' | 'dining'})}
                  className="w-full px-4 py-3 border-2 border-copper/20 rounded-xl focus:ring-2 focus:ring-copper focus:border-copper transition-all duration-300 bg-sand-beige/40 text-ink-black"
                  required
                >
                  <option value="omakase">Omakase ($99/person • 11-course tasting menu)</option>
                  <option value="dining">À la Carte Dining (Flexible pricing • Menu selection)</option>
                </select>
                <p className="text-xs text-charcoal/60 mt-2">
                  {newReservation.type === 'omakase' 
                    ? 'Premium 11-course tasting experience with Sichuan flavors' 
                    : 'Traditional dining with full à la carte menu options'}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-ink-black mb-3">Date *</label>
                <input
                  type="date"
                  value={newReservation.reservation_date}
                  onChange={(e) => setNewReservation({...newReservation, reservation_date: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-copper/20 rounded-xl focus:ring-2 focus:ring-copper focus:border-copper transition-all duration-300 bg-sand-beige/40 text-ink-black"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-ink-black mb-3">Time *</label>
                <select
                  value={newReservation.reservation_time}
                  onChange={(e) => setNewReservation({...newReservation, reservation_time: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-copper/20 rounded-xl focus:ring-2 focus:ring-copper focus:border-copper transition-all duration-300 bg-sand-beige/40 text-ink-black"
                  required
                >
                  {getAvailableTimeSlots().map(time => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
                <p className="text-xs text-charcoal/60 mt-2">
                  {newReservation.type === 'omakase' 
                    ? 'Fixed time slots for omakase experience'
                    : `Dining duration: ${newReservation.party_size <= 4 ? '1 hour' : '1.5 hours'} (party of ${newReservation.party_size <= 4 ? '≤4' : '≥5'})`
                  }
                </p>
              </div>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-semibold text-ink-black mb-3">Special Requests</label>
              <textarea
                value={newReservation.special_requests}
                onChange={(e) => setNewReservation({...newReservation, special_requests: e.target.value})}
                rows={3}
                className="w-full px-4 py-3 border-2 border-copper/20 rounded-xl focus:ring-2 focus:ring-copper focus:border-copper transition-all duration-300 bg-sand-beige/40 text-ink-black placeholder:text-gray-500"
                placeholder="Any special dietary requirements or requests..."
              />
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-semibold text-ink-black mb-3">Internal Notes</label>
              <textarea
                value={newReservation.notes}
                onChange={(e) => setNewReservation({...newReservation, notes: e.target.value})}
                rows={2}
                className="w-full px-4 py-3 border-2 border-copper/20 rounded-xl focus:ring-2 focus:ring-copper focus:border-copper transition-all duration-300 bg-sand-beige/40 text-ink-black placeholder:text-gray-500"
                placeholder="Internal notes (not visible to customer)"
              />
            </div>
            
            <div className="flex gap-4 justify-end pt-6 border-t border-copper/20">
              <button
                onClick={() => setShowNewReservationForm(false)}
                className="group relative px-8 py-3 border-2 border-gray-300 rounded-xl hover:border-gray-400 transition-all duration-300 font-semibold bg-white shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
              >
                <span>Cancel</span>
              </button>
              <button
                onClick={handleCreateReservation}
                className="group relative bg-gradient-to-r from-emerald-600 to-green-600 text-white px-8 py-3 rounded-xl hover:from-emerald-700 hover:to-green-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-md"
                disabled={!newReservation.customer_name || (!newReservation.customer_email && !newReservation.customer_phone) || !newReservation.reservation_date}
              >
                <span>Create Reservation</span>
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div ref={settingsModalRef} className="bg-gradient-to-br from-sand-beige/95 to-white/90 backdrop-blur-xl rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-copper/20">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-playfair text-copper">{t.reservationSettings}</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="w-10 h-10 rounded-full bg-sand-beige/60 hover:bg-sand-beige/80 flex items-center justify-center transition-colors duration-200"
              >
                <span className="text-gray-600">✕</span>
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Language Toggle */}
              <div className="border border-copper/20 rounded-xl bg-white/30">
                <button
                  onClick={() => toggleSection('language')}
                  className="w-full p-4 flex items-center justify-between hover:bg-white/20 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🌐</span>
                    <h3 className="text-xl font-semibold text-ink-black">{t.language}</h3>
                  </div>
                  <span className={`text-copper transition-transform duration-200 ${expandedSections.language ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>
                
                {expandedSections.language && (
                  <div className="px-4 pb-4">
                    <p className="text-sm text-charcoal/70 mb-4">{t.languageDesc}</p>
                    <div className="flex items-center justify-between p-4 bg-white/50 rounded-xl border border-copper/10">
                      <div>
                        <h4 className="font-semibold text-ink-black">{t.language}</h4>
                        <p className="text-sm text-charcoal/60">
                          {language === 'en' ? 'English (Current)' : '中文 (当前)'}
                        </p>
                      </div>
                      <div className="flex bg-gray-200 rounded-full p-1">
                        <button
                          onClick={() => handleLanguageChange('en')}
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                            language === 'en' 
                              ? 'bg-copper text-white shadow-sm' 
                              : 'text-gray-600 hover:text-gray-800'
                          }`}
                        >
                          {t.english}
                        </button>
                        <button
                          onClick={() => handleLanguageChange('zh')}
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                            language === 'zh' 
                              ? 'bg-copper text-white shadow-sm' 
                              : 'text-gray-600 hover:text-gray-800'
                          }`}
                        >
                          {t.chinese}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Admin-only Settings */}
              {userRole === 'admin' && (
                <>
                  {/* Auto-Confirmation Settings */}
                  <div className="border border-copper/20 rounded-xl bg-white/30">
                <button
                  onClick={() => toggleSection('autoConfirmation')}
                  className="w-full p-4 flex items-center justify-between hover:bg-white/20 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">⚡</span>
                    <h3 className="text-xl font-semibold text-ink-black">{t.autoConfirmationSettings}</h3>
                  </div>
                  <span className={`text-copper transition-transform duration-200 ${expandedSections.autoConfirmation ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>
                
                {expandedSections.autoConfirmation && (
                  <div className="px-4 pb-4">
                    <p className="text-sm text-charcoal/70 mb-6">{t.autoConfirmDescription}</p>
                    
                    {!settingsLoaded ? (
                      <div className="flex items-center justify-center p-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-copper"></div>
                        <span className="ml-3 text-charcoal/60">{t.loadingSettings}</span>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 bg-white/50 rounded-xl border border-copper/10">
                          <div>
                            <h4 className="font-semibold text-ink-black">{t.omakaseReservations}</h4>
                            <p className="text-sm text-charcoal/60">{t.omakaseDesc}</p>
                            <p className="text-xs text-charcoal/50 mt-1">
                              {settings.autoConfirmOmakase ? t.autoConfirmed : t.requiresConfirmation}
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={settings.autoConfirmOmakase}
                              onChange={(e) => setSettings({...settings, autoConfirmOmakase: e.target.checked})}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-copper/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-copper"></div>
                          </label>
                        </div>
                        
                        <div className="flex items-center justify-between p-4 bg-white/50 rounded-xl border border-copper/10">
                          <div>
                            <h4 className="font-semibold text-ink-black">{t.diningReservations}</h4>
                            <p className="text-sm text-charcoal/60">{t.diningDesc}</p>
                            <p className="text-xs text-charcoal/50 mt-1">
                              {settings.autoConfirmDining ? t.autoConfirmed : t.requiresConfirmation}
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={settings.autoConfirmDining}
                              onChange={(e) => setSettings({...settings, autoConfirmDining: e.target.checked})}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-copper/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-copper"></div>
                          </label>
                        </div>
                        
                        {/* Save Button for Auto-Confirmation */}
                        <div className="flex justify-end pt-4 border-t border-copper/10 mt-4">
                          <button
                            onClick={saveAutoConfirmationSettings}
                            disabled={savingAutoConfirm || !settingsLoaded}
                            className={`group relative px-8 py-3 rounded-xl transition-all duration-300 font-semibold shadow-lg transform ${
                              (settingsLoaded && !savingAutoConfirm)
                                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 hover:shadow-xl hover:-translate-y-0.5' 
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            <span>{savingAutoConfirm ? t.loading : 'Save Auto-Confirmation'}</span>
                            {(settingsLoaded && !savingAutoConfirm) && (
                              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Seat Capacity Settings */}
              <div className="border border-copper/20 rounded-xl bg-white/30">
                <button
                  onClick={() => toggleSection('seatCapacity')}
                  className="w-full p-4 flex items-center justify-between hover:bg-white/20 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🪑</span>
                    <h3 className="text-xl font-semibold text-ink-black">{t.seatCapacitySettings}</h3>
                  </div>
                  <span className={`text-copper transition-transform duration-200 ${expandedSections.seatCapacity ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>
                
                {expandedSections.seatCapacity && (
                  <div className="px-4 pb-4">
                    <p className="text-sm text-charcoal/70 mb-6">{t.seatCapacityDescription}</p>
                    
                    {!capacityLoaded ? (
                      <div className="flex items-center justify-center p-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-copper"></div>
                        <span className="ml-3 text-charcoal/60">{t.loadingCapacitySettings}</span>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 bg-white/50 rounded-xl border border-copper/10">
                          <div className="flex-1 mr-4">
                            <h4 className="font-semibold text-ink-black mb-2">{t.omakaseCapacityLabel}</h4>
                            <p className="text-sm text-charcoal/60 mb-3">{t.omakaseDesc}</p>
                            <input
                              type="number"
                              min="1"
                              max="200"
                              value={seatCapacity.omakaseCapacity}
                              onChange={(e) => setSeatCapacity({...seatCapacity, omakaseCapacity: parseInt(e.target.value) || 1})}
                              className="w-24 px-3 py-2 border-2 border-copper/20 rounded-lg focus:ring-2 focus:ring-copper/20 focus:border-copper/20 transition-all duration-300 bg-white text-ink-black font-semibold text-center"
                            />
                            <span className="ml-2 text-sm text-charcoal/60">{t.capacityHelpText}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between p-4 bg-white/50 rounded-xl border border-copper/10">
                          <div className="flex-1 mr-4">
                            <h4 className="font-semibold text-ink-black mb-2">{t.diningCapacityLabel}</h4>
                            <p className="text-sm text-charcoal/60 mb-3">{t.diningDesc}</p>
                            <input
                              type="number"
                              min="1"
                              max="200"
                              value={seatCapacity.diningCapacity}
                              onChange={(e) => setSeatCapacity({...seatCapacity, diningCapacity: parseInt(e.target.value) || 1})}
                              className="w-24 px-3 py-2 border-2 border-copper/20 rounded-lg focus:ring-2 focus:ring-copper/20 focus:border-copper/20 transition-all duration-300 bg-white text-ink-black font-semibold text-center"
                            />
                            <span className="ml-2 text-sm text-charcoal/60">{t.capacityHelpText}</span>
                          </div>
                        </div>
                        
                        {/* Save Button for Seat Capacity */}
                        <div className="flex justify-end pt-4 border-t border-copper/10 mt-4">
                          <button
                            onClick={saveSeatCapacitySettings}
                            disabled={savingCapacity || !capacityLoaded}
                            className={`group relative px-8 py-3 rounded-xl transition-all duration-300 font-semibold shadow-lg transform ${
                              (capacityLoaded && !savingCapacity)
                                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 hover:shadow-xl hover:-translate-y-0.5' 
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            <span>{savingCapacity ? t.loading : 'Save Seat Capacity'}</span>
                            {(capacityLoaded && !savingCapacity) && (
                              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Availability Settings */}
              <div className="border border-copper/20 rounded-xl bg-white/30">
                <button
                  onClick={() => toggleSection('availability')}
                  className="w-full p-4 flex items-center justify-between hover:bg-white/20 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📅</span>
                    <h3 className="text-xl font-semibold text-ink-black">{t.availabilitySettings}</h3>
                  </div>
                  <span className={`text-copper transition-transform duration-200 ${expandedSections.availability ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>
                
                {expandedSections.availability && (
                  <div className="px-4 pb-4">
                    <p className="text-sm text-charcoal/70 mb-6">{t.availabilityDescription}</p>
                    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">{t.availabilityNote}</p>
                    
                    {!availabilityLoaded ? (
                      <div className="flex items-center justify-center p-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-copper"></div>
                        <span className="ml-3 text-charcoal/60">{t.loadingAvailabilitySettings}</span>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Omakase Availability */}
                        <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                          <h4 className="font-semibold text-ink-black mb-3 flex items-center gap-2">
                            <span>🍣</span>
                            {t.omakaseAvailabilityLabel}
                          </h4>
                          <p className="text-sm text-charcoal/60 mb-4">{t.availabilityHelpText}</p>
                          
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {/* Display weekdays in Sunday-first order using getDay() values (0=Sunday, 1=Monday, etc.) */}
                            {[
                              { name: t.weekdays[0], weekdayValue: 0 }, // Sunday = 0
                              { name: t.weekdays[1], weekdayValue: 1 }, // Monday = 1
                              { name: t.weekdays[2], weekdayValue: 2 }, // Tuesday = 2
                              { name: t.weekdays[3], weekdayValue: 3 }, // Wednesday = 3
                              { name: t.weekdays[4], weekdayValue: 4 }, // Thursday = 4
                              { name: t.weekdays[5], weekdayValue: 5 }, // Friday = 5
                              { name: t.weekdays[6], weekdayValue: 6 }, // Saturday = 6
                            ].map((day) => (
                              <button
                                key={day.weekdayValue}
                                onClick={() => toggleOmakaseDay(day.weekdayValue)}
                                className={`p-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                                  availabilitySettings.omakaseAvailableDays.includes(day.weekdayValue)
                                    ? 'bg-purple-500 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                              >
                                {day.name}
                              </button>
                            ))}
                          </div>
                          
                          {availabilitySettings.omakaseAvailableDays.length === 0 && (
                            <p className="text-sm text-amber-600 italic mt-3">ℹ️ Omakase reservations are currently closed (no days selected)</p>
                          )}
                        </div>

                        {/* Dining Availability */}
                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                          <h4 className="font-semibold text-ink-black mb-3 flex items-center gap-2">
                            <span>🍽️</span>
                            {t.diningAvailabilityLabel}
                          </h4>
                          <p className="text-sm text-charcoal/60 mb-4">{t.availabilityHelpText}</p>
                          
                          <div className="space-y-3">
                            {/* Display weekdays in Sunday-first order using getDay() values (0=Sunday, 1=Monday, etc.) */}
                            {[
                              { name: t.weekdays[0], weekdayValue: 0 }, // Sunday = 0
                              { name: t.weekdays[1], weekdayValue: 1 }, // Monday = 1
                              { name: t.weekdays[2], weekdayValue: 2 }, // Tuesday = 2
                              { name: t.weekdays[3], weekdayValue: 3 }, // Wednesday = 3
                              { name: t.weekdays[4], weekdayValue: 4 }, // Thursday = 4
                              { name: t.weekdays[5], weekdayValue: 5 }, // Friday = 5
                              { name: t.weekdays[6], weekdayValue: 6 }, // Saturday = 6
                            ].map((day) => {
                              const shifts = availabilitySettings.diningAvailableShifts[day.weekdayValue] || []
                              const hasLunch = shifts.includes('lunch')
                              const hasDinner = shifts.includes('dinner')
                              const dayEnabled = hasLunch || hasDinner
                              
                              return (
                                <div key={day.weekdayValue} className="flex items-center gap-2 p-2 bg-white rounded-lg">
                                  <button
                                    onClick={() => toggleDiningDay(day.weekdayValue)}
                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 min-w-[80px] ${
                                      dayEnabled
                                        ? 'bg-blue-500 text-white shadow-md'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                  >
                                    {day.name}
                                  </button>
                                  
                                  {dayEnabled && (
                                    <div className="flex gap-2 ml-2">
                                      <button
                                        onClick={() => toggleDiningShift(day.weekdayValue, 'lunch')}
                                        className={`px-3 py-1 rounded text-xs font-medium transition-all duration-200 ${
                                          hasLunch
                                            ? 'bg-amber-500 text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                      >
                                        {t.lunchShift}
                                      </button>
                                      <button
                                        onClick={() => toggleDiningShift(day.weekdayValue, 'dinner')}
                                        className={`px-3 py-1 rounded text-xs font-medium transition-all duration-200 ${
                                          hasDinner
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                      >
                                        {t.dinnerShift}
                                      </button>
                                    </div>
                                  )}
                                  
                                  {dayEnabled && !hasLunch && !hasDinner && (
                                    <span className="text-xs text-red-600 ml-2">{t.noShiftsWarning}</span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                          
                          {availabilitySettings.diningAvailableDays.length === 0 && (
                            <p className="text-sm text-red-600 italic mt-3">⚠️ Dining must be available on at least one day</p>
                          )}
                        </div>
                        
                        {/* Save Button for Availability */}
                        <div className="flex justify-end pt-4 border-t border-copper/10 mt-4">
                          <button
                            onClick={saveAvailabilitySettings}
                            disabled={savingAvailability || !availabilityLoaded || 
                              availabilitySettings.diningAvailableDays.length === 0}
                            className={`group relative px-8 py-3 rounded-xl transition-all duration-300 font-semibold shadow-lg transform ${
                              (availabilityLoaded && !savingAvailability && 
                               availabilitySettings.diningAvailableDays.length > 0)
                                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 hover:shadow-xl hover:-translate-y-0.5' 
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            <span>{savingAvailability ? t.loading : 'Save Availability Settings'}</span>
                            {(availabilityLoaded && !savingAvailability && 
                              availabilitySettings.diningAvailableDays.length > 0) && (
                              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Closed Dates Settings */}
              <div className="border border-copper/20 rounded-xl bg-white/30">
                <button
                  onClick={() => toggleSection('closedDates')}
                  className="w-full p-4 flex items-center justify-between hover:bg-white/20 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🚫</span>
                    <h3 className="text-xl font-semibold text-ink-black">{t.closedDatesSettings}</h3>
                  </div>
                  <span className={`text-copper transition-transform duration-200 ${expandedSections.closedDates ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>
                
                {expandedSections.closedDates && (
                  <div className="px-4 pb-4">
                    <p className="text-sm text-charcoal/70 mb-6">{t.closedDatesDescription}</p>
                    
                    {!closedDatesLoaded ? (
                      <div className="flex items-center justify-center p-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-copper"></div>
                        <span className="ml-3 text-charcoal/60">{t.loadingClosedDates}</span>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Specific Dates */}
                        <div className="p-4 bg-white/50 rounded-xl border border-copper/10">
                          <h4 className="font-semibold text-ink-black mb-3">{t.closedDatesLabel}</h4>
                          <div className="flex gap-3 mb-4">
                            <input
                              type="date"
                              value={newClosedDate}
                              onChange={(e) => setNewClosedDate(e.target.value)}
                              min={new Date().toISOString().split('T')[0]} // Prevent past dates
                              className="flex-1 px-3 py-2 border-2 border-copper/20 rounded-lg focus:ring-2 focus:ring-copper/20 focus:border-copper/20 transition-all duration-300 bg-white text-ink-black"
                              placeholder={t.closedDatePlaceholder}
                            />
                            <button
                              onClick={addClosedDate}
                              disabled={!newClosedDate}
                              className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors duration-200 whitespace-nowrap"
                            >
                              {t.addClosedDate}
                            </button>
                          </div>
                          
                          {closedDates.length === 0 ? (
                            <p className="text-sm text-charcoal/60 italic">{t.noClosedDates}</p>
                          ) : (
                            <div className="space-y-2">
                              {closedDates.map((date) => (
                                <div key={date} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                                  <div>
                                    <span className="font-medium text-red-800">{date}</span>
                                    <span className="ml-2 text-sm text-red-600">
                                      ({new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })})
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => removeClosedDate(date)}
                                    className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-md text-sm font-medium transition-colors duration-200"
                                  >
                                    {t.removeClosedDate}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Weekly Closures */}
                        <div className="p-4 bg-white/50 rounded-xl border border-copper/10">
                          <h4 className="font-semibold text-ink-black mb-3">{t.weeklyClosuresLabel}</h4>
                          <p className="text-sm text-charcoal/60 mb-4">{t.weeklyClosuresDesc}</p>
                          

                          
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {/* Display weekdays in Sunday-first order using getDay() values directly */}
                            {[
                              { name: t.weekdays[0], weekdayValue: 0 }, // Sunday = 0
                              { name: t.weekdays[1], weekdayValue: 1 }, // Monday = 1  
                              { name: t.weekdays[2], weekdayValue: 2 }, // Tuesday = 2
                              { name: t.weekdays[3], weekdayValue: 3 }, // Wednesday = 3
                              { name: t.weekdays[4], weekdayValue: 4 }, // Thursday = 4
                              { name: t.weekdays[5], weekdayValue: 5 }, // Friday = 5
                              { name: t.weekdays[6], weekdayValue: 6 }, // Saturday = 6
                            ].map((day) => {
                              // closedWeekdays now contains getDay() values directly
                              const isClosed = closedWeekdays.includes(day.weekdayValue)
                              
                              return (
                                <button
                                  key={day.weekdayValue}
                                  onClick={() => toggleWeekday(day.weekdayValue)}
                                  className={`p-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                                    isClosed
                                      ? 'bg-red-500 text-white shadow-md'
                                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  }`}
                                >
                                  {day.name}
                                </button>
                              )
                            })}
                          </div>
                          
                          {closedWeekdays.length === 0 && (
                            <p className="text-sm text-charcoal/60 italic mt-3">{t.noWeeklyClosures}</p>
                          )}
                        </div>

                        {/* Shift-Based Closures */}
                        <div className="p-4 bg-white/50 rounded-xl border border-copper/10 mb-4">
                          <h4 className="font-semibold text-ink-black mb-3">{t.shiftClosuresLabel}</h4>
                          <p className="text-sm text-charcoal/60 mb-4">{t.shiftClosuresDesc}</p>
                          
                          {/* Add new shift closure */}
                          <div className="flex gap-2 mb-4">
                            <input
                              type="date"
                              value={newShiftClosure.date}
                              onChange={(e) => setNewShiftClosure({ ...newShiftClosure, date: e.target.value })}
                              min={format(new Date(), 'yyyy-MM-dd')}
                              className="flex-1 px-3 py-2 border border-copper/20 rounded-lg focus:ring-2 focus:ring-copper/50 focus:border-copper"
                            />
                            <select
                              value={newShiftClosure.type}
                              onChange={(e) => setNewShiftClosure({ ...newShiftClosure, type: e.target.value as 'full_day' | 'lunch_only' | 'dinner_only' })}
                              className="px-3 py-2 border border-copper/20 rounded-lg focus:ring-2 focus:ring-copper/50 focus:border-copper"
                            >
                              <option value="full_day">{t.fullDay}</option>
                              <option value="lunch_only">{t.lunchOnly}</option>
                              <option value="dinner_only">{t.dinnerOnly}</option>
                            </select>
                            <button
                              onClick={addShiftClosure}
                              disabled={!newShiftClosure.date}
                              className="px-4 py-2 bg-gradient-to-r from-copper to-amber-700 text-white rounded-lg hover:from-copper/90 hover:to-amber-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                            >
                              {t.addShiftClosure}
                            </button>
                          </div>
                          
                          {/* List of shift closures */}
                          {shiftClosures.length === 0 ? (
                            <p className="text-charcoal/60 italic text-sm">{t.noShiftClosures}</p>
                          ) : (
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                              {shiftClosures.map((closure) => (
                                <div key={closure.date} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                  <div className="flex-1">
                                    <div className="font-medium text-gray-800">
                                      {closure.date} - {closure.type === 'lunch_only' ? t.lunchOnly : closure.type === 'dinner_only' ? t.dinnerOnly : t.fullDay}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                      {new Date(closure.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => removeShiftClosure(closure.date)}
                                    className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm font-medium transition-colors duration-200"
                                  >
                                    {t.removeClosedDate}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Holiday Management */}
                        <div className="p-4 bg-white/50 rounded-xl border border-copper/10">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-ink-black">{t.holidaysLabel}</h4>
                            <button
                              onClick={toggleAllHolidays}
                              className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-medium transition-colors duration-200"
                            >
                              {t.toggleAllHolidays}
                            </button>
                          </div>
                          <p className="text-sm text-charcoal/60 mb-4">{t.holidaysDesc}</p>
                          
                          <div className="grid gap-2 max-h-60 overflow-y-auto">
                            {holidays.map((holiday) => (
                              <div key={holiday.date} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                <div className="flex-1">
                                  <div className="font-medium text-gray-800">{holiday.name}</div>
                                  <div className="text-sm text-gray-600">
                                    {holiday.date} ({new Date(holiday.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })})
                                  </div>
                                </div>
                                <button
                                  onClick={() => toggleHoliday(holiday.date)}
                                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors duration-200 ${
                                    holiday.closed
                                      ? 'bg-red-500 text-white hover:bg-red-600'
                                      : 'bg-green-500 text-white hover:bg-green-600'
                                  }`}
                                >
                                  {holiday.closed ? 'CLOSED' : 'OPEN'}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
                </>
              )}

              {/* Logout Section */}
              <div className="border border-copper/20 rounded-xl bg-white/30">
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🚪</span>
                      <div>
                        <h3 className="text-xl font-semibold text-ink-black">{t.logout}</h3>
                        <p className="text-sm text-charcoal/60 mt-1">Sign out of the admin dashboard</p>
                      </div>
                    </div>
                    <button
                      onClick={logout}
                      className="group relative bg-gradient-to-r from-copper to-amber-700 text-white px-6 py-3 rounded-xl hover:from-copper/90 hover:to-amber-800 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
                    >
                      <span className="text-lg">🚪</span>
                      <span>{t.logout}</span>
                      <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {showRefundModal && refundingReservation && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-sand-beige/95 to-white/90 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full shadow-2xl border border-copper/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-playfair text-copper">{t.refundModalTitle}</h2>
              <button
                onClick={() => setShowRefundModal(false)}
                className="w-10 h-10 rounded-full bg-sand-beige/60 hover:bg-sand-beige/80 flex items-center justify-center transition-colors duration-200"
              >
                <span className="text-gray-600">✕</span>
              </button>
            </div>

            <div className="space-y-4">
              {/* Reservation Details */}
              <div className="bg-white/30 rounded-lg p-4">
                <div className="text-sm space-y-2">
                  <div>
                    <span className="font-semibold text-copper">Customer:</span> {refundingReservation.customer_name}
                  </div>
                  <div>
                    <span className="font-semibold text-copper">Amount Paid:</span> ${(refundingReservation.prepayment_amount! / 100).toFixed(2)}
                  </div>
                  {refundingReservation.payment_status === 'partially_refunded' && refundingReservation.cancellation_refund_percentage && (
                    <div>
                      <span className="font-semibold text-copper">Already Refunded:</span> {refundingReservation.cancellation_refund_percentage}% (${((refundingReservation.prepayment_amount! * refundingReservation.cancellation_refund_percentage) / 10000).toFixed(2)})
                    </div>
                  )}
                  <div>
                    <span className="font-semibold text-copper">Remaining Refundable:</span> ${
                      refundingReservation.payment_status === 'partially_refunded' && refundingReservation.cancellation_refund_percentage
                        ? ((refundingReservation.prepayment_amount! * (100 - refundingReservation.cancellation_refund_percentage)) / 10000).toFixed(2)
                        : (refundingReservation.prepayment_amount! / 100).toFixed(2)
                    }
                  </div>
                  <div>
                    <span className="font-semibold text-copper">Date:</span> {format(parseLocalDate(refundingReservation.reservation_date), 'MMM d, yyyy')}
                  </div>
                </div>
              </div>

              {/* Refund Type */}
              <div>
                <label className="block text-sm font-semibold text-charcoal mb-2">{t.refundTypeLabel}</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRefundType('full')
                      setRefundPercentage(100)
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      refundType === 'full'
                        ? 'bg-copper text-white'
                        : 'bg-white/50 text-charcoal hover:bg-white/70'
                    }`}
                  >
                    {t.fullRefund}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRefundType('partial')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      refundType === 'partial'
                        ? 'bg-copper text-white'
                        : 'bg-white/50 text-charcoal hover:bg-white/70'
                    }`}
                  >
                    {t.partialRefund}
                  </button>
                </div>
              </div>

              {/* Partial Refund Percentage */}
              {refundType === 'partial' && (
                <div>
                  <label className="block text-sm font-semibold text-charcoal mb-2">
                    {t.refundPercentageLabel}: {refundPercentage}%
                  </label>
                  <input
                    type="range"
                    min="1"
                    max={refundingReservation.payment_status === 'partially_refunded' && refundingReservation.cancellation_refund_percentage
                      ? 100 - refundingReservation.cancellation_refund_percentage
                      : 99}
                    value={refundPercentage}
                    onChange={(e) => setRefundPercentage(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="mt-2 text-sm text-charcoal">
                    Refund Amount: ${
                      refundingReservation.payment_status === 'partially_refunded' && refundingReservation.cancellation_refund_percentage
                        ? ((refundingReservation.prepayment_amount! * (100 - refundingReservation.cancellation_refund_percentage) * refundPercentage) / 1000000).toFixed(2)
                        : ((refundingReservation.prepayment_amount! * refundPercentage) / 10000).toFixed(2)
                    }
                  </div>
                </div>
              )}

              {/* Refund Reason */}
              <div>
                <label className="block text-sm font-semibold text-charcoal mb-2">{t.refundReasonLabel}</label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Optional: Provide a reason for the refund"
                  className="w-full px-4 py-2 border border-copper/30 rounded-lg focus:ring-2 focus:ring-copper/50 focus:border-copper transition-all bg-white/70 backdrop-blur-sm resize-none h-20"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowRefundModal(false)}
                  className="flex-1 px-4 py-2 border border-copper/30 rounded-lg hover:bg-white/50 transition-all font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={processRefund}
                  disabled={processingRefund}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-2 rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processingRefund ? t.processingRefund : `Process ${refundType === 'full' ? 'Full' : `${refundPercentage}%`} Refund`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Confirmation Modal */}
      {showCancelModal && cancellingReservation && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-sand-beige/95 to-white/90 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full shadow-2xl border border-copper/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-playfair text-copper">{t.cancelModalTitle}</h2>
              <button
                onClick={() => setShowCancelModal(false)}
                className="w-10 h-10 rounded-full bg-sand-beige/60 hover:bg-sand-beige/80 flex items-center justify-center transition-colors duration-200"
              >
                <span className="text-gray-600">✕</span>
              </button>
            </div>

            <div className="space-y-4">
              {/* Warning */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-red-800">{t.cancelModalWarning}</p>
              </div>

              {/* Reservation Details */}
              <div className="bg-white/30 rounded-lg p-4">
                <div className="text-sm space-y-2">
                  <div>
                    <span className="font-semibold text-copper">Customer:</span> {cancellingReservation.customer_name}
                  </div>
                  <div>
                    <span className="font-semibold text-copper">Date:</span> {format(parseLocalDate(cancellingReservation.reservation_date), 'MMM d, yyyy')}
                  </div>
                  <div>
                    <span className="font-semibold text-copper">Time:</span> {cancellingReservation.reservation_time}
                  </div>
                  <div>
                    <span className="font-semibold text-copper">Party Size:</span> {cancellingReservation.party_size} {cancellingReservation.party_size === 1 ? 'person' : 'people'}
                  </div>
                </div>
              </div>

              {/* Refund Policy for Omakase */}
              {cancellingReservation.type === 'omakase' && cancellingReservation.payment_status === 'paid' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-2">{t.refundPolicyTitle}</h4>
                  <p className="text-sm text-blue-800 mb-2">{t.automaticRefundNote}</p>
                  {(() => {
                    const reservationDate = new Date(cancellingReservation.reservation_date + 'T' + cancellingReservation.reservation_time);
                    const now = new Date();
                    const hoursUntilReservation = Math.round((reservationDate.getTime() - now.getTime()) / (1000 * 60 * 60));
                    
                    let refundMessage = '';
                    let refundAmount = 0;
                    
                    if (hoursUntilReservation > 48) {
                      refundMessage = `100% ${t.refundPercentageText}`;
                      refundAmount = cancellingReservation.prepayment_amount! / 100;
                    } else if (hoursUntilReservation > 24) {
                      refundMessage = `50% ${t.refundPercentageText}`;
                      refundAmount = (cancellingReservation.prepayment_amount! * 0.5) / 100;
                    } else {
                      refundMessage = t.noRefundWarning;
                      refundAmount = 0;
                    }
                    
                    return (
                      <div className="text-sm">
                        <div className="font-medium text-blue-900">
                          {t.hoursBeforeReservation}: {hoursUntilReservation > 0 ? hoursUntilReservation : 0}
                        </div>
                        <div className="font-bold text-blue-900 mt-1">
                          {refundMessage} {refundAmount > 0 && `($${refundAmount.toFixed(2)})`}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Cancellation Reason */}
              <div>
                <label className="block text-sm font-semibold text-charcoal mb-2">{t.selectCancellationReason}</label>
                <select
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  className="w-full px-4 py-2 border border-copper/30 rounded-lg focus:ring-2 focus:ring-copper/50 focus:border-copper transition-all bg-white/70 backdrop-blur-sm"
                  required
                >
                  <option value="">-- Select a reason --</option>
                  {CANCELLATION_REASONS.map(reason => (
                    <option key={reason} value={reason}>{reason}</option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 px-4 py-2 border border-copper/30 rounded-lg hover:bg-white/50 transition-all font-medium"
                  disabled={processingCancellation}
                >
                  {t.cancelButton}
                </button>
                <button
                  onClick={processCancellation}
                  disabled={processingCancellation || !cancellationReason.trim()}
                  className="flex-1 bg-gradient-to-r from-red-500 to-rose-600 text-white px-4 py-2 rounded-lg hover:from-red-600 hover:to-rose-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processingCancellation ? t.processingCancellation : t.confirmCancel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Communication History Modal */}
      {showCommunicationModal && communicationReservation && (
        <CommunicationHistoryModal
          isOpen={showCommunicationModal}
          onClose={() => {
            setShowCommunicationModal(false);
            setCommunicationReservation(null);
          }}
          reservationId={communicationReservation.id}
          reservationType={communicationReservation.type}
          customerName={communicationReservation.customer_name}
          customerEmail={communicationReservation.customer_email}
          isChineseMode={language === 'zh'}
        />
      )}

      {/* Dining No-Show Charge Modal */}
      {showDiningChargeModal && diningChargingReservation && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-sand-beige/95 to-white/90 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full shadow-2xl border border-copper/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-playfair text-copper">Charge No-Show Fee</h2>
              <button
                onClick={() => setShowDiningChargeModal(false)}
                className="w-10 h-10 rounded-full bg-sand-beige/60 hover:bg-sand-beige/80 flex items-center justify-center transition-colors duration-200"
              >
                <span className="text-gray-600">✕</span>
              </button>
            </div>

            <div className="space-y-4">
              {/* Charge Details */}
              <div className="bg-white/30 rounded-lg p-4">
                <div className="text-sm space-y-2">
                  <div>
                    <span className="font-semibold text-copper">Customer:</span> {diningChargingReservation.customer_name}
                  </div>
                  <div>
                    <span className="font-semibold text-copper">Party Size:</span> {diningChargingReservation.party_size} {diningChargingReservation.party_size === 1 ? 'person' : 'people'}
                  </div>
                  <div>
                    <span className="font-semibold text-copper">No-Show Fee:</span> ${diningNoShowAmount / 100} ($25 × {diningChargingReservation.party_size})
                  </div>
                  <div>
                    <span className="font-semibold text-copper">Date:</span> {format(parseLocalDate(diningChargingReservation.reservation_date), 'MMM d, yyyy')}
                  </div>
                </div>
              </div>

              {/* Warning */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">This will charge the customer's saved payment method for the no-show fee.</p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowDiningChargeModal(false)}
                  className="flex-1 px-4 py-2 border border-copper/30 rounded-lg hover:bg-white/50 transition-all font-medium"
                  disabled={processingDiningCharge}
                >
                  Cancel
                </button>
                <button
                  onClick={processDiningNoShowCharge}
                  disabled={processingDiningCharge}
                  className="flex-1 bg-gradient-to-r from-red-500 to-rose-600 text-white px-4 py-2 rounded-lg hover:from-red-600 hover:to-rose-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processingDiningCharge ? 'Processing...' : `Charge $${diningNoShowAmount / 100}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dining Refund Modal */}
      {showDiningRefundModal && diningRefundingReservation && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-sand-beige/95 to-white/90 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full shadow-2xl border border-copper/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-playfair text-copper">Refund No-Show Fee</h2>
              <button
                onClick={() => setShowDiningRefundModal(false)}
                className="w-10 h-10 rounded-full bg-sand-beige/60 hover:bg-sand-beige/80 flex items-center justify-center transition-colors duration-200"
              >
                <span className="text-gray-600">✕</span>
              </button>
            </div>

            <div className="space-y-4">
              {/* Refund Details */}
              <div className="bg-white/30 rounded-lg p-4">
                <div className="text-sm space-y-2">
                  <div>
                    <span className="font-semibold text-copper">Customer:</span> {diningRefundingReservation.customer_name}
                  </div>
                  <div>
                    <span className="font-semibold text-copper">Amount Charged:</span> ${(diningRefundingReservation.no_show_fee_amount! / 100).toFixed(2)}
                  </div>
                  <div>
                    <span className="font-semibold text-copper">Date:</span> {format(parseLocalDate(diningRefundingReservation.reservation_date), 'MMM d, yyyy')}
                  </div>
                </div>
              </div>

              {/* Refund Reason */}
              <div>
                <label className="block text-sm font-semibold text-charcoal mb-2">Reason for Refund</label>
                <textarea
                  value={diningRefundReason}
                  onChange={(e) => setDiningRefundReason(e.target.value)}
                  className="w-full px-4 py-2 border border-copper/30 rounded-lg focus:ring-2 focus:ring-copper/50 focus:border-copper transition-all bg-white/70 backdrop-blur-sm"
                  rows={3}
                  placeholder="Enter reason for refund..."
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowDiningRefundModal(false)}
                  className="flex-1 px-4 py-2 border border-copper/30 rounded-lg hover:bg-white/50 transition-all font-medium"
                  disabled={processingDiningRefund}
                >
                  Cancel
                </button>
                <button
                  onClick={processDiningRefund}
                  disabled={processingDiningRefund || !diningRefundReason.trim()}
                  className="flex-1 bg-gradient-to-r from-copper to-copper-dark text-white px-4 py-2 rounded-lg hover:from-copper-dark hover:to-copper transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processingDiningRefund ? 'Processing...' : `Refund $${(diningRefundingReservation.no_show_fee_amount! / 100).toFixed(2)}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  )
} 