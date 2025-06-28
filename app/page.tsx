'use client'

import { useEffect, useState } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addDays, getDay, startOfWeek } from 'date-fns'
import { supabase } from '../lib/supabase'
import { nanoid } from 'nanoid'
import { useToast } from '../hooks/use-toast'

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
    const fetchReservations = async () => {
      setLoading(true);
      setError(null);
      try {
        const now = new Date();
        const end = addDays(now, 29);
        const { data, error } = await supabase()
          .from('omakase_reservations')
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
            {/* Calendar header: Mon-Sun */}
            <div className="grid grid-cols-7 mb-2">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} className="text-center font-playfair text-copper text-sm pb-1">{d}</div>
              ))}
            </div>
            {/* Calendar grid: 7 columns, fill with days, align first day to correct weekday */}
            <div className="grid grid-cols-7 gap-2">
              {/* Calculate offset for first day */}
              {(() => {
                const firstDay = days[0];
                const offset = (getDay(firstDay) + 6) % 7; // getDay: 0=Sunday, want 0=Monday
                return Array.from({ length: offset }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ));
              })()}
              {days.map((day) => {
                const key = format(day, 'yyyy-MM-dd');
                const reservationsForDay = calendarReservations[key] || [];
                const hasReservations = reservationsForDay.length > 0;
                const isThursday = getDay(day) === 4; // 4 = Thursday
                const isEnabled = isThursday || hasReservations;
                return (
                  <button
                    key={key}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all
                      ${isToday(day) ? 'border-copper bg-sand-beige/60 shadow' : 'border-transparent bg-white/40'}
                      ${selectedDate && isSameDay(day, selectedDate) ? 'ring-2 ring-copper' : ''}
                      ${isEnabled ? 'hover:bg-sand-beige/40 cursor-pointer' : 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-60'}
                    `}
                    onClick={isEnabled ? () => setSelectedDate(day) : undefined}
                    disabled={!isEnabled}
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
                        <div className="text-charcoal text-sm">Status: <span className="font-semibold">{reservation.status}</span></div>
                        <div className="text-charcoal text-sm">Confirmation: <span className="font-mono">{reservation.confirmation_code}</span></div>
                        {reservation.cancellation_reason && (
                          <div className="text-red-600 text-xs mt-1">Cancelled: {reservation.cancellation_reason}</div>
                        )}
                      </div>
                      <div className="mt-2 md:mt-0 text-copper font-mono flex flex-col items-end gap-2">
                        {reservation.status === 'pending' && (
                          <button
                            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors font-semibold"
                            onClick={async () => {
                              const confirmation_code = nanoid(8).toUpperCase();
                              // Call API route to update reservation with service role key
                              const res = await fetch('/api/confirm-omakase-reservation', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: reservation.id, confirmation_code })
                              });
                              if (!res.ok) {
                                const err = await res.json();
                                console.error('Supabase update error:', err);
                                toast({
                                  title: 'Failed to confirm reservation',
                                  description: err.error || 'Database update failed.',
                                  variant: 'destructive',
                                });
                                return;
                              }
                              const updated = await res.json();
                              // Call API to send confirmation email
                              const emailRes = await fetch('/api/send-omakase-confirmation', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ reservation: updated })
                              });
                              if (!emailRes.ok) {
                                const err = await emailRes.json();
                                console.error('Email API error:', err);
                                toast({
                                  title: 'Reservation confirmed, but email failed',
                                  description: err.error || 'Email could not be sent.',
                                  variant: 'destructive',
                                });
                              } else {
                                toast({
                                  title: 'Reservation Confirmed',
                                  description: 'The customer has been notified by email.',
                                  variant: 'default',
                                });
                              }
                              // Update UI with actual updated row
                              setReservations((prev) => prev.map(r => r.id === reservation.id ? updated : r));
                              setCalendarReservations((prev) => {
                                const key = reservation.reservation_date;
                                return {
                                  ...prev,
                                  [key]: prev[key].map(r => r.id === reservation.id ? updated : r)
                                };
                              });
                            }}
                          >
                            Confirm
                          </button>
                        )}
                        <div>{reservation.reservation_time}</div>
                      </div>
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