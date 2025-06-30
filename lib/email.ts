import { Resend } from 'resend'
import { format, parseISO } from 'date-fns'

// Initialize Resend only when needed to avoid build-time errors
let resend: Resend | null = null

function getResendClient() {
  if (!resend) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set')
    }
    resend = new Resend(apiKey)
  }
  return resend
}

export interface ReservationEmailData {
  customer_name: string
  customer_email: string
  customer_phone: string
  reservation_date: string
  reservation_time: string
  party_size: number
  special_requests?: string
  reservation_id?: string
  reservation_type?: string
}

// Customer confirmation email template
export const getCustomerConfirmationEmail = (data: ReservationEmailData) => {
  const formattedDate = format(parseISO(data.reservation_date + 'T00:00:00'), 'EEEE, MMMM do, yyyy')
  const isOmakase = data.reservation_type === 'omakase'
  const pricePerPerson = isOmakase ? 99 : 40
  const totalCost = data.party_size * pricePerPerson
  const reservationType = isOmakase ? 'Omakase' : 'Dining'

  return {
    from: 'TooHot Restaurant <team@toohot.kitchen>',
    to: data.customer_email,
    subject: `${reservationType} Reservation Confirmed - ${formattedDate} at ${data.reservation_time}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Georgia', serif; line-height: 1.6; color: #333; background: #f8f6f3; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #B86F3A, #EA580C); color: white; padding: 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
            .content { padding: 40px 30px; }
            .reservation-details { background: #f8f6f3; border-radius: 8px; padding: 25px; margin: 25px 0; border-left: 4px solid #B86F3A; }
            .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #e5e5e5; }
            .detail-label { font-weight: bold; color: #B86F3A; }
            .detail-value { color: #333; }
            .footer { background: #f8f6f3; padding: 25px 30px; text-align: center; color: #666; font-size: 14px; }
            .contact-info { margin-top: 20px; }
            .contact-info a { color: #B86F3A; text-decoration: none; }
            .highlight { color: #B86F3A; font-weight: bold; }
            .total-cost { font-size: 18px; font-weight: bold; color: #B86F3A; text-align: center; margin: 20px 0; padding: 15px; background: #f0f9ff; border-radius: 8px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔥 TooHot Restaurant</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">${reservationType} Reservation Confirmed</p>
            </div>
            
            <div class="content">
              <h2 style="color: #B86F3A; margin-top: 0;">Hey ${data.customer_name}, it's Lil Hot here! 🔥</h2>
              <p>Yay! Your ${reservationType.toLowerCase()} reservation is confirmed and we're fired up to welcome you to TooHot. Get ready for a flavor adventure like no other!</p>
              <div class="reservation-details">
                <h3 style="color: #B86F3A; margin-top: 0; margin-bottom: 20px;">Reservation Details</h3>
                <div class="detail-row">
                  <span class="detail-label">Date:</span>
                  <span class="detail-value">${formattedDate}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Time:</span>
                  <span class="detail-value">${data.reservation_time}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Party Size:</span>
                  <span class="detail-value">${data.party_size} ${data.party_size === 1 ? 'Guest' : 'Guests'}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Experience:</span>
                  <span class="detail-value">${isOmakase ? '11-Course Omakase Tasting Menu (2 hours)' : 'À la carte dining experience'}</span>
                </div>
                ${data.special_requests ? `
                <div class="detail-row">
                  <span class="detail-label">Special Requests:</span>
                  <span class="detail-value">${data.special_requests}</span>
                </div>
                ` : ''}
                ${isOmakase ? `
                <div class="total-cost">
                  Total Cost: $${totalCost} ($${pricePerPerson} per person)
                </div>
                ` : ''}
              </div>
              <h3 style="color: #B86F3A;">What to Expect</h3>
              <ul style="line-height: 1.8;">
                ${isOmakase ? `
                <li>11 unforgettable courses, each with a TooHot twist</li>
                <li>Signature Sichuan flavors, bold spices, and playful surprises</li>
                <li>Stories, laughter, and a table full of good vibes</li>
                ` : `
                <li>Fresh, authentic Sichuan cuisine with bold flavors</li>
                <li>Signature dishes that bring the heat and excitement</li>
                <li>Warm hospitality and a vibrant dining atmosphere</li>
                `}
                <li>Dietary needs? Just let us know in advance and we'll do our best to accommodate!</li>
              </ul>
              <h3 style="color: #B86F3A;">Before You Arrive</h3>
              <ul style="line-height: 1.8;">
                <li><strong>Arrival:</strong> Please arrive 10 minutes early to get settled in.</li>
                <li><strong>Questions?</strong> Just reply to this email or ask Lil Hot 🔥 on our website toohot.kitchen—I'm always here to help!</li>
                <li><strong>Cancellation:</strong> 48-hour notice required for cancellations. </li>
                <li><strong>Dress Code:</strong> Smart casual (but bring your appetite for adventure!)</li>
              </ul>
              <p style="margin-top: 30px;">We can't wait to spice up your night! If you have any questions, just hit reply or chat with me, Lil Hot, your TooHot AI assistant. See you soon!</p>
              <p style="margin-top: 20px;">
                Warmest regards,<br>
                <span class="highlight">The TooHot Team & Lil Hot 🔥</span>
              </p>
            </div>
            <div class="footer">
              <div class="contact-info">
                <strong>TooHot Restaurant</strong><br>
                18 Eliot St LG1, Cambridge, MA 02138<br>
                <a href="tel:${process.env.RESTAURANT_PHONE}">${process.env.RESTAURANT_PHONE}</a> | 
                <a href="mailto:${process.env.RESTAURANT_EMAIL}">${process.env.RESTAURANT_EMAIL}</a><br>
                <a href="${process.env.NEXT_PUBLIC_SITE_URL}">toohot.kitchen</a>
              </div>
            </div>
          </div>
        </body>
      </html>
    `
  }
}

// Restaurant notification email template
export const getRestaurantNotificationEmail = (data: ReservationEmailData) => {
  const formattedDate = format(parseISO(data.reservation_date + 'T00:00:00'), 'EEEE, MMMM do, yyyy')
  return {
    from: 'TooHot Reservations <team@toohot.kitchen>',
    to: process.env.RESTAURANT_EMAIL || 'team@toohot.kitchen',
    subject: `Action Required: Reservation Pending for Confirmation - ${data.customer_name} (${formattedDate})`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; background: #fffbe9; color: #222; margin: 0; padding: 0; }
            .container { max-width: 480px; margin: 40px auto; background: #fff; border-radius: 10px; box-shadow: 0 2px 12px rgba(0,0,0,0.07); overflow: hidden; }
            .header { background: #EA580C; color: #fff; padding: 24px 0; text-align: center; font-size: 22px; font-weight: bold; }
            .content { padding: 32px 24px; }
            .details { margin-bottom: 24px; }
            .row { margin-bottom: 10px; }
            .label { font-weight: bold; color: #EA580C; display: inline-block; width: 120px; }
            .value { color: #222; }
            .cta { display: block; margin: 32px auto 0 auto; background: #EA580C; color: #fff; text-decoration: none; padding: 16px 0; border-radius: 6px; font-size: 18px; font-weight: bold; text-align: center; width: 100%; max-width: 320px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">Action Required: Reservation Pending</div>
            <div class="content">
              <div class="details">
                <div class="row"><span class="label">Name:</span> <span class="value">${data.customer_name}</span></div>
                ${data.customer_email ? `<div class="row"><span class="label">Email:</span> <span class="value"><a href="mailto:${data.customer_email}">${data.customer_email}</a></span></div>` : ''}
                ${data.customer_phone ? `<div class="row"><span class="label">Phone:</span> <span class="value"><a href="tel:${data.customer_phone}">${data.customer_phone}</a></span></div>` : ''}
                <div class="row"><span class="label">Date:</span> <span class="value">${formattedDate}</span></div>
                <div class="row"><span class="label">Time:</span> <span class="value">${data.reservation_time}</span></div>
                <div class="row"><span class="label">Party Size:</span> <span class="value">${data.party_size}</span></div>
                ${data.special_requests ? `<div class="row"><span class="label">Special Requests:</span> <span class="value">${data.special_requests}</span></div>` : ''}
              </div>
              <a class="cta" href="https://admin.toohot.kitchen" target="_blank">Go to Admin Portal to Confirm</a>
              <p style="margin-top: 24px; color: #666; font-size: 14px; text-align: center;">This reservation is <b>pending</b> and requires your confirmation.</p>
            </div>
          </div>
        </body>
      </html>
    `
  }
}

// Send customer confirmation email
export async function sendCustomerConfirmation(data: ReservationEmailData) {
  try {
    // Can't send email if no email address provided
    if (!data.customer_email) {
      console.log('Skipping customer email - no email address provided for reservation')
      return { message: 'No email address provided' }
    }
    
    const emailData = getCustomerConfirmationEmail(data)
    const result = await getResendClient().emails.send(emailData)
    console.log('Customer confirmation email sent:', result)
    return result
  } catch (error) {
    console.error('Failed to send customer confirmation email:', error)
    throw error
  }
}

// Send restaurant notification email
export async function sendRestaurantNotification(data: ReservationEmailData) {
  try {
    // Get notification email addresses (supports multiple emails separated by commas)
    const notificationEmails = process.env.RESTAURANT_NOTIFICATION_EMAILS || process.env.RESTAURANT_EMAIL || 'team@toohot.kitchen'
    const emailAddresses = notificationEmails.split(',').map(email => email.trim())
    
    console.log('Sending restaurant notifications to:', emailAddresses)
    
    // Send to each notification email address with delay to avoid rate limits
    const results = []
    for (let i = 0; i < emailAddresses.length; i++) {
      const email = emailAddresses[i]
      const emailData = {
        ...getRestaurantNotificationEmail(data),
        to: email
      }
      
      if (i > 0) {
        // Add 1 second delay between emails to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      
      const result = await getResendClient().emails.send(emailData)
      results.push(result)
    }
    console.log('Restaurant notification emails sent:', results)
    return results
  } catch (error) {
    console.error('Failed to send restaurant notification emails:', error)
    throw error
  }
}

// Send both emails
export async function sendReservationEmails(data: ReservationEmailData) {
  try {
    const [customerResult, restaurantResult] = await Promise.all([
      sendCustomerConfirmation(data),
      sendRestaurantNotification(data)
    ])
    
    return {
      customer: customerResult,
      restaurant: restaurantResult
    }
  } catch (error) {
    console.error('Failed to send reservation emails:', error)
    throw error
  }
} 