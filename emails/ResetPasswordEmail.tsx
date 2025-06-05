import React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Img,
  Column,
  Row,
  Button
} from '@react-email/components'

interface ResetPasswordEmailProps {
  resetToken?: string
}

const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000'

export default function ResetPasswordEmail({
  resetToken
}: ResetPasswordEmailProps) {
  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`

  return (
    <Html>
      <Head />
      <Preview>Сброс пароля в Zling</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={coverSection}>
            <Section style={logoSection}>
              <Row cellSpacing={8}>
                <Column align="left" className="w-1/2">
                  <Img
                    src={`${baseUrl}/Zling-logo-white.png`}
                    alt="Zling Logo"
                    width="100"
                  />
                </Column>
                <Column align="right" className="w-1/2">
                  <Img
                    src={`${baseUrl}/Zling-logo.png`}
                    alt="Butterfly"
                    width="60"
                  />
                </Column>
              </Row>
            </Section>
            <Section style={upperSection}>
              <Heading style={h1}>Сброс пароля</Heading>
              <Text style={mainText}>
                Мы получили запрос на сброс пароля для вашего аккаунта Zling.
                Если это были вы, нажмите на кнопку ниже, чтобы установить новый
                пароль.
              </Text>
              <Section style={buttonSection}>
                <Button style={button} href={resetUrl}>
                  Сбросить пароль
                </Button>
              </Section>
              <Text style={mainText}>
                Если вы не запрашивали сброс пароля, проигнорируйте это письмо.
                Для безопасности вашего аккаунта, пожалуйста, не пересылайте это
                письмо другим лицам.
              </Text>
            </Section>
            <Hr style={hr} />
            <Section style={lowerSection}>
              <Text style={cautionText}>
                Zling никогда не будет запрашивать ваш пароль или другие
                конфиденциальные данные по email.
              </Text>
            </Section>
          </Section>
          <Text style={footerText}>
            © {new Date().getFullYear()} Zling. Все права защищены.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif'
}

const container = {
  margin: '0 auto',
  padding: '20px 0 48px',
  maxWidth: '580px'
}

const coverSection = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
}

const logoSection = {
  backgroundColor: '#000000',
  padding: '24px',
  textAlign: 'center' as const,
  borderTopLeftRadius: '12px',
  borderTopRightRadius: '12px',
  gap: '16px'
}

const upperSection = {
  padding: '32px 32px'
}

const h1 = {
  color: '#1a1a1a',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '0 0 16px'
}

const mainText = {
  color: '#4a4a4a',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 24px'
}

const buttonSection = {
  textAlign: 'center' as const,
  margin: '32px 0'
}

const button = {
  backgroundColor: '#7827C8',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: '500',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px'
}

const hr = {
  borderColor: '#e6ebf1',
  margin: '0'
}

const lowerSection = {
  padding: '24px 48px'
}

const cautionText = {
  color: '#666666',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0'
}

const footerText = {
  color: '#666666',
  fontSize: '12px',
  textAlign: 'center' as const,
  margin: '24px 0 0'
}
