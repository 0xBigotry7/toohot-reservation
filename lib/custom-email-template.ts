export function generateCustomEmailHtml(subject: string, content: string, customerName: string): string {
  // Split content by newlines and convert to paragraphs
  const paragraphs = content.split('\n').filter(p => p.trim()).map(p => `<p>${p}</p>`).join('\n');
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #8B4513; padding: 30px 40px; text-align: center;">
              <h1 style="margin: 0; font-size: 32px; color: #ffffff; font-weight: 600;">
                🔥 Too Hot
              </h1>
              <p style="margin: 10px 0 0 0; font-size: 14px; color: #f5ddc7; letter-spacing: 1px;">
                RESTAURANT & BAR
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; font-size: 24px; color: #333333; font-weight: 600;">
                ${subject}
              </h2>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333; line-height: 1.6;">
                Dear ${customerName},
              </p>
              
              <div style="font-size: 16px; color: #333333; line-height: 1.6;">
                ${paragraphs}
              </div>
              
              <div style="margin-top: 30px; padding-top: 30px; border-top: 1px solid #e0e0e0;">
                <p style="margin: 0 0 10px 0; font-size: 16px; color: #333333; line-height: 1.6;">
                  Best regards,<br>
                  <strong style="color: #8B4513;">Too Hot Team</strong>
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #fafafa; padding: 30px 40px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666;">
                <strong>Too Hot Restaurant</strong>
              </p>
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666;">
                📧 team@toohot.kitchen | 📞 (617) 945-1206
              </p>
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666;">
                📍 18 Eliot St LG1, Cambridge, MA 02138
              </p>
              <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                <p style="margin: 0; font-size: 12px; color: #999999;">
                  © ${new Date().getFullYear()} Too Hot Restaurant. All rights reserved.
                </p>
                <p style="margin: 5px 0 0 0; font-size: 12px; color: #999999;">
                  This email was sent from a notification-only address that cannot accept incoming email.
                </p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function generateCustomEmailText(subject: string, content: string, customerName: string): string {
  return `
${subject}

Dear ${customerName},

${content}

Best regards,
Too Hot Team

--
Too Hot Restaurant
📧 team@toohot.kitchen | 📞 (617) 945-1206
📍 18 Eliot St LG1, Cambridge, MA 02138

© ${new Date().getFullYear()} Too Hot Restaurant. All rights reserved.
This email was sent from a notification-only address that cannot accept incoming email.
  `.trim();
}