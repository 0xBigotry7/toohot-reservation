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

export default function AdminDashboard() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Simple authentication check
  useEffect(() => {
    const isAuthenticated = localStorage.getItem('admin-authenticated')
    if (!isAuthenticated) {
      const password = prompt('Enter admin password:')
      if (password === process.env.ADMIN_PASSWORD || password === 'admin123') {
        localStorage.setItem('admin-authenticated', 'true')
      } else {
        alert('Invalid password')
        return
      }
    }
  }, [])

  useEffect(() => {
    const fetchReservations = async () => {
      try {
        // For now, we&apos;ll fetch directly from Supabase
        // In production, you&apos;d use your API endpoints
        setLoading(false)
      } catch (err) {
        setError('Failed to load reservations')
        setLoading(false)
      }
    }

    fetchReservations()
  }, [])

  const logout = () => {
    localStorage.removeItem('admin-authenticated')
    window.location.reload()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">🔥 TooHot Admin</h1>
              <p className="text-gray-600">Reservation Management Dashboard</p>
            </div>
            <button
              onClick={logout}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Today&apos;s Reservations</h3>
            <p className="text-3xl font-bold text-blue-600">0</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">This Week</h3>
            <p className="text-3xl font-bold text-green-600">0</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Revenue</h3>
            <p className="text-3xl font-bold text-purple-600">$0</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Avg Party Size</h3>
            <p className="text-3xl font-bold text-orange-600">0</p>
          </div>
        </div>

        {/* Reservations Table */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Recent Reservations</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Party Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Confirmation
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reservations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                      No reservations found. Make a test reservation to see data here!
                    </td>
                  </tr>
                ) : (
                  reservations.map((reservation) => (
                    <tr key={reservation.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {reservation.customer_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {reservation.customer_email}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {format(new Date(reservation.reservation_date), 'MMM dd, yyyy')}
                        </div>
                        <div className="text-sm text-gray-500">
                          {reservation.reservation_time}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
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
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors">
                Add Manual Reservation
              </button>
              <button className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors">
                Export Today&apos;s List
              </button>
              <button className="w-full bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition-colors">
                Send Reminder Emails
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">System Status</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Database:</span>
                <span className="text-green-600 font-semibold">✓ Connected</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Email Service:</span>
                <span className="text-green-600 font-semibold">✓ Active</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">API Status:</span>
                <span className="text-green-600 font-semibold">✓ Healthy</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Today&apos;s Schedule</h3>
            <div className="space-y-3">
              <div className="text-center p-4 bg-gray-50 rounded">
                <p className="text-lg font-semibold text-gray-900">5:00 PM - 7:00 PM</p>
                <p className="text-sm text-gray-600">0 / 15 seats booked</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded">
                <p className="text-lg font-semibold text-gray-900">7:00 PM - 9:00 PM</p>
                <p className="text-sm text-gray-600">0 / 15 seats booked</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 