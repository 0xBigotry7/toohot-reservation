'use client'

import { useEffect, useState } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addDays, getDay, startOfWeek } from 'date-fns'
import { supabase } from '../lib/supabase'
import { nanoid } from 'nanoid'
import { useToast } from '../hooks/use-toast'
import Image from 'next/image'

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
}

interface NewReservation {
  customer_name: string
  customer_email: string
  customer_phone: string
  reservation_date: string
  reservation_time: string
  party_size: number
  special_requests: string
  notes: string
}

// Use environment variable for admin password (for demo only; real apps should use server-side auth)
const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;

const RESERVATION_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'confirmed', label: 'Confirmed', color: 'bg-green-100 text-green-800' },
  { value: 'seated', label: 'Seated', color: 'bg-blue-100 text-blue-800' },
  { value: 'completed', label: 'Completed', color: 'bg-purple-100 text-purple-800' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-800' },
  { value: 'no-show', label: 'No Show', color: 'bg-gray-100 text-gray-800' }
]

const CANCELLATION_REASONS = [
  'Customer requested',
  'Restaurant unavailable',
  'No show',
  'Duplicate booking',
  'Weather/emergency',
  'Other'
]

const TIME_SLOTS = ['17:00', '19:00']

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
    special_requests: '',
    notes: ''
  })
  const [stats, setStats] = useState({
    todayReservations: 0,
    weekReservations: 0,
    totalRevenue: 0,
    avgPartySize: 0
  })
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
  }, [authenticated]) // eslint-disable-line react-hooks/exhaustive-deps

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
    const today = format(new Date(), 'yyyy-MM-dd')
    const weekStart = format(new Date(new Date().setDate(new Date().getDate() - new Date().getDay())), 'yyyy-MM-dd')
    const weekEnd = format(new Date(new Date().setDate(new Date().getDate() + (6 - new Date().getDay()))), 'yyyy-MM-dd')
    
    const todayReservations = reservationsData.filter(r => r.reservation_date === today).length
    const weekReservations = reservationsData.filter(r => r.reservation_date >= weekStart && r.reservation_date <= weekEnd).length
    const confirmedReservations = reservationsData.filter(r => r.status === 'confirmed' || r.status === 'completed')
    const totalRevenue = confirmedReservations.reduce((sum, r) => {
      // Omakase is $99 per person, dining is estimated $40 per person average
      const pricePerPerson = r.type === 'omakase' ? 99 : 40
      return sum + (r.party_size * pricePerPerson)
    }, 0)
    const avgPartySize = confirmedReservations.length > 0 ? 
      confirmedReservations.reduce((sum, r) => sum + r.party_size, 0) / confirmedReservations.length : 0
    
    setStats({
      todayReservations,
      weekReservations,
      totalRevenue,
      avgPartySize: Math.round(avgPartySize * 10) / 10
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
      notes: reservation.notes || ''
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
    try {
      const reservationData = {
        ...newReservation,
        status: 'confirmed',
        confirmation_code: nanoid(8).toUpperCase()
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
      
      const wasCancelled = currentReservation?.status === 'cancelled'
      const reservationType = currentReservation.type
      
      let updates: any = { status: newStatus }
      
      // If changing from cancelled to confirmed, clear cancellation data and generate confirmation code
      if (wasCancelled && newStatus === 'confirmed') {
        updates.cancellation_reason = null
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

      // If changing from cancelled to confirmed, send confirmation email
      if (wasCancelled && newStatus === 'confirmed') {
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
          <p className="mt-4 text-copper elegant-subtitle">Loading dashboard...</p>
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
      <header className="liquid-glass shadow py-6 px-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Image 
              src="/logo_transparent.png" 
              alt="TooHot Restaurant Logo" 
              width={48}
              height={48}
              className="object-contain"
              priority
            />
          </div>
          <div>
            <h1 className="text-2xl font-playfair text-copper font-semibold">
              TooHot Admin
            </h1>
            <p className="text-sm text-charcoal mt-1">Reservation Management Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowNewReservationForm(true)}
            className="group relative bg-gradient-to-r from-emerald-600 to-green-600 text-white px-6 py-3 rounded-xl hover:from-emerald-700 hover:to-green-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
          >
            <span className="text-lg">+</span>
            <span>New Reservation</span>
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </button>
          <button
            onClick={logout}
            className="group relative bg-gradient-to-r from-copper to-amber-700 text-white px-6 py-3 rounded-xl hover:from-copper/90 hover:to-amber-800 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            <span>Logout</span>
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full py-8 px-4">
        {/* Calendar and Reservations Side by Side */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-12">
          
          {/* Calendar View - Left Side */}
          <div className="xl:col-span-1">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-playfair text-copper">30 Days Overview</h2>
              <div className="flex items-center gap-2 text-xs text-charcoal/60">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Confirmed</span>
                </div>
                <div className="flex items-center gap-1 ml-3">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span>Action Required</span>
                </div>
              </div>
            </div>
            <div className="liquid-glass rounded-2xl shadow-lg p-8 overflow-x-auto wabi-sabi-border backdrop-blur-xl border border-white/20">
              {/* Calendar header: Mon-Sun */}
                              <div className="grid grid-cols-7 mb-3">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
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
                  
                  return (
                    <button
                      key={key}
                      className={`relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-sm hover:bg-sand-beige/40 cursor-pointer
                        ${isToday(day) ? 'border-copper bg-sand-beige/60 shadow' : 'border-transparent bg-white/40'}
                        ${selectedDate && isSameDay(day, selectedDate) ? 'ring-2 ring-copper' : ''}
                      `}
                      onClick={() => setSelectedDate(day)}
                    >
                      <span className="font-playfair text-lg font-semibold">{format(day, 'd')}</span>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-xs text-copper">{reservationsForDay.length}</span>
                        <div className="flex items-center gap-0.5">
                          {hasPending && <div className="w-2 h-2 bg-red-500 rounded-full"></div>}
                          {hasConfirmed && <div className="w-2 h-2 bg-green-500 rounded-full"></div>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Daily Reservations List - Right Side */}
          <div className="xl:col-span-2">
            {/* Search and Filter Controls - Always visible */}
            <div className="flex flex-col gap-4 mb-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-copper/60 text-lg">🔍</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Search all reservations..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-12 pr-4 py-3 w-full rounded-xl border border-white/20 bg-white/50 backdrop-blur-sm focus:ring-2 focus:ring-copper/20 focus:border-copper/20 transition-all duration-300 placeholder:text-charcoal/40"
                  />
                </div>
                <div className="flex flex-wrap gap-4">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-3 rounded-xl border border-white/20 bg-white/50 backdrop-blur-sm focus:ring-2 focus:ring-copper/20 focus:border-copper/20 transition-all duration-300 text-charcoal min-w-[150px]"
                  >
                    <option value="all">All Statuses</option>
                    {RESERVATION_STATUSES.map(status => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 px-4 py-3 rounded-xl border border-white/20 bg-white/50 backdrop-blur-sm cursor-pointer hover:bg-white/60 transition-all duration-300">
                    <input
                      type="checkbox"
                      checked={showCancelled}
                      onChange={(e) => setShowCancelled(e.target.checked)}
                      className="form-checkbox h-5 w-5 text-copper rounded border-copper/20 focus:ring-copper"
                    />
                    <span className="text-charcoal">Show Cancelled</span>
                  </label>
                </div>
              </div>
            </div>

            {selectedDate ? (
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
                                {RESERVATION_STATUSES.find(s => s.value === reservation.status)?.label || reservation.status}
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
                                <option key={status.value} value={status.value}>{status.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Expanded Details - Show on Hover/Click */}
                        {expandedCard === reservation.id && (
                          <div className="mt-4 pt-4 border-t border-copper/20 animate-in slide-in-from-top-2 duration-200">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-charcoal">
                              <div>
                                <span className="font-semibold text-copper">Email:</span> {reservation.customer_email}
                              </div>
                              <div>
                                <span className="font-semibold text-copper">Phone:</span> {reservation.customer_phone}
                              </div>
                              <div>
                                <span className="font-semibold text-copper">Confirmation:</span> <span className="font-mono">{reservation.confirmation_code}</span>
                              </div>
                              <div>
                                <span className="font-semibold text-copper">Revenue:</span> ${reservation.party_size * (reservation.type === 'omakase' ? 99 : 40)}
                              </div>
                              <div>
                                <span className="font-semibold text-copper">Created:</span> {format(new Date(reservation.created_at), 'MMM d, yyyy')}
                              </div>
                              <div>
                                <span className="font-semibold text-copper">Full Date:</span> {format(new Date(reservation.reservation_date), 'MMMM d, yyyy')}
                              </div>
                            </div>

                            {reservation.special_requests && (
                              <div className="mt-3 p-3 bg-white/30 rounded-lg">
                                <span className="font-semibold text-copper">Special Requests:</span>
                                <p className="mt-1 text-charcoal">{reservation.special_requests}</p>
                              </div>
                            )}

                            {reservation.notes && (
                              <div className="mt-3 p-3 bg-white/30 rounded-lg">
                                <span className="font-semibold text-copper">Internal Notes:</span>
                                <p className="mt-1 text-charcoal">{reservation.notes}</p>
                              </div>
                            )}

                            {reservation.cancellation_reason && (
                              <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                                <span className="font-semibold text-red-600">Cancellation Reason:</span>
                                <p className="mt-1 text-red-600">{reservation.cancellation_reason}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-charcoal/60">
                      No reservations for this date
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-charcoal/60">
                Select a date to view reservations
              </div>
            )}

            {/* Global Search Results */}
            {searchTerm && !selectedDate && (
              <div className="mt-6 space-y-4">
                <h3 className="text-lg font-medium text-charcoal mb-4">Search Results</h3>
                {searchAllReservations().map((reservation) => (
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
                            {RESERVATION_STATUSES.find(s => s.value === reservation.status)?.label || reservation.status}
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
                            <option key={status.value} value={status.value}>{status.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Expanded Details - Show on Hover/Click */}
                    {expandedCard === reservation.id && (
                      <div className="mt-4 pt-4 border-t border-copper/20 animate-in slide-in-from-top-2 duration-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-charcoal">
                          <div>
                            <span className="font-semibold text-copper">Email:</span> {reservation.customer_email}
                          </div>
                          <div>
                            <span className="font-semibold text-copper">Phone:</span> {reservation.customer_phone}
                          </div>
                          <div>
                            <span className="font-semibold text-copper">Confirmation:</span> <span className="font-mono">{reservation.confirmation_code}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-copper">Revenue:</span> ${reservation.party_size * (reservation.type === 'omakase' ? 99 : 40)}
                          </div>
                          <div>
                            <span className="font-semibold text-copper">Created:</span> {format(new Date(reservation.created_at), 'MMM d, yyyy')}
                          </div>
                          <div>
                            <span className="font-semibold text-copper">Full Date:</span> {format(new Date(reservation.reservation_date), 'MMMM d, yyyy')}
                          </div>
                        </div>

                        {reservation.special_requests && (
                          <div className="mt-3 p-3 bg-white/30 rounded-lg">
                            <span className="font-semibold text-copper">Special Requests:</span>
                            <p className="mt-1 text-charcoal">{reservation.special_requests}</p>
                          </div>
                        )}

                        {reservation.notes && (
                          <div className="mt-3 p-3 bg-white/30 rounded-lg">
                            <span className="font-semibold text-copper">Internal Notes:</span>
                            <p className="mt-1 text-charcoal">{reservation.notes}</p>
                          </div>
                        )}

                        {reservation.cancellation_reason && (
                          <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                            <span className="font-semibold text-red-600">Cancellation Reason:</span>
                            <p className="mt-1 text-red-600">{reservation.cancellation_reason}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stats Cards - Moved After Calendar/Reservations */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className="group relative liquid-glass p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 wabi-sabi-border overflow-hidden transform hover:-translate-y-0.5">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-copper/20 to-transparent rounded-full transform translate-x-6 -translate-y-6"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-copper">Today's Reservations</h3>
                <div className="w-8 h-8 bg-gradient-to-br from-copper/20 to-copper/10 rounded-lg flex items-center justify-center">
                  <span className="text-lg">📅</span>
                </div>
              </div>
              <p className="text-3xl font-bold text-ink-black mb-1">{stats.todayReservations}</p>
              <p className="text-xs text-charcoal/60">Active reservations</p>
            </div>
          </div>
          
          <div className="group relative liquid-glass p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 wabi-sabi-border overflow-hidden transform hover:-translate-y-0.5">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-emerald-500/20 to-transparent rounded-full transform translate-x-6 -translate-y-6"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-copper">This Week</h3>
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 rounded-lg flex items-center justify-center">
                  <span className="text-lg">📊</span>
                </div>
              </div>
              <p className="text-3xl font-bold text-ink-black mb-1">{stats.weekReservations}</p>
              <p className="text-xs text-charcoal/60">Weekly bookings</p>
            </div>
          </div>
          
          <div className="group relative liquid-glass p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 wabi-sabi-border overflow-hidden transform hover:-translate-y-0.5">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-amber-500/20 to-transparent rounded-full transform translate-x-6 -translate-y-6"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-copper">Total Revenue</h3>
                <div className="w-8 h-8 bg-gradient-to-br from-amber-500/20 to-amber-500/10 rounded-lg flex items-center justify-center">
                  <span className="text-lg">💰</span>
                </div>
              </div>
              <p className="text-3xl font-bold text-ink-black mb-1">${stats.totalRevenue.toLocaleString()}</p>
              <p className="text-xs text-charcoal/60">Confirmed bookings</p>
            </div>
          </div>
          
          <div className="group relative liquid-glass p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 wabi-sabi-border overflow-hidden transform hover:-translate-y-0.5">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-purple-500/20 to-transparent rounded-full transform translate-x-6 -translate-y-6"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-copper">Avg Party Size</h3>
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500/20 to-purple-500/10 rounded-lg flex items-center justify-center">
                  <span className="text-lg">👥</span>
                </div>
              </div>
              <p className="text-3xl font-bold text-ink-black mb-1">{stats.avgPartySize}</p>
              <p className="text-xs text-charcoal/60">People per table</p>
            </div>
          </div>
        </section>

        {/* System Status */}
        <section className="liquid-glass p-8 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-500 wabi-sabi-border transform hover:-translate-y-1">
          <h3 className="elegant-subtitle text-copper mb-6 text-xl">System Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center gap-3 p-4 bg-white/40 rounded-xl">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-ink-black font-medium">Database</span>
              <span className="font-bold text-green-600 ml-auto">Connected</span>
            </div>
            <div className="flex items-center gap-3 p-4 bg-white/40 rounded-xl">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-ink-black font-medium">Email Service</span>
              <span className="font-bold text-green-600 ml-auto">Active</span>
            </div>
            <div className="flex items-center gap-3 p-4 bg-white/40 rounded-xl">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-ink-black font-medium">API Status</span>
              <span className="font-bold text-green-600 ml-auto">Healthy</span>
            </div>
          </div>
        </section>
      </main>

      {/* Edit Reservation Modal */}
      {editingReservation && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-sand-beige/95 to-white/90 backdrop-blur-xl rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-copper/20">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-playfair text-copper">Edit Reservation</h2>
              <button
                onClick={() => setEditingReservation(null)}
                className="w-10 h-10 rounded-full bg-sand-beige/60 hover:bg-sand-beige/80 flex items-center justify-center transition-colors duration-200"
              >
                <span className="text-gray-600">✕</span>
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div>
                <label className="block text-sm font-semibold text-ink-black mb-3">Customer Name</label>
                <input
                  type="text"
                  value={editingReservation.customer_name}
                  onChange={(e) => setEditingReservation({...editingReservation, customer_name: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-copper/20 rounded-xl focus:ring-2 focus:ring-copper focus:border-copper transition-all duration-300 bg-sand-beige/40 text-ink-black placeholder:text-gray-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-ink-black mb-3">Email</label>
                <input
                  type="email"
                  value={editingReservation.customer_email}
                  onChange={(e) => setEditingReservation({...editingReservation, customer_email: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-copper/20 rounded-xl focus:ring-2 focus:ring-copper focus:border-copper transition-all duration-300 bg-sand-beige/40 text-ink-black placeholder:text-gray-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-ink-black mb-3">Phone</label>
                <input
                  type="tel"
                  value={editingReservation.customer_phone}
                  onChange={(e) => setEditingReservation({...editingReservation, customer_phone: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-copper/20 rounded-xl focus:ring-2 focus:ring-copper focus:border-copper transition-all duration-300 bg-sand-beige/40 text-ink-black placeholder:text-gray-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-ink-black mb-3">Party Size</label>
                <input
                  type="number"
                  min="1"
                  max="15"
                  value={editingReservation.party_size}
                  onChange={(e) => setEditingReservation({...editingReservation, party_size: parseInt(e.target.value)})}
                  className="w-full px-4 py-3 border-2 border-copper/20 rounded-xl focus:ring-2 focus:ring-copper focus:border-copper transition-all duration-300 bg-sand-beige/40 text-ink-black placeholder:text-gray-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-ink-black mb-3">Date</label>
                <input
                  type="date"
                  value={editingReservation.reservation_date}
                  onChange={(e) => setEditingReservation({...editingReservation, reservation_date: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-copper/20 rounded-xl focus:ring-2 focus:ring-copper focus:border-copper transition-all duration-300 bg-sand-beige/40 text-ink-black"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-ink-black mb-3">Time</label>
                <select
                  value={editingReservation.reservation_time}
                  onChange={(e) => setEditingReservation({...editingReservation, reservation_time: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-copper/20 rounded-xl focus:ring-2 focus:ring-copper focus:border-copper transition-all duration-300 bg-sand-beige/40 text-ink-black"
                >
                  {TIME_SLOTS.map(time => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-semibold text-ink-black mb-3">Special Requests</label>
              <textarea
                value={editingReservation.special_requests}
                onChange={(e) => setEditingReservation({...editingReservation, special_requests: e.target.value})}
                rows={3}
                className="w-full px-4 py-3 border-2 border-copper/20 rounded-xl focus:ring-2 focus:ring-copper focus:border-copper transition-all duration-300 bg-sand-beige/40 text-ink-black placeholder:text-gray-500"
                placeholder="Any special dietary requirements or requests..."
              />
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-semibold text-ink-black mb-3">Internal Notes</label>
              <textarea
                value={editingReservation.notes}
                onChange={(e) => setEditingReservation({...editingReservation, notes: e.target.value})}
                rows={2}
                className="w-full px-4 py-3 border-2 border-copper/20 rounded-xl focus:ring-2 focus:ring-copper focus:border-copper transition-all duration-300 bg-sand-beige/40 text-ink-black placeholder:text-gray-500"
                placeholder="Internal notes (not visible to customer)"
              />
            </div>
            
            <div className="flex gap-4 justify-end pt-6 border-t border-copper/20">
              <button
                onClick={() => setEditingReservation(null)}
                className="group relative px-8 py-3 border-2 border-gray-300 rounded-xl hover:border-gray-400 transition-all duration-300 font-semibold bg-white shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
              >
                <span>Cancel</span>
              </button>
              <button
                onClick={handleSaveEdit}
                className="group relative bg-gradient-to-r from-emerald-600 to-green-600 text-white px-8 py-3 rounded-xl hover:from-emerald-700 hover:to-green-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <span>Save Changes</span>
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
                <label className="block text-sm font-semibold text-ink-black mb-3">Email *</label>
                <input
                  type="email"
                  value={newReservation.customer_email}
                  onChange={(e) => setNewReservation({...newReservation, customer_email: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-copper/20 rounded-xl focus:ring-2 focus:ring-copper focus:border-copper transition-all duration-300 bg-sand-beige/40 text-ink-black placeholder:text-gray-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-ink-black mb-3">Phone *</label>
                <input
                  type="tel"
                  value={newReservation.customer_phone}
                  onChange={(e) => setNewReservation({...newReservation, customer_phone: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-copper/20 rounded-xl focus:ring-2 focus:ring-copper focus:border-copper transition-all duration-300 bg-sand-beige/40 text-ink-black placeholder:text-gray-500"
                  required
                />
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
                  {TIME_SLOTS.map(time => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
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
                disabled={!newReservation.customer_name || !newReservation.customer_email || !newReservation.customer_phone || !newReservation.reservation_date}
              >
                <span>Create Reservation</span>
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 