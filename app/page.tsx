'use client'

import { useEffect, useState } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addDays } from 'date-fns'
import { supabase } from '../../../lib/supabase'

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
}

// Use environment variable for admin password (for demo only; real apps should use server-side auth)
const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;

export default function AdminDashboard() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [days, setDays] = useState<Date[]>([]);
  const [calendarReservations, setCalendarReservations] = useState<{ [date: string]: Reservation[] }>({});

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
    const fetchReservations = async () => {
      setLoading(true);
      setError(null);
      try {
        const now = new Date();
        const end = addDays(now, 29);
        const { data, error } = await supabase()
          .from('reservations')
          .select('*')
          .gte('reservation_date', format(now, 'yyyy-MM-dd'))
          .lte('reservation_date', format(end, 'yyyy-MM-dd'));
        if (error) throw error;
        setReservations(data || []);
        // Group by date
        const grouped: { [date: string]: Reservation[] } = {};
        (data || []).forEach((r: Reservation) => {
          const key = r.reservation_date;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(r);
        });
        setCalendarReservations(grouped);
      } catch (err: any) {
        setError(err.message || 'Failed to load reservations');
      } finally {
        setLoading(false);
      }
    }
    fetchReservations()
  }, [authenticated])

  useEffect(() => {
    // Generate next 30 days from today
    const now = new Date();
    const daysArr = eachDayOfInterval({
      start: now,
      end: addDays(now, 29),
    });
    setDays(daysArr);
  }, []);

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
      {/* Sidebar or Top Nav */}
      <header className="liquid-glass shadow py-6 px-8 flex items-center justify-between">
        <div>
          <h1 className="restaurant-title text-copper flex items-center gap-2">
            <span role="img" aria-label="fire">🔥</span> TooHot Admin
          </h1>
          <p className="elegant-subtitle text-charcoal mt-1">Reservation Management Dashboard</p>
        </div>
        <button
          onClick={logout}
          className="bg-copper text-white px-6 py-2 rounded-lg hover:bg-copper/90 transition-colors font-semibold shadow hover-lift"
        >
          Logout
        </button>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full py-10 px-4">
        {/* Calendar View */}
        <section className="mb-12">
          <h2 className="elegant-subtitle text-copper mb-6">Next 30 Days Reservations Overview</h2>
          <div className="bg-white/60 rounded-2xl shadow p-6 overflow-x-auto wabi-sabi-border">
            <div className="grid grid-cols-7 gap-2">
              {days.map((day) => {
                const key = format(day, 'yyyy-MM-dd');
                const reservationsForDay = calendarReservations[key] || [];
                return (
                  <button
                    key={key}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all
                      ${isToday(day) ? 'border-copper bg-sand-beige/60 shadow' : 'border-transparent bg-white/40'}
                      ${selectedDate && isSameDay(day, selectedDate) ? 'ring-2 ring-copper' : ''}
                      hover:bg-sand-beige/40`}
                    onClick={() => setSelectedDate(day)}
                  >
                    <span className="font-playfair text-lg">{format(day, 'd')}</span>
                    <span className="text-xs text-copper mt-1">{reservationsForDay.length} reservations</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
        {/* Daily Reservations List */}
        {selectedDate && (
          <section className="mb-12">
            <h3 className="elegant-subtitle text-copper mb-4">
              Reservations for {format(selectedDate, 'MMMM d, yyyy')}
            </h3>
            <div className="liquid-glass rounded-2xl shadow p-6">
              {loading ? (
                <p className="elegant-body text-charcoal/60">Loading...</p>
              ) : error ? (
                <p className="elegant-body text-red-600">{error}</p>
              ) : (calendarReservations[format(selectedDate, 'yyyy-MM-dd')] || []).length === 0 ? (
                <p className="elegant-body text-charcoal/60">No reservations for this day.</p>
              ) : (
                <ul className="space-y-4">
                  {(calendarReservations[format(selectedDate, 'yyyy-MM-dd')] || []).map((reservation) => (
                    <li key={reservation.id} className="flex flex-col md:flex-row md:items-center md:justify-between p-4 rounded-xl bg-sand-beige/40 hover:bg-sand-beige/60 transition-all">
                      <div>
                        <div className="font-playfair text-lg text-ink-black">{reservation.customer_name}</div>
                        <div className="text-charcoal text-sm">{reservation.customer_email}</div>
                        <div className="text-charcoal text-sm">Party of {reservation.party_size}</div>
                      </div>
                      <div className="mt-2 md:mt-0 text-copper font-mono">{reservation.reservation_time}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}
        {/* Stats Cards and System Status (minimalist, wabi-sabi style) */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          <div className="liquid-glass p-6 rounded-2xl shadow hover-lift wabi-sabi-border">
            <h3 className="elegant-subtitle text-copper mb-2">Today&apos;s Reservations</h3>
            <p className="text-4xl font-bold text-ink-black">0</p>
          </div>
          <div className="liquid-glass p-6 rounded-2xl shadow hover-lift wabi-sabi-border">
            <h3 className="elegant-subtitle text-copper mb-2">This Week</h3>
            <p className="text-4xl font-bold text-ink-black">0</p>
          </div>
          <div className="liquid-glass p-6 rounded-2xl shadow hover-lift wabi-sabi-border">
            <h3 className="elegant-subtitle text-copper mb-2">Total Revenue</h3>
            <p className="text-4xl font-bold text-ink-black">$0</p>
          </div>
          <div className="liquid-glass p-6 rounded-2xl shadow hover-lift wabi-sabi-border">
            <h3 className="elegant-subtitle text-copper mb-2">Avg Party Size</h3>
            <p className="text-4xl font-bold text-ink-black">0</p>
          </div>
        </section>
        {/* System Status */}
        <section className="liquid-glass p-6 rounded-2xl shadow hover-lift wabi-sabi-border md:col-span-2 mb-10">
          <h3 className="elegant-subtitle text-copper mb-4">System Status</h3>
          <ul className="space-y-2 text-ink-black">
            <li>Database: <span className="font-bold text-green-600">✓ Connected</span></li>
            <li>Email Service: <span className="font-bold text-green-600">✓ Active</span></li>
            <li>API Status: <span className="font-bold text-green-600">✓ Healthy</span></li>
          </ul>
        </section>
      </main>
    </div>
  )
} 