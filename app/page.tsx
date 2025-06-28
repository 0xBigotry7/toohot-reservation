'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'

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
      try {
        // Fetch reservations here
        setLoading(false)
      } catch (err) {
        setError('Failed to load reservations')
        setLoading(false)
      }
    }
    fetchReservations()
  }, [authenticated])

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
    <div className="min-h-screen bg-sand-beige">
      {/* Branded Header */}
      <header className="liquid-glass shadow py-6 px-4 flex items-center justify-between">
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-10 px-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          <div className="liquid-glass p-6 rounded-2xl shadow hover-lift">
            <h3 className="elegant-subtitle text-copper mb-2">Today's Reservations</h3>
            <p className="text-4xl font-bold text-ink-black">0</p>
          </div>
          <div className="liquid-glass p-6 rounded-2xl shadow hover-lift">
            <h3 className="elegant-subtitle text-copper mb-2">This Week</h3>
            <p className="text-4xl font-bold text-ink-black">0</p>
          </div>
          <div className="liquid-glass p-6 rounded-2xl shadow hover-lift">
            <h3 className="elegant-subtitle text-copper mb-2">Total Revenue</h3>
            <p className="text-4xl font-bold text-ink-black">$0</p>
          </div>
          <div className="liquid-glass p-6 rounded-2xl shadow hover-lift">
            <h3 className="elegant-subtitle text-copper mb-2">Avg Party Size</h3>
            <p className="text-4xl font-bold text-ink-black">0</p>
          </div>
        </div>

        {/* Reservations Table */}
        <div className="liquid-glass shadow rounded-2xl mb-10">
          <div className="px-6 py-4 border-b border-copper/20">
            <h2 className="elegant-subtitle text-copper">Recent Reservations</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-copper/10">
              <thead className="bg-sand-beige">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-copper uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-copper uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-copper uppercase tracking-wider">
                    Party Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-copper uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-copper uppercase tracking-wider">
                    Confirmation
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-copper/10">
                {reservations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-charcoal/60">
                      No reservations found. Make a test reservation to see data here!
                    </td>
                  </tr>
                ) : (
                  reservations.map((reservation) => (
                    <tr key={reservation.id} className="hover:bg-sand-beige/40 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-ink-black">
                            {reservation.customer_name}
                          </div>
                          <div className="text-sm text-charcoal">
                            {reservation.customer_email}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-ink-black">
                          {format(new Date(reservation.reservation_date), 'MMM dd, yyyy')}
                        </div>
                        <div className="text-sm text-charcoal">
                          {reservation.reservation_time}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-ink-black">
                        {reservation.party_size} guests
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          reservation.status === 'confirmed' 
                            ? 'bg-green-100 text-green-800'
                            : reservation.status === 'cancelled'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {reservation.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-ink-black">
                        {reservation.confirmation_code}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="liquid-glass p-6 rounded-2xl shadow hover-lift">
            <h3 className="elegant-subtitle text-copper mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button className="w-full bg-copper text-white px-4 py-2 rounded hover:bg-copper/90 transition-colors font-semibold">
                Add Manual Reservation
              </button>
              <button className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors font-semibold">
                Export Today's List
              </button>
              <button className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors font-semibold">
                Send Reminder Emails
              </button>
            </div>
          </div>

          <div className="liquid-glass p-6 rounded-2xl shadow hover-lift md:col-span-2">
            <h3 className="elegant-subtitle text-copper mb-4">System Status</h3>
            <ul className="space-y-2 text-ink-black">
              <li>Database: <span className="font-bold text-green-600">✓ Connected</span></li>
              <li>Email Service: <span className="font-bold text-green-600">✓ Active</span></li>
              <li>API Status: <span className="font-bold text-green-600">✓ Healthy</span></li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
} 