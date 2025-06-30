import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const startTime = Date.now()
  
  // Security headers
  const response = NextResponse.next()
  
  // Security headers for production
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  
  // CORS headers for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    response.headers.set('Access-Control-Allow-Origin', process.env.NEXT_PUBLIC_SITE_URL || '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  }
  
  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 200, headers: response.headers })
  }
  
  // Rate limiting for API routes (basic implementation)
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'
    
    // Log API requests for monitoring
    console.log(`API Request: ${request.method} ${request.nextUrl.pathname} from ${ip}`)
  }
  
  // Performance monitoring
  const endTime = Date.now()
  const duration = endTime - startTime
  
  if (duration > 1000) {
    console.warn(`Slow request: ${request.nextUrl.pathname} took ${duration}ms`)
  }
  
  // Add performance header
  response.headers.set('X-Response-Time', `${duration}ms`)
  
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)',
  ],
} 