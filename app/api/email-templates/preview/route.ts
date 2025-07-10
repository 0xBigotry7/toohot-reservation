import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST - Preview email template with sample data
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { template_id, sample_data } = body
    
    if (!template_id) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 })
    }
    
    // Fetch the template
    const { data: template, error } = await supabaseAdmin
      .from('email_templates')
      .select('*')
      .eq('id', template_id)
      .single()
    
    if (error) {
      console.error('Error fetching email template:', error)
      return NextResponse.json({ error: 'Failed to fetch email template' }, { status: 500 })
    }
    
    if (!template) {
      return NextResponse.json({ error: 'Email template not found' }, { status: 404 })
    }
    
    // Generate sample data if not provided
    const defaultSampleData = {
      customer_name: 'John Doe',
      customer_email: 'john.doe@example.com',
      customer_phone: '(555) 123-4567',
      confirmation_code: 'ABC123XY',
      reservation_date: '2024-01-15',
      reservation_time: '19:00',
      party_size: 4,
      special_requests: 'Vegetarian options preferred',
      duration_minutes: 90,
      cancellation_reason: 'Schedule conflict',
      restaurant_email: process.env.RESTAURANT_EMAIL || 'team@toohot.kitchen',
      restaurant_phone: process.env.RESTAURANT_PHONE || '(617) 555-0123',
      notes: 'VIP customer'
    }
    
    const data = { ...defaultSampleData, ...sample_data }
    
    // Simple template variable replacement
    const replaceVariables = (content: string, data: any) => {
      let result = content
      
      // Replace {{variable}} patterns
      result = result.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
        const key = variable.trim()
        return data[key] !== undefined ? data[key] : match
      })
      
      // Handle {{#if variable}} blocks - simple implementation
      result = result.replace(/\{\{#if\s+([^}]+)\}\}(.*?)\{\{\/if\}\}/g, (match, variable, content) => {
        const key = variable.trim()
        return data[key] ? content : ''
      })
      
      return result
    }
    
    // Replace variables in subject and content
    const previewSubject = replaceVariables(template.subject, data)
    const previewHtmlContent = replaceVariables(template.html_content, data)
    const previewTextContent = template.text_content 
      ? replaceVariables(template.text_content, data)
      : null
    
    return NextResponse.json({
      success: true,
      preview: {
        subject: previewSubject,
        html_content: previewHtmlContent,
        text_content: previewTextContent,
        template_name: template.template_name,
        template_key: template.template_key,
        template_type: template.template_type
      },
      sample_data: data
    })
  } catch (error) {
    console.error('Preview email template error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET - Get sample data structure for templates
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const template_type = searchParams.get('type')
    
    const baseSampleData: Record<string, any> = {
      customer_name: 'John Doe',
      customer_email: 'john.doe@example.com',
      customer_phone: '(555) 123-4567',
      confirmation_code: 'ABC123XY',
      reservation_date: '2024-01-15',
      reservation_time: '19:00',
      party_size: 4,
      restaurant_email: process.env.RESTAURANT_EMAIL || 'team@toohot.kitchen',
      restaurant_phone: process.env.RESTAURANT_PHONE || '(617) 555-0123'
    }
    
    let sampleData: Record<string, any> = { ...baseSampleData }
    
    switch (template_type) {
      case 'confirmation':
        sampleData = {
          ...sampleData,
          special_requests: 'Vegetarian options preferred',
          duration_minutes: 90,
          notes: 'VIP customer'
        }
        break
      case 'cancellation':
        sampleData = {
          ...sampleData,
          cancellation_reason: 'Schedule conflict'
        }
        break
      case 'reminder':
        sampleData = {
          ...sampleData,
          reminder_date: '2024-01-14',
          hours_until_reservation: 24
        }
        break
    }
    
    return NextResponse.json({
      success: true,
      sample_data: sampleData,
      available_variables: Object.keys(sampleData),
      template_type
    })
  } catch (error) {
    console.error('GET sample data error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 