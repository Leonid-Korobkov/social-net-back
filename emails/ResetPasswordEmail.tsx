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
  Row
} from '@react-email/components'

interface ResetPasswordEmailProps {
  resetCode?: string
}

export default function ResetPasswordEmail({
  resetCode
}: ResetPasswordEmailProps) {
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
                    src="https://res.cloudinary.com/djsmqdror/image/upload/v1750155231/zq35p5eoicsucuzfyw2w.png"
                    alt="Zling Logo"
                    width="100"
                  />
                </Column>
                <Column align="right" className="w-1/2">
                  <Img
                    src="https://res.cloudinary.com/djsmqdror/image/upload/v1750155232/pvqgftwlzvt6p24auk7u.png"
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
                Для установки нового пароля введите код подтверждения ниже.
              </Text>
              <Section style={verificationSection}>
                <Text style={verifyText}>Код сброса пароля</Text>
                <Text style={codeText}>{resetCode}</Text>
                <Text style={validityText}>
                  (Код действителен в течение 10 минут)
                </Text>
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

const verificationSection = {
  backgroundColor: '#f8f9fa',
  borderRadius: '8px',
  padding: '24px',
  textAlign: 'center' as const
}

const verifyText = {
  color: '#4a4a4a',
  fontSize: '14px',
  fontWeight: 'bold',
  margin: '0 0 8px'
}

const codeText = {
  color: '#0070f3',
  fontSize: '36px',
  fontWeight: 'bold',
  letterSpacing: '4px',
  margin: '16px 0'
}

const validityText = {
  color: '#666666',
  fontSize: '14px',
  margin: '0'
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
