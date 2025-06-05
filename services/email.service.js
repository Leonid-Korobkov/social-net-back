require('../register')
const nodemailer = require('nodemailer')
const { render } = require('@react-email/render')
const VerificationEmail = require('../emails/VerificationEmail').default
const ResetPasswordEmail = require('../emails/ResetPasswordEmail').default

class EmailService {
  constructor () {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    })
  }

  async sendVerificationEmail (email, code) {
    try {
      const emailHtml = await render(
        VerificationEmail({ verificationCode: code })
      )

      const mailOptions = {
        from: {
          name: 'Zling',
          address: process.env.SMTP_FROM
        },
        to: email,
        subject: 'Zling - Подтверждение аккаунта',
        html: emailHtml,
        headers: {
          'X-Priority': '1',
          'X-MSMail-Priority': 'High',
          Importance: 'high',
          'X-Mailer': 'Zling Mailer',
          'List-Unsubscribe': `<mailto:${process.env
            .SMTP_FROM}?subject=unsubscribe>`,
          Precedence: 'bulk'
        }
      }

      await this.transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('Error sending email:', error)
        } else {
          console.log('Email sent:', info.response)
        }
      })
      console.log('Письмо успешно отправлено', emailHtml)
      return true
    } catch (error) {
      console.error('Error sending email:', error)
      return false
    }
  }

  async sendPasswordResetEmail (email, resetToken) {
    try {
      const emailHtml = await render(ResetPasswordEmail({ resetToken }))

      const mailOptions = {
        from: {
          name: 'Zling',
          address: process.env.SMTP_FROM
        },
        to: email,
        subject: 'Сброс пароля в Zling',
        html: emailHtml,
        headers: {
          'X-Priority': '1',
          'X-MSMail-Priority': 'High',
          Importance: 'high',
          'X-Mailer': 'Zling Mailer',
          'List-Unsubscribe': `<mailto:${process.env
            .SMTP_FROM}?subject=unsubscribe>`,
          Precedence: 'bulk'
        }
      }

      await this.transporter.sendMail(mailOptions)
      return true
    } catch (error) {
      console.error('Error sending email:', error)
      return false
    }
  }
}

module.exports = new EmailService()
