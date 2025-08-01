import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

interface LogEmailParams {
  reservationId: string
  reservationType: 'omakase' | 'dining'
  customerEmail: string
  customerName: string
  customerPhone?: string
  subject: string
  content: string
  templateUsed: string
  status?: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced' | 'opened' | 'clicked'
  providerMessageId?: string
  providerResponse?: any
  errorMessage?: string
  metadata?: any
}

export async function logEmailCommunication(params: LogEmailParams) {
  try {
    const now = new Date().toISOString()
    
    const { error } = await supabaseAdmin
      .from('communication_logs')
      .insert({
        reservation_id: params.reservationId,
        reservation_type: params.reservationType,
        customer_email: params.customerEmail,
        customer_name: params.customerName,
        customer_phone: params.customerPhone,
        channel: 'email',
        direction: 'outbound',
        subject: params.subject,
        content: params.content,
        template_used: params.templateUsed,
        status: params.status || 'pending',
        sent_at: params.status === 'sent' || params.status === 'delivered' ? now : null,
        delivered_at: params.status === 'delivered' ? now : null,
        failed_at: params.status === 'failed' ? now : null,
        provider: 'resend',
        provider_message_id: params.providerMessageId,
        provider_response: params.providerResponse,
        error_message: params.errorMessage,
        metadata: params.metadata
      })

    if (error) {
      console.error('Error logging email communication:', error)
      // Don't throw - we don't want logging failures to break email sending
    }
  } catch (error) {
    console.error('Error in logEmailCommunication:', error)
    // Don't throw - we don't want logging failures to break email sending
  }
}

export async function updateEmailStatus(
  providerMessageId: string, 
  status: 'sent' | 'delivered' | 'failed' | 'bounced' | 'opened' | 'clicked',
  additionalData?: {
    deliveredAt?: string
    openedAt?: string
    clickedAt?: string
    failedAt?: string
    errorMessage?: string
  }
) {
  try {
    const updateData: any = { status }
    
    if (status === 'delivered' && additionalData?.deliveredAt) {
      updateData.delivered_at = additionalData.deliveredAt
    }
    if (status === 'opened' && additionalData?.openedAt) {
      updateData.opened_at = additionalData.openedAt
    }
    if (status === 'clicked' && additionalData?.clickedAt) {
      updateData.clicked_at = additionalData.clickedAt
    }
    if (status === 'failed' && additionalData?.failedAt) {
      updateData.failed_at = additionalData.failedAt
      if (additionalData.errorMessage) {
        updateData.error_message = additionalData.errorMessage
      }
    }

    const { error } = await supabaseAdmin
      .from('communication_logs')
      .update(updateData)
      .eq('provider_message_id', providerMessageId)

    if (error) {
      console.error('Error updating email status:', error)
    }
  } catch (error) {
    console.error('Error in updateEmailStatus:', error)
  }
}