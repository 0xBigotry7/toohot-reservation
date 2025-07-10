import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// GET - Fetch all email templates
export async function GET(request: NextRequest) {
  try {
    console.log('Email templates API called')
    
    // Check if environment variables are available
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing environment variables:', {
        SUPABASE_URL: !!supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: !!supabaseServiceKey
      })
      
      return NextResponse.json({ 
        error: 'Server configuration error: Missing environment variables',
        details: {
          SUPABASE_URL: !!supabaseUrl,
          SUPABASE_SERVICE_ROLE_KEY: !!supabaseServiceKey
        }
      }, { status: 500 })
    }
    
    console.log('Environment variables OK')
    
    // Create Supabase client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    console.log('Supabase client created')
    
    const { searchParams } = new URL(request.url)
    const template_type = searchParams.get('type')
    const active_only = searchParams.get('active') === 'true'
    
    console.log('Query parameters:', { template_type, active_only })
    
    // Test connection with a simple query first
    console.log('Testing Supabase connection...')
    const { data: testData, error: testError } = await supabaseAdmin
      .from('email_templates')
      .select('count')
      .limit(1)
    
    if (testError) {
      console.error('Supabase connection test failed:', testError)
      return NextResponse.json({ 
        error: 'Database connection failed',
        details: testError.message
      }, { status: 500 })
    }
    
    console.log('Supabase connection test passed')
    
    // Build the main query using correct column names
    let query = supabaseAdmin
      .from('email_templates')
      .select('*')
      .order('name', { ascending: true })
    
    // Note: filtering by template_type and active status removed since these columns may not exist
    // We'll handle filtering in the application layer if needed
    
    if (active_only) {
      query = query.eq('active', true)
    }
    
    console.log('Executing main query...')
    const { data, error } = await query
    
    if (error) {
      console.error('Main query failed:', error)
      return NextResponse.json({ 
        error: 'Failed to fetch email templates',
        details: error.message
      }, { status: 500 })
    }
    
    console.log('Templates fetched successfully:', data?.length || 0, 'templates')
    return NextResponse.json({ templates: data || [] })
    
  } catch (error) {
    console.error('Unexpected error in email templates API:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST - Create new email template
export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ 
        error: 'Server configuration error: Missing environment variables'
      }, { status: 500 })
    }
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    const body = await request.json()
    
    const {
      key,
      name,
      subject,
      html,
      active = true
    } = body
    
    // Validate required fields
    if (!key || !name || !subject || !html) {
      return NextResponse.json({ 
        error: 'Missing required fields: key, name, subject, html' 
      }, { status: 400 })
    }
    
    // Validate key format (alphanumeric and underscores only)
    const keyRegex = /^[a-zA-Z0-9_]+$/
    if (!keyRegex.test(key)) {
      return NextResponse.json({ 
        error: 'key must contain only alphanumeric characters and underscores' 
      }, { status: 400 })
    }
    
    // Check if key already exists
    const { data: existingTemplate } = await supabaseAdmin
      .from('email_templates')
      .select('id')
      .eq('key', key)
      .single()
    
    if (existingTemplate) {
      return NextResponse.json({ 
        error: 'Template key already exists. Please use a unique key.' 
      }, { status: 400 })
    }
    
    const { data, error } = await supabaseAdmin
      .from('email_templates')
      .insert({
        key,
        name,
        subject,
        html,
        active
      })
      .select()
      .single()
    
    if (error) {
      console.error('Error creating email template:', error)
      return NextResponse.json({ error: 'Failed to create email template' }, { status: 500 })
    }
    
    return NextResponse.json({ 
      success: true, 
      template: data,
      message: 'Email template created successfully' 
    })
  } catch (error) {
    console.error('POST email template error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 