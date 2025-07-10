import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface EmailTemplate {
  id: string
  template_key: string
  template_name: string
  template_type: 'confirmation' | 'cancellation' | 'reminder' | 'custom'
  subject: string
  html_content: string
  text_content: string | null
  variables: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface EmailData {
  // Customer information
  customer_name: string
  customer_email: string
  customer_phone?: string
  
  // Reservation information
  confirmation_code: string
  reservation_date: string
  reservation_time: string
  party_size: number
  special_requests?: string
  duration_minutes?: number
  notes?: string
  
  // Status information
  status?: string
  cancellation_reason?: string
  
  // Restaurant information
  restaurant_email?: string
  restaurant_phone?: string
  
  // Additional context
  reservation_type?: 'omakase' | 'dining'
  [key: string]: any // Allow for additional custom fields
}

/**
 * Fetches an email template by key
 */
export async function getEmailTemplate(templateKey: string): Promise<EmailTemplate | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('email_templates')
      .select('*')
      .eq('template_key', templateKey)
      .eq('is_active', true)
      .single()

    if (error) {
      console.error('Error fetching email template:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Error fetching email template:', error)
    return null
  }
}

/**
 * Fetches email templates by type
 */
export async function getEmailTemplatesByType(templateType: string): Promise<EmailTemplate[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('email_templates')
      .select('*')
      .eq('template_type', templateType)
      .eq('is_active', true)
      .order('template_name', { ascending: true })

    if (error) {
      console.error('Error fetching email templates by type:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error fetching email templates by type:', error)
    return []
  }
}

/**
 * Processes template variables with provided data
 */
export function processTemplate(templateContent: string, data: EmailData): string {
  let result = templateContent

  // Add default restaurant information if not provided
  const processedData = {
    restaurant_email: process.env.RESTAURANT_EMAIL || 'team@toohot.kitchen',
    restaurant_phone: process.env.RESTAURANT_PHONE || '(617) 555-0123',
    ...data
  }

  // Replace {{variable}} patterns
  result = result.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
    const key = variable.trim()
    const value = processedData[key]
    return value !== undefined ? String(value) : match
  })

  // Handle {{#if variable}} blocks
  result = result.replace(/\{\{#if\s+([^}]+)\}\}(.*?)\{\{\/if\}\}/g, (match, variable, content) => {
    const key = variable.trim()
    const value = processedData[key]
    return value && value !== '' ? content : ''
  })

  // Handle {{#unless variable}} blocks
  result = result.replace(/\{\{#unless\s+([^}]+)\}\}(.*?)\{\{\/unless\}\}/g, (match, variable, content) => {
    const key = variable.trim()
    const value = processedData[key]
    return !value || value === '' ? content : ''
  })

  return result
}

/**
 * Processes an email template with data and returns the processed content
 */
export async function processEmailTemplate(templateKey: string, data: EmailData): Promise<{
  subject: string
  html_content: string
  text_content: string | null
  template_name: string
  template_type: string
} | null> {
  const template = await getEmailTemplate(templateKey)
  
  if (!template) {
    console.error(`Email template not found: ${templateKey}`)
    return null
  }

  const processedSubject = processTemplate(template.subject, data)
  const processedHtmlContent = processTemplate(template.html_content, data)
  const processedTextContent = template.text_content 
    ? processTemplate(template.text_content, data)
    : null

  return {
    subject: processedSubject,
    html_content: processedHtmlContent,
    text_content: processedTextContent,
    template_name: template.template_name,
    template_type: template.template_type
  }
}

/**
 * Gets the appropriate template key for a reservation type and action
 */
export function getTemplateKey(reservationType: 'omakase' | 'dining', action: 'confirmation' | 'cancellation' | 'reminder'): string {
  switch (action) {
    case 'confirmation':
      return reservationType === 'omakase' ? 'omakase_confirmation' : 'dining_confirmation'
    case 'cancellation':
      return 'reservation_cancellation'
    case 'reminder':
      return 'reservation_reminder'
    default:
      return 'reservation_confirmation'
  }
}

/**
 * Convenience function to send a confirmation email
 */
export async function getConfirmationEmailContent(
  reservationType: 'omakase' | 'dining',
  data: EmailData
): Promise<{
  subject: string
  html_content: string
  text_content: string | null
  template_name: string
  template_type: string
} | null> {
  const templateKey = getTemplateKey(reservationType, 'confirmation')
  return await processEmailTemplate(templateKey, data)
}

/**
 * Convenience function to send a cancellation email
 */
export async function getCancellationEmailContent(
  data: EmailData
): Promise<{
  subject: string
  html_content: string
  text_content: string | null
  template_name: string
  template_type: string
} | null> {
  const templateKey = getTemplateKey('omakase', 'cancellation') // Same template for both types
  return await processEmailTemplate(templateKey, data)
}

/**
 * Convenience function to send a reminder email
 */
export async function getReminderEmailContent(
  data: EmailData
): Promise<{
  subject: string
  html_content: string
  text_content: string | null
  template_name: string
  template_type: string
} | null> {
  const templateKey = getTemplateKey('omakase', 'reminder') // Same template for both types
  return await processEmailTemplate(templateKey, data)
}

/**
 * Validates email template data
 */
export function validateEmailData(data: EmailData): string[] {
  const errors: string[] = []
  
  // Required fields
  if (!data.customer_name) errors.push('Customer name is required')
  if (!data.customer_email) errors.push('Customer email is required')
  if (!data.confirmation_code) errors.push('Confirmation code is required')
  if (!data.reservation_date) errors.push('Reservation date is required')
  if (!data.reservation_time) errors.push('Reservation time is required')
  if (!data.party_size) errors.push('Party size is required')
  
  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (data.customer_email && !emailRegex.test(data.customer_email)) {
    errors.push('Invalid email format')
  }
  
  return errors
}

/**
 * Fallback email templates for when database templates are not available
 */
export const fallbackTemplates = {
  omakase_confirmation: {
    subject: 'Your Omakase Reservation at TooHot Kitchen - Confirmed!',
    html_content: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #d97706; text-align: center;">🔥 TooHot Kitchen</h1>
        <h2>Reservation Confirmed!</h2>
        <p>Dear {{customer_name}},</p>
        <p>Your Omakase reservation has been confirmed:</p>
        <ul>
          <li><strong>Confirmation Code:</strong> {{confirmation_code}}</li>
          <li><strong>Date:</strong> {{reservation_date}}</li>
          <li><strong>Time:</strong> {{reservation_time}}</li>
          <li><strong>Party Size:</strong> {{party_size}} guests</li>
          {{#if special_requests}}<li><strong>Special Requests:</strong> {{special_requests}}</li>{{/if}}
        </ul>
        <p>Thank you for choosing TooHot Kitchen!</p>
        <p>{{restaurant_email}} | {{restaurant_phone}}</p>
      </div>
    `,
    text_content: `
TooHot Kitchen - Reservation Confirmed!

Dear {{customer_name}},

Your Omakase reservation has been confirmed:

Confirmation Code: {{confirmation_code}}
Date: {{reservation_date}}
Time: {{reservation_time}}
Party Size: {{party_size}} guests
{{#if special_requests}}Special Requests: {{special_requests}}{{/if}}

Thank you for choosing TooHot Kitchen!

{{restaurant_email}} | {{restaurant_phone}}
    `
  },
  dining_confirmation: {
    subject: 'Your Dining Reservation at TooHot Kitchen - Confirmed!',
    html_content: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #d97706; text-align: center;">🔥 TooHot Kitchen</h1>
        <h2>Reservation Confirmed!</h2>
        <p>Dear {{customer_name}},</p>
        <p>Your dining reservation has been confirmed:</p>
        <ul>
          <li><strong>Confirmation Code:</strong> {{confirmation_code}}</li>
          <li><strong>Date:</strong> {{reservation_date}}</li>
          <li><strong>Time:</strong> {{reservation_time}}</li>
          <li><strong>Party Size:</strong> {{party_size}} guests</li>
          {{#if duration_minutes}}<li><strong>Duration:</strong> {{duration_minutes}} minutes</li>{{/if}}
          {{#if special_requests}}<li><strong>Special Requests:</strong> {{special_requests}}</li>{{/if}}
        </ul>
        <p>Thank you for choosing TooHot Kitchen!</p>
        <p>{{restaurant_email}} | {{restaurant_phone}}</p>
      </div>
    `,
    text_content: `
TooHot Kitchen - Reservation Confirmed!

Dear {{customer_name}},

Your dining reservation has been confirmed:

Confirmation Code: {{confirmation_code}}
Date: {{reservation_date}}
Time: {{reservation_time}}
Party Size: {{party_size}} guests
{{#if duration_minutes}}Duration: {{duration_minutes}} minutes{{/if}}
{{#if special_requests}}Special Requests: {{special_requests}}{{/if}}

Thank you for choosing TooHot Kitchen!

{{restaurant_email}} | {{restaurant_phone}}
    `
  },
  reservation_cancellation: {
    subject: 'Your Reservation at TooHot Kitchen - Cancelled',
    html_content: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #d97706; text-align: center;">🔥 TooHot Kitchen</h1>
        <h2>Reservation Cancelled</h2>
        <p>Dear {{customer_name}},</p>
        <p>Your reservation has been cancelled:</p>
        <ul>
          <li><strong>Confirmation Code:</strong> {{confirmation_code}}</li>
          <li><strong>Date:</strong> {{reservation_date}}</li>
          <li><strong>Time:</strong> {{reservation_time}}</li>
          <li><strong>Party Size:</strong> {{party_size}} guests</li>
          {{#if cancellation_reason}}<li><strong>Reason:</strong> {{cancellation_reason}}</li>{{/if}}
        </ul>
        <p>We hope to see you again soon!</p>
        <p>{{restaurant_email}} | {{restaurant_phone}}</p>
      </div>
    `,
    text_content: `
TooHot Kitchen - Reservation Cancelled

Dear {{customer_name}},

Your reservation has been cancelled:

Confirmation Code: {{confirmation_code}}
Date: {{reservation_date}}
Time: {{reservation_time}}
Party Size: {{party_size}} guests
{{#if cancellation_reason}}Reason: {{cancellation_reason}}{{/if}}

We hope to see you again soon!

{{restaurant_email}} | {{restaurant_phone}}
    `
  }
}

/**
 * Gets template content with fallback support
 */
export async function getTemplateContentWithFallback(
  templateKey: string,
  data: EmailData
): Promise<{
  subject: string
  html_content: string
  text_content: string | null
  template_name: string
  template_type: string
}> {
  // Try to get from database first
  const dbTemplate = await processEmailTemplate(templateKey, data)
  
  if (dbTemplate) {
    return dbTemplate
  }
  
  // Fall back to hardcoded templates
  const fallbackTemplate = fallbackTemplates[templateKey as keyof typeof fallbackTemplates]
  
  if (fallbackTemplate) {
    return {
      subject: processTemplate(fallbackTemplate.subject, data),
      html_content: processTemplate(fallbackTemplate.html_content, data),
      text_content: fallbackTemplate.text_content ? processTemplate(fallbackTemplate.text_content, data) : null,
      template_name: templateKey,
      template_type: 'fallback'
    }
  }
  
  // Ultimate fallback - basic confirmation
  return {
    subject: `Your Reservation at TooHot Kitchen`,
    html_content: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #d97706; text-align: center;">🔥 TooHot Kitchen</h1>
        <p>Dear ${data.customer_name},</p>
        <p>Your reservation details:</p>
        <ul>
          <li><strong>Confirmation Code:</strong> ${data.confirmation_code}</li>
          <li><strong>Date:</strong> ${data.reservation_date}</li>
          <li><strong>Time:</strong> ${data.reservation_time}</li>
          <li><strong>Party Size:</strong> ${data.party_size} guests</li>
        </ul>
        <p>Thank you for choosing TooHot Kitchen!</p>
      </div>
    `,
    text_content: `
Dear ${data.customer_name},

Your reservation details:

Confirmation Code: ${data.confirmation_code}
Date: ${data.reservation_date}
Time: ${data.reservation_time}
Party Size: ${data.party_size} guests

Thank you for choosing TooHot Kitchen!
    `,
    template_name: 'Basic Confirmation',
    template_type: 'fallback'
  }
} 