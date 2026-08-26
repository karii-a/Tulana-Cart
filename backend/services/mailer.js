const nodemailer = require('nodemailer')

let transporter = null

function getTransporter() {
  if (transporter) return transporter

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[mailer] SMTP env vars not set — emails will be logged, not sent.')
    return null
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
  return transporter
}

async function sendEmail({ to, subject, html }) {
  const t = getTransporter()
  if (!t) {
    console.log(`[mailer] (not sent, no SMTP configured) to=${to} subject="${subject}"`)
    return
  }
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || `"Tulana Kart" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    })
  } catch (err) {
    console.error('[mailer] send failed:', err.message)
  }
}

module.exports = { sendEmail }
