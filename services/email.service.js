require('../register')
const nodemailer = require('nodemailer')
const { render } = require('@react-email/render')
const VerificationEmail = require('../emails/VerificationEmail').default
const ResetPasswordEmail = require('../emails/ResetPasswordEmail').default
const NewLoginEmail = require('../emails/NewLoginEmail').default
const NewPostEmail = require('../emails/NewPostEmail').default

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
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 5
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
          'X-Mailer': 'Zling Mailer'
        },
        dsn: {
          id: 'verification-email',
          return: 'headers',
          notify: ['failure', 'delay'],
          recipient: process.env.SMTP_FROM
        }
      }

      const info = await this.transporter.sendMail(mailOptions)
      console.log('Email sent:', info.response)
      return true
    } catch (error) {
      console.error('Error sending email:', error)
      if (error.response) {
        console.error('SMTP Response:', error.response)
      }
      if (error.responseCode) {
        console.error('SMTP Response Code:', error.responseCode)
      }
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
          'X-Mailer': 'Zling Mailer'
        },
        dsn: {
          id: 'password-reset-email',
          return: 'headers',
          notify: ['failure', 'delay'],
          recipient: process.env.SMTP_FROM
        }
      }

      const info = await this.transporter.sendMail(mailOptions)
      console.log('Email sent:', info.response)
      return true
    } catch (error) {
      console.error('Error sending email:', error)
      if (error.response) {
        console.error('SMTP Response:', error.response)
      }
      if (error.responseCode) {
        console.error('SMTP Response Code:', error.responseCode)
      }
      return false
    }
  }

  async sendPasswordResetCode (email, code) {
    try {
      const emailHtml = await render(ResetPasswordEmail({ resetCode: code }))

      const mailOptions = {
        from: {
          name: 'Zling',
          address: process.env.SMTP_FROM
        },
        to: email,
        subject: 'Сброс пароля в Zling',
        html: emailHtml,
        headers: {
          'X-Mailer': 'Zling Mailer'
        },
        dsn: {
          id: 'password-reset-email',
          return: 'headers',
          notify: ['failure', 'delay'],
          recipient: process.env.SMTP_FROM
        }
      }

      const info = await this.transporter.sendMail(mailOptions)
      console.log('Email sent:', info.response)
      return true
    } catch (error) {
      console.error('Error sending email:', error)
      if (error.response) {
        console.error('SMTP Response:', error.response)
      }
      if (error.responseCode) {
        console.error('SMTP Response Code:', error.responseCode)
      }
      return false
    }
  }

  async sendNewLoginEmail (ipAddress, device, location, loginTime, userEmail) {
    try {
      const emailHtml = await render(
        NewLoginEmail({
          ipAddress,
          device,
          location,
          loginTime,
          userEmail
        })
      )

      const mailOptions = {
        from: {
          name: 'Zling',
          address: process.env.SMTP_FROM
        },
        to: userEmail,
        subject: 'Zling - Новый вход в аккаунт',
        html: emailHtml,
        headers: {
          'X-Mailer': 'Zling Mailer'
        },
        dsn: {
          id: 'new-login-email',
          return: 'headers',
          notify: ['failure', 'delay'],
          recipient: process.env.SMTP_FROM
        }
      }

      const info = await this.transporter.sendMail(mailOptions)
      console.log('New login email sent:', info.response)
      return true
    } catch (error) {
      console.error('Error sending new login email:', error)
      if (error.response) {
        console.error('SMTP Response:', error.response)
      }
      if (error.responseCode) {
        console.error('SMTP Response Code:', error.responseCode)
      }
      return false
    }
  }

  async sendNewPostEmail(subscriberEmail, authorName, postContent, postId, postPreviewImage) {
    try {
      const emailHtml = await render(
        NewPostEmail({
          authorName,
          postContent,
          postId,
          postPreviewImage
        })
      )

      const mailOptions = {
        from: {
          name: 'Zling',
          address: process.env.SMTP_FROM
        },
        to: subscriberEmail,
        subject: `Новый пост от ${authorName} в Zling!`,
        html: emailHtml,
        headers: {
          'X-Mailer': 'Zling Mailer'
        },
        dsn: {
          id: 'new-post-email',
          return: 'headers',
          notify: ['failure', 'delay'],
          recipient: process.env.SMTP_FROM
        }
      }

      const info = await this.transporter.sendMail(mailOptions)
      console.log('New post email sent:', info.response)
      return true
    } catch (error) {
      console.error('Error sending new post email:', error)
      if (error.response) {
        console.error('SMTP Response:', error.response)
      }
      if (error.responseCode) {
        console.error('SMTP Response Code:', error.responseCode)
      }
      return false
    }
  }
}

module.exports = new EmailService()
