import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { generateCustomEmailHtml, generateCustomEmailText } from '@/lib/custom-email-template'

const resend = new Resend(process.env.RESEND_API_KEY)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
}

const supabaseAdmin = createClient(supabaseUrl!, supabaseServiceKey!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

export async function POST(request: NextRequest) {
  console.log('Send custom email API called')
  console.log('Environment check:', {
    hasResendKey: !!process.env.RESEND_API_KEY,
    hasSupabaseUrl: !!supabaseUrl,
    hasSupabaseServiceKey: !!supabaseServiceKey
  })
  
  try {
    // Check if environment variables are set
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not set')
      return NextResponse.json(
        { error: 'Email service not configured' },
        { status: 500 }
      )
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase environment variables are not set')
      return NextResponse.json(
        { error: 'Database service not configured' },
        { status: 500 }
      )
    }

    console.log('Parsing request body...')
    const { to, subject, content, reservationId, reservationType, customerName } = await request.json()
    console.log('Request data:', { to, subject, hasContent: !!content, reservationId, reservationType, customerName })

    if (!to || !subject || !content) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Generate HTML content first
    const htmlContent = generateCustomEmailHtml(subject, content, customerName)
    
    // Create communication log entry with HTML content
    console.log('Creating communication log entry...')
    const logEntry = {
      reservation_id: reservationId,
      reservation_type: reservationType,
      customer_email: to,
      customer_name: customerName,
      channel: 'email',
      direction: 'outbound',
      subject,
      content: htmlContent,  // Store HTML content for display
      template_used: 'custom',
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    console.log('Log entry:', logEntry)
    const { data: logData, error: logError } = await supabaseAdmin
      .from('communication_logs')
      .insert(logEntry)
      .select()
      .single()
    console.log('Supabase insert result:', { logData, logError })

    if (logError) {
      console.error('Error creating communication log:', logError)
      return NextResponse.json(
        { error: 'Failed to create communication log' },
        { status: 500 }
      )
    }

    // Send email via Resend
    try {
      console.log('Generating text template and sending email...')
      const textContent = generateCustomEmailText(subject, content, customerName)
      console.log('Templates generated, sending email...')
      
      const { data, error } = await resend.emails.send({
        from: 'Too Hot Reservation <no-reply@toohot.kitchen>',
        to: [to],
        subject,
        html: htmlContent,
        text: textContent
      })
      console.log('Resend response:', { data, error })

      if (error) {
        // Update log with error
        await supabaseAdmin
          .from('communication_logs')
          .update({
            status: 'failed',
            error_message: error.message,
            failed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', logData.id)

        return NextResponse.json(
          { error: 'Failed to send email', details: error.message },
          { status: 500 }
        )
      }

      // Update log with success
      await supabaseAdmin
        .from('communication_logs')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          provider_message_id: data?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', logData.id)

      return NextResponse.json({ success: true, messageId: data?.id })
    } catch (emailError: any) {
      // Update log with error
      await supabaseAdmin
        .from('communication_logs')
        .update({
          status: 'failed',
          error_message: emailError.message,
          failed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', logData.id)

      return NextResponse.json(
        { error: 'Failed to send email', details: emailError.message },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('Error in send custom email API:', error)
    console.error('Error details:', error.message)
    console.error('Error stack:', error.stack)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}