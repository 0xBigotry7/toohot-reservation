'use client'

import { useEffect, useState, useRef } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addDays, getDay, startOfWeek } from 'date-fns'
import { supabase } from '../lib/supabase'
import { nanoid } from 'nanoid'
import { useToast } from '../hooks/use-toast'
import Image from 'next/image'
import TrendChart from '../components/TrendChart'

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
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [days, setDays] = useState<Date[]>([]);
  const [calendarReservations, setCalendarReservations] = useState<{ [date: string]: Reservation[] }>({});
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showCancelled, setShowCancelled] = useState(false)
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
  
  // Availability settings
  const [availabilitySettings, setAvailabilitySettings] = useState({
    omakaseAvailableDays: [4], // Default: Thursday only (4 = Thursday)
    diningAvailableDays: [0, 1, 2, 3, 4, 5, 6] // Default: All days
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

  // Load language preference from localStorage on mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem('toohot-language') as 'en' | 'zh'
    if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'zh')) {
      setLanguage(savedLanguage)
    }
  }, [])

  // Handle click outside settings modal
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

  // Check if a date should be closed (specific date, weekday, or holiday)
  const isDateClosed = (dateStr: string) => {
    const date = new Date(dateStr)
    const dayOfWeek = date.getDay()
    
    // Check specific closed dates
    if (closedDates.includes(dateStr)) return true
    
    // Check weekly closures
    if (closedWeekdays.includes(dayOfWeek)) return true
    
    // Check holidays
    if (holidays.some(h => h.date === dateStr && h.closed)) return true
    
    return false
  }

  // Comprehensive Translation system
  const translations = {
    en: {
      // Header & Navigation
      toohotAdmin: "TooHot Admin",
      reservationManagementDashboard: "Reservation Management Dashboard",
      newReservation: "New Reservation",
      settings: "Settings",
      logout: "Logout",
      loadingDashboard: "Loading dashboard...",
      
      // Calendar & Overview
      daysOverview: "30 Days Overview",
      calendarConfirmed: "Confirmed",
      actionRequired: "Action Required",
      selectDateToView: "Select a date to view reservations",
      noReservationsForDate: "No reservations for this date",
      
      // Search & Filters
      searchAllReservations: "Search all reservations...",
      allStatuses: "All Statuses",
      showCancelled: "Show Cancelled",
      searchResults: "Search Results",
      
      // Reservation Types
      omakaseType: "Omakase",
      diningType: "Dining",
      
      // Reservation Actions
      confirm: "Confirm",
      edit: "Edit",
      cancelAction: "Cancel",
      
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
      sunday: "Sun"
    },
    zh: {
      // Header & Navigation
      toohotAdmin: "TooHot 管理后台",
      reservationManagementDashboard: "预订管理仪表板",
      newReservation: "新建预订",
      settings: "设置",
      logout: "退出登录",
      loadingDashboard: "正在加载仪表板...",
      
      // Calendar & Overview
      daysOverview: "30天概览",
      calendarConfirmed: "已确认",
      actionRequired: "需要操作",
      selectDateToView: "选择日期查看预订",
      noReservationsForDate: "此日期无预订",
      
      // Search & Filters
      searchAllReservations: "搜索所有预订...",
      allStatuses: "所有状态",
      showCancelled: "显示已取消",
      searchResults: "搜索结果",
      
      // Reservation Types
      omakaseType: "无菜单料理",
      diningType: "单点餐饮",
      
      // Reservation Actions
      confirm: "确认",
      edit: "编辑",
      cancelAction: "取消",
      
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
      sunday: "周日"
    }
  }

  const t = translations[language]

  // Helper function to get translated status label
  const getStatusLabel = (statusValue: string) => {
    const status = RESERVATION_STATUSES.find(s => s.value === statusValue)
    return status ? t[status.labelKey as keyof typeof t] : statusValue
  }

  const { toast } = useToast();

  // Improved authentication check
  useEffect(() => {
    const isAuthenticated = localStorage.getItem('admin-authenticated')
    if (isAuthenticated === 'true') {
      setAuthenticated(true)
      setLoading(false)
      return
    }
    let attempts = 0
    function promptPassword() {
      const password = window.prompt('Enter admin password:')
      const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
      if (password === ADMIN_PASSWORD) {
        localStorage.setItem('admin-authenticated', 'true')
        setAuthenticated(true)
        setLoading(false)
      } else {
        attempts++
        if (attempts >= 3) {
          alert('Too many failed attempts.')
          setLoading(true)
        } else {
          alert('Invalid password')
          promptPassword()
        }
      }
    }
    promptPassword()
  }, [])

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

  const fetchAvailabilitySettings = async () => {
    try {
      const response = await fetch('/api/get-availability-settings')
      const data = await response.json()
      
      if (data.success && data.settings) {
        setAvailabilitySettings({
          omakaseAvailableDays: data.settings.omakaseAvailableDays || [4], // Default: Thursday only
          diningAvailableDays: data.settings.diningAvailableDays || [0, 1, 2, 3, 4, 5, 6] // Default: All days
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
          holidays 
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
          holidays 
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
          holidays 
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

  const toggleWeekday = async (dayIndex: number) => {
    const updatedWeekdays = closedWeekdays.includes(dayIndex)
      ? closedWeekdays.filter(d => d !== dayIndex)
      : [...closedWeekdays, dayIndex].sort()
    
    setClosedWeekdays(updatedWeekdays)
    
    // Auto-save with updated data
    try {
      const response = await fetch('/api/save-closed-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          closedDates,
          closedWeekdays: updatedWeekdays,  // Use updated weekdays
          holidays 
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        const dayName = dayNames[dayIndex]
        const isNowClosed = updatedWeekdays.includes(dayIndex)
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
          holidays: updatedHolidays  // Use the updated holidays directly
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
          holidays: updatedHolidays  // Use the updated holidays directly
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

  const toggleOmakaseDay = (dayIndex: number) => {
    const currentDays = availabilitySettings.omakaseAvailableDays
    const updatedDays = currentDays.includes(dayIndex)
      ? currentDays.filter(d => d !== dayIndex)
      : [...currentDays, dayIndex].sort()
    
    setAvailabilitySettings({
      ...availabilitySettings,
      omakaseAvailableDays: updatedDays
    })
  }

  const toggleDiningDay = (dayIndex: number) => {
    const currentDays = availabilitySettings.diningAvailableDays
    const updatedDays = currentDays.includes(dayIndex)
      ? currentDays.filter(d => d !== dayIndex)
      : [...currentDays, dayIndex].sort()
    
    setAvailabilitySettings({
      ...availabilitySettings,
      diningAvailableDays: updatedDays
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
      const response = await fetch('/api/save-availability-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          omakaseAvailableDays: availabilitySettings.omakaseAvailableDays,
          diningAvailableDays: availabilitySettings.diningAvailableDays
        })
      })

      const data = await response.json()

      if (data.success) {
        const omakaseDays = availabilitySettings.omakaseAvailableDays.map(d => t.weekdays[d]).join(', ')
        const diningDays = availabilitySettings.diningAvailableDays.map(d => t.weekdays[d]).join(', ')
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

  useEffect(() => {
    // Generate next 30 days from today
    const now = new Date();
    const daysArr = eachDayOfInterval({
      start: now,
      end: addDays(now, 29),
    });
    setDays(daysArr);
  }, []);

  const fetchReservations = async () => {
    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      const end = addDays(now, 29);
      
      // Fetch both omakase and dining reservations
      const [omakaseResponse, diningResponse] = await Promise.all([
        supabase()
          .from('omakase_reservations')
          .select('*')
          .gte('reservation_date', format(now, 'yyyy-MM-dd'))
          .lte('reservation_date', format(end, 'yyyy-MM-dd'))
          .order('reservation_date', { ascending: true })
          .order('reservation_time', { ascending: true }),
        supabase()
          .from('dining_reservations')
          .select('*')
          .gte('reservation_date', format(now, 'yyyy-MM-dd'))
          .lte('reservation_date', format(end, 'yyyy-MM-dd'))
          .order('reservation_date', { ascending: true })
          .order('reservation_time', { ascending: true })
      ]);
      
      if (omakaseResponse.error) throw omakaseResponse.error;
      if (diningResponse.error) throw diningResponse.error;
      
      // Combine and mark reservation types
      const omakaseReservations = (omakaseResponse.data || []).map(r => ({ ...r, type: 'omakase' as const }));
      const diningReservations = (diningResponse.data || []).map(r => ({ ...r, type: 'dining' as const }));
      const allReservations = [...omakaseReservations, ...diningReservations];
      
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
    
    // Filter out cancelled reservations for all stats
    const activeReservations = reservationsData.filter(r => r.status !== 'cancelled')
    
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

    // Filter out cancelled reservations
    const activeReservations = reservationsForDay.filter(r => r.status !== 'cancelled')
    
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

      // Then, send cancellation email to customer
      try {
        const emailResponse = await fetch('/api/send-cancellation-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reservation: updatedReservation })
        })

        if (!emailResponse.ok) {
          const emailError = await emailResponse.json()
          console.error('Email sending failed:', emailError)
          // Don't throw error - cancellation was successful, just email failed
          toast({
            title: 'Reservation Cancelled',
            description: 'Reservation cancelled successfully, but email notification failed to send.',
            variant: 'default',
          })
        } else {
          toast({
            title: 'Reservation Cancelled',
            description: 'The reservation has been cancelled and the customer has been notified by email.',
          })
        }
      } catch (emailError) {
        console.error('Email sending error:', emailError)
        toast({
          title: 'Reservation Cancelled',
          description: 'Reservation cancelled successfully, but email notification failed to send.',
          variant: 'default',
        })
      }
      
      fetchReservations()
    } catch (error: any) {
      toast({
        title: 'Cancellation Failed',
        description: error.message || 'Failed to cancel the reservation. Please try again.',
        variant: 'destructive',
      })
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

      // If changing to confirmed status from any other status, send confirmation email
      if (newStatus === 'confirmed' && previousStatus !== 'confirmed') {
        try {
          // Use appropriate confirmation endpoint based on reservation type
          const confirmationEndpoint = reservationType === 'omakase' 
            ? '/api/send-omakase-confirmation'
            : '/api/send-dining-confirmation'
            
          const emailResponse = await fetch(confirmationEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reservation: updatedReservation })
          })

          if (!emailResponse.ok) {
            const emailError = await emailResponse.json()
            console.error('Confirmation email sending failed:', emailError)
            toast({
              title: 'Status Updated',
              description: 'Status changed to confirmed, but confirmation email failed to send.',
              variant: 'default',
            })
          } else {
            toast({
              title: 'Reservation Confirmed',
              description: 'Status changed to confirmed and confirmation email sent to customer.',
            })
          }
        } catch (emailError) {
          console.error('Confirmation email error:', emailError)
          toast({
            title: 'Status Updated',
            description: 'Status changed to confirmed, but confirmation email failed to send.',
            variant: 'default',
          })
        }
      } else {
        toast({
          title: 'Status Updated',
          description: `Reservation status changed to ${newStatus}.`,
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
    window.location.reload()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-sand-beige flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-copper mx-auto"></div>
          <p className="mt-4 text-copper elegant-subtitle">{t.loadingDashboard}</p>
        </div>
      </div>
    )
  }
  if (!authenticated) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sand-beige to-white flex flex-col">
      {/* Header */}
      <header className="liquid-glass shadow py-4 sm:py-6 px-4 sm:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
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
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={() => setShowNewReservationForm(true)}
            className="group relative bg-gradient-to-r from-emerald-600 to-green-600 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-xl hover:from-emerald-700 hover:to-green-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-1 sm:gap-2 flex-1 sm:flex-none justify-center"
          >
            <span className="text-lg">+</span>
            <span className="text-sm sm:text-base">{t.newReservation}</span>
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="group relative bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-1 sm:gap-2"
          >
            <span className="text-lg">⚙️</span>
            <span className="hidden sm:inline text-sm sm:text-base">{t.settings}</span>
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </button>
          <button
            onClick={logout}
            className="group relative bg-gradient-to-r from-copper to-amber-700 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-xl hover:from-copper/90 hover:to-amber-800 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            <span className="text-sm sm:text-base">{t.logout}</span>
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto py-4 sm:py-8 px-4">
        {/* Calendar and Reservations Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8 mb-8 sm:mb-12">
          
          {/* Calendar View - Left Side */}
          <div className="lg:col-span-1">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl font-playfair text-copper mb-2 sm:mb-0">{t.daysOverview}</h2>
              <div className="flex items-center gap-2 text-xs text-charcoal/60">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>{t.calendarConfirmed}</span>
                </div>
                <div className="flex items-center gap-1 ml-3">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span>{t.actionRequired}</span>
                </div>
              </div>
            </div>
            <div className="liquid-glass rounded-2xl shadow-lg p-4 sm:p-8 overflow-x-auto wabi-sabi-border backdrop-blur-xl border border-white/20">
              {/* Calendar header: Mon-Sun */}
                              <div className="grid grid-cols-7 mb-3">
                  {[t.monday, t.tuesday, t.wednesday, t.thursday, t.friday, t.saturday, t.sunday].map((d) => (
                    <div key={d} className="text-center font-playfair text-copper text-sm pb-2 font-semibold">{d}</div>
                  ))}
                </div>
                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-2">
                {/* Calculate offset for first day */}
                {(() => {
                  const firstDay = days[0];
                  const offset = (getDay(firstDay) + 6) % 7;
                  return Array.from({ length: offset }).map((_, i) => (
                    <div key={`empty-${i}`} />
                  ));
                })()}
                {days.map((day) => {
                  const key = format(day, 'yyyy-MM-dd');
                  const reservationsForDay = calendarReservations[key] || [];
                  const hasConfirmed = reservationsForDay.some(r => r.status === 'confirmed' || r.status === 'seated' || r.status === 'completed');
                  const hasPending = reservationsForDay.some(r => r.status === 'pending');
                  const capacity = calculateCapacityForDate(reservationsForDay);
                  const isClosedDate = isDateClosed(key);
                  
                  return (
                    <button
                      key={key}
                      className={`relative flex flex-col items-center justify-center p-2 sm:p-3 rounded-xl border transition-all text-xs sm:text-sm hover:bg-sand-beige/40 cursor-pointer min-h-[60px] sm:min-h-[80px] overflow-hidden
                        ${isClosedDate 
                          ? 'border-red-400 bg-red-100/60 shadow-red-200/50 shadow-md' 
                          : isToday(day) 
                          ? 'border-copper bg-sand-beige/60 shadow' 
                          : 'border-transparent bg-white/40'}
                        ${selectedDate && isSameDay(day, selectedDate) ? 'ring-2 ring-copper' : ''}
                        ${isClosedDate ? 'opacity-80' : ''}
                      `}
                      onClick={() => setSelectedDate(day)}
                      title={isClosedDate ? 'This date is closed for reservations' : `${capacity.totalUsed}/${capacity.totalCapacity} seats (${capacity.percentage.toFixed(0)}% full)`}
                    >
                      {/* Water Fill Background using theme copper colors */}
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
                      
                      {/* Content - positioned above the water fill */}
                      <div className="relative z-10 flex flex-col items-center justify-center">
                        <span className={`font-playfair text-lg font-semibold ${isClosedDate ? 'text-red-700' : 'text-ink-black'}`}>
                          {format(day, 'd')}
                        </span>
                        
                        {/* Closed date indicator */}
                        {isClosedDate && (
                          <div className="text-red-600 text-lg mt-1">
                            🚫
                          </div>
                        )}
                        
                        {/* Simple capacity info - only show if not closed */}
                        {!isClosedDate && (
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-xs text-copper font-medium">{reservationsForDay.length}</span>
                            <div className="flex items-center gap-0.5">
                              {hasPending && <div className="w-2 h-2 bg-red-500 rounded-full"></div>}
                              {hasConfirmed && <div className="w-2 h-2 bg-green-500 rounded-full"></div>}
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
                              📅 {format(new Date(reservation.reservation_date), 'MMM d')}
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
                                const reason = window.prompt(
                                  'Please provide a reason for cancellation:\n\nCommon reasons:\n• ' + CANCELLATION_REASONS.join('\n• '),
                                  CANCELLATION_REASONS[0]
                                )
                                if (reason && reason.trim()) {
                                  handleCancelReservation(reservation.id, reason.trim())
                                }
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
                                📅 {format(new Date(reservation.reservation_date), 'MMM d')}
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
                                  const reason = window.prompt(
                                    'Please provide a reason for cancellation:\n\nCommon reasons:\n• ' + CANCELLATION_REASONS.join('\n• '),
                                    CANCELLATION_REASONS[0]
                                  )
                                  if (reason && reason.trim()) {
                                    handleCancelReservation(reservation.id, reason.trim())
                                  }
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
                            {/* Display weekdays in Monday-first order to match calendar */}
                            {[
                              { name: t.weekdays[1], jsIndex: 1 }, // Monday
                              { name: t.weekdays[2], jsIndex: 2 }, // Tuesday  
                              { name: t.weekdays[3], jsIndex: 3 }, // Wednesday
                              { name: t.weekdays[4], jsIndex: 4 }, // Thursday
                              { name: t.weekdays[5], jsIndex: 5 }, // Friday
                              { name: t.weekdays[6], jsIndex: 6 }, // Saturday
                              { name: t.weekdays[0], jsIndex: 0 }, // Sunday
                            ].map((day) => (
                              <button
                                key={day.jsIndex}
                                onClick={() => toggleOmakaseDay(day.jsIndex)}
                                className={`p-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                                  availabilitySettings.omakaseAvailableDays.includes(day.jsIndex)
                                    ? 'bg-purple-500 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                              >
                                {day.name}
                              </button>
                            ))}
                          </div>
                          
                          {availabilitySettings.omakaseAvailableDays.length === 0 && (
                            <p className="text-sm text-red-600 italic mt-3">⚠️ Omakase must be available on at least one day</p>
                          )}
                        </div>

                        {/* Dining Availability */}
                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                          <h4 className="font-semibold text-ink-black mb-3 flex items-center gap-2">
                            <span>🍽️</span>
                            {t.diningAvailabilityLabel}
                          </h4>
                          <p className="text-sm text-charcoal/60 mb-4">{t.availabilityHelpText}</p>
                          
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {/* Display weekdays in Monday-first order to match calendar */}
                            {[
                              { name: t.weekdays[1], jsIndex: 1 }, // Monday
                              { name: t.weekdays[2], jsIndex: 2 }, // Tuesday  
                              { name: t.weekdays[3], jsIndex: 3 }, // Wednesday
                              { name: t.weekdays[4], jsIndex: 4 }, // Thursday
                              { name: t.weekdays[5], jsIndex: 5 }, // Friday
                              { name: t.weekdays[6], jsIndex: 6 }, // Saturday
                              { name: t.weekdays[0], jsIndex: 0 }, // Sunday
                            ].map((day) => (
                              <button
                                key={day.jsIndex}
                                onClick={() => toggleDiningDay(day.jsIndex)}
                                className={`p-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                                  availabilitySettings.diningAvailableDays.includes(day.jsIndex)
                                    ? 'bg-blue-500 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                              >
                                {day.name}
                              </button>
                            ))}
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
                              availabilitySettings.omakaseAvailableDays.length === 0 || 
                              availabilitySettings.diningAvailableDays.length === 0}
                            className={`group relative px-8 py-3 rounded-xl transition-all duration-300 font-semibold shadow-lg transform ${
                              (availabilityLoaded && !savingAvailability && 
                               availabilitySettings.omakaseAvailableDays.length > 0 && 
                               availabilitySettings.diningAvailableDays.length > 0)
                                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 hover:shadow-xl hover:-translate-y-0.5' 
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            <span>{savingAvailability ? t.loading : 'Save Availability Settings'}</span>
                            {(availabilityLoaded && !savingAvailability && 
                              availabilitySettings.omakaseAvailableDays.length > 0 && 
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
                            {/* Display weekdays in Monday-first order to match calendar */}
                            {[
                              { name: t.weekdays[1], jsIndex: 1 }, // Monday
                              { name: t.weekdays[2], jsIndex: 2 }, // Tuesday  
                              { name: t.weekdays[3], jsIndex: 3 }, // Wednesday
                              { name: t.weekdays[4], jsIndex: 4 }, // Thursday
                              { name: t.weekdays[5], jsIndex: 5 }, // Friday
                              { name: t.weekdays[6], jsIndex: 6 }, // Saturday
                              { name: t.weekdays[0], jsIndex: 0 }, // Sunday
                            ].map((day) => (
                              <button
                                key={day.jsIndex}
                                onClick={() => toggleWeekday(day.jsIndex)}
                                className={`p-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                                  closedWeekdays.includes(day.jsIndex)
                                    ? 'bg-red-500 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                              >
                                {day.name}
                              </button>
                            ))}
                          </div>
                          
                          {closedWeekdays.length === 0 && (
                            <p className="text-sm text-charcoal/60 italic mt-3">{t.noWeeklyClosures}</p>
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
            </div>
          </div>
        </div>
      )}

    </div>
  )
} 