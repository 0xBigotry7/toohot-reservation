import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const errorData = await request.json()
    
    // Log error with server context
    console.error('Client Error Report:', {
      ...errorData,
      serverTimestamp: new Date().toISOString(),
      ip: request.ip || request.headers.get('x-forwarded-for') || 'unknown'
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to log client error:', error)
    return NextResponse.json({ error: 'Failed to log error' }, { status: 500 })
  }
} 