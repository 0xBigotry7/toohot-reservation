import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { reservation } = await request.json();
    
    if (!reservation) {
      return NextResponse.json({ error: 'Missing reservation data' }, { status: 400 });
    }

    // Validate required fields
    if (!reservation.customer_email || !reservation.customer_name) {
      return NextResponse.json({ error: 'Missing customer email or name' }, { status: 400 });
    }

    const restaurantEmail = process.env.RESTAURANT_EMAIL || 'team@toohot.kitchen';
    const restaurantPhone = process.env.RESTAURANT_PHONE || '(617) 945-1761';
    
    // Format the cancellation reason
    const cancellationReason = reservation.cancellation_reason 
      ? `\n\nReason for cancellation: ${reservation.cancellation_reason}`
      : '';

    // Create the email content
    const emailSubject = `Reservation Cancellation - TooHot Restaurant`;
    
    const emailHtml = `
      <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #f5f1eb 0%, #ffffff 100%); padding: 40px 20px;">
        <div style="background: rgba(255, 255, 255, 0.9); border-radius: 20px; padding: 40px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); border: 1px solid rgba(139, 69, 19, 0.1);">
          
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #8B4513; font-size: 28px; margin: 0; font-weight: 300; letter-spacing: 1px;">
              🔥 TooHot Restaurant
            </h1>
            <p style="color: #666; margin: 10px 0 0 0; font-style: italic;">Reservation Cancellation Notice</p>
          </div>

          <!-- Main Content -->
          <div style="background: rgba(245, 241, 235, 0.5); border-radius: 15px; padding: 30px; margin: 20px 0;">
            <h2 style="color: #8B4513; margin-top: 0; font-size: 22px;">Dear ${reservation.customer_name},</h2>
            
            <p style="color: #333; line-height: 1.6; margin: 20px 0;">
              We're writing to inform you that your reservation at TooHot Restaurant has been <strong>cancelled</strong>.
            </p>

            <!-- Reservation Details -->
            <div style="background: white; border-radius: 10px; padding: 20px; margin: 25px 0; border-left: 4px solid #8B4513;">
              <h3 style="color: #8B4513; margin-top: 0; font-size: 18px;">Cancelled Reservation Details:</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666; width: 140px;"><strong>Date:</strong></td>
                  <td style="padding: 8px 0; color: #333;">${new Date(reservation.reservation_date).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;"><strong>Time:</strong></td>
                  <td style="padding: 8px 0; color: #333;">${reservation.reservation_time}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;"><strong>Party Size:</strong></td>
                  <td style="padding: 8px 0; color: #333;">${reservation.party_size} ${reservation.party_size === 1 ? 'guest' : 'guests'}</td>
                </tr>
                ${reservation.confirmation_code ? `
                <tr>
                  <td style="padding: 8px 0; color: #666;"><strong>Confirmation:</strong></td>
                  <td style="padding: 8px 0; color: #333; font-family: monospace;">${reservation.confirmation_code}</td>
                </tr>
                ` : ''}
              </table>
            </div>

            ${cancellationReason ? `
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 10px; padding: 15px; margin: 20px 0;">
              <strong style="color: #856404;">Cancellation Reason:</strong>
              <p style="color: #856404; margin: 10px 0 0 0;">${reservation.cancellation_reason}</p>
            </div>
            ` : ''}

            <p style="color: #333; line-height: 1.6; margin: 25px 0;">
              We sincerely apologize for any inconvenience this may cause. We understand that changes to your dining plans can be disappointing.
            </p>

            <p style="color: #333; line-height: 1.6; margin: 20px 0;">
              We would love to welcome you to TooHot Restaurant in the future. Please feel free to make a new reservation at your convenience.
            </p>
          </div>

          <!-- Contact Information -->
          <div style="background: rgba(139, 69, 19, 0.05); border-radius: 15px; padding: 25px; margin: 25px 0;">
            <h3 style="color: #8B4513; margin-top: 0; font-size: 18px;">📞 Contact Us</h3>
            <p style="color: #333; margin: 10px 0; line-height: 1.6;">
              If you have any questions or would like to make a new reservation:
            </p>
            <ul style="color: #333; line-height: 1.8; padding-left: 20px;">
              <li><strong>Phone:</strong> ${restaurantPhone}</li>
              <li><strong>Email:</strong> ${restaurantEmail}</li>
              <li><strong>Website:</strong> <a href="https://toohot.kitchen" style="color: #8B4513;">toohot.kitchen</a></li>
            </ul>
          </div>

          <!-- Footer -->
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(139, 69, 19, 0.2);">
            <p style="color: #666; font-size: 14px; margin: 0;">
              Thank you for your understanding.<br>
              <strong style="color: #8B4513;">— The TooHot Restaurant Team</strong>
            </p>
          </div>

        </div>
      </div>
    `;

    const emailText = `
TooHot Restaurant - Reservation Cancellation

Dear ${reservation.customer_name},

We're writing to inform you that your reservation at TooHot Restaurant has been cancelled.

Cancelled Reservation Details:
- Date: ${new Date(reservation.reservation_date).toLocaleDateString()}
- Time: ${reservation.reservation_time}
- Party Size: ${reservation.party_size} ${reservation.party_size === 1 ? 'guest' : 'guests'}
${reservation.confirmation_code ? `- Confirmation Code: ${reservation.confirmation_code}` : ''}
${cancellationReason}

We sincerely apologize for any inconvenience this may cause. We understand that changes to your dining plans can be disappointing.

We would love to welcome you to TooHot Restaurant in the future. Please feel free to make a new reservation at your convenience.

Contact Us:
- Phone: ${restaurantPhone}
- Email: ${restaurantEmail}
- Website: https://toohot.kitchen

Thank you for your understanding.
— The TooHot Restaurant Team
    `;

    // Send the email
    const { data, error } = await resend.emails.send({
      from: `TooHot Restaurant <${restaurantEmail}>`,
      to: [reservation.customer_email],
      subject: emailSubject,
      html: emailHtml,
      text: emailText,
    });

    if (error) {
      console.error('🔥 EMAIL SERVICE: Failed to send cancellation email:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('🔥 EMAIL SERVICE: Cancellation email sent successfully to:', reservation.customer_email);
    return NextResponse.json({ success: true, emailId: data?.id });

  } catch (error) {
    console.error('🔥 EMAIL SERVICE: Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 