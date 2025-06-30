import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    const startTime = Date.now()
    
    // Test database connection
    const { data: dbTest, error: dbError } = await supabaseAdmin
      .from('admin_settings')
      .select('setting_key')
      .limit(1)
    
    const dbLatency = Date.now() - startTime
    
    // Check if all required environment variables are present
    const requiredEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'RESEND_API_KEY',
      'ADMIN_PASSWORD'
    ]
    
    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName])
    
    // Basic system health
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks: {
        database: {
          status: dbError ? 'error' : 'connected',
          latency: `${dbLatency}ms`,
          error: dbError?.message || null
        },
        environment: {
          status: missingEnvVars.length === 0 ? 'configured' : 'missing_variables',
          missing: missingEnvVars
        },
        memory: {
          used: process.memoryUsage().heapUsed,
          total: process.memoryUsage().heapTotal,
          percentage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100)
        }
      }
    }
    
    // Determine overall health status
    const hasErrors = dbError || missingEnvVars.length > 0
    if (hasErrors) {
      health.status = 'degraded'
    }
    
    // Return appropriate HTTP status
    const httpStatus = hasErrors ? 503 : 200
    
    return NextResponse.json(health, { status: httpStatus })
    
  } catch (error) {
    console.error('Health check failed:', error)
    
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      checks: {
        database: { status: 'error' },
        environment: { status: 'error' },
        memory: { status: 'error' }
      }
    }, { status: 500 })
  }
} 