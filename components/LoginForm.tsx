'use client'

import { useState } from 'react'
import Image from 'next/image'

interface LoginFormProps {
  onLogin: (role: 'admin' | 'reservations') => void
  onError: (message: string) => void
}

export default function LoginForm({ onLogin, onError }: LoginFormProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) {
      onError('Please enter both username and password')
      return
    }

    setLoading(true)

    try {
      // Updated credentials as requested
      const ADMIN_PASSWORD = '18toohot'
      const RESERVATIONS_PASSWORD = 'toohot2025!'

      // Debug logging
      console.log('Login attempt:', { username, passwordLength: password.length })
      console.log('Credentials check:', { 
        ADMIN_PASSWORD: ADMIN_PASSWORD ? 'SET' : 'NOT SET',
        RESERVATIONS_PASSWORD: RESERVATIONS_PASSWORD ? 'SET' : 'NOT SET'
      })

      // Check credentials and determine role
      if (username === 'admin' && password === ADMIN_PASSWORD) {
        console.log('Admin login successful')
        localStorage.setItem('admin-authenticated', 'true')
        localStorage.setItem('user-role', 'admin')
        localStorage.setItem('username', username)
        onLogin('admin')
      } else if (username === 'toohot_manager' && password === RESERVATIONS_PASSWORD) {
        console.log('Reservations login successful')
        localStorage.setItem('admin-authenticated', 'true')
        localStorage.setItem('user-role', 'reservations')
        localStorage.setItem('username', username)
        onLogin('reservations')
      } else {
        console.log('Login failed - credentials do not match')
        onError('Invalid username or password. Please try again.')
      }
    } catch (error) {
      onError('Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
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
      <div className="relative z-10 w-full max-w-md">
        <div className="liquid-glass rounded-3xl p-8 border border-copper/10 shadow-2xl">
          {/* Logo and Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Image 
                src="/logo_transparent.png" 
                alt="TooHot Restaurant Logo" 
                width={64}
                height={64}
                className="object-contain"
                priority
              />
            </div>
            <h1 className="text-2xl font-playfair text-copper font-semibold mb-2">
              TooHot Admin
            </h1>
            <p className="text-sm text-charcoal/60">
              Reservation Management System
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-charcoal/70 mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-white/60 rounded-xl border border-copper/20 focus:outline-none focus:ring-2 focus:ring-copper/20 focus:border-copper/20 transition-all duration-300 placeholder:text-charcoal/40"
                placeholder="Enter your username"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-charcoal/70 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white/60 rounded-xl border border-copper/20 focus:outline-none focus:ring-2 focus:ring-copper/20 focus:border-copper/20 transition-all duration-300 placeholder:text-charcoal/40"
                placeholder="Enter your password"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full bg-gradient-to-r from-copper to-amber-700 text-white px-6 py-3 rounded-xl hover:from-copper/90 hover:to-amber-800 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-md"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Signing in...
                </div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* User Types Info */}
          <div className="mt-8 pt-6 border-t border-copper/10">
            <p className="text-xs text-charcoal/50 text-center mb-3">Access Levels:</p>
            <div className="space-y-2 text-xs text-charcoal/60">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span><strong>admin:</strong> Full system access</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span><strong>toohot_manager:</strong> Reservation management only</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 