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
import { FRONTEND_URL } from '../contstants'

interface NewLoginEmailProps {
  ipAddress: string
  device: string
  location: string
  loginTime: string
  userEmail: string
}
export default function NewLoginEmail({
  ipAddress,
  device,
  location,
  loginTime,
  userEmail
}: NewLoginEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Новый вход в аккаунт Zling</Preview>
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
              <Heading style={h1}>Новый вход в ваш аккаунт</Heading>
              <Text style={mainText}>
                Мы заметили новый вход в ваш аккаунт Zling ({userEmail}). Если
                это были вы, никаких действий не требуется.
              </Text>
              <Section style={detailsSection}>
                <Text style={detailText}>
                  IP-адрес: <span style={detailValue}>{ipAddress}</span>
                </Text>
                <Text style={detailText}>
                  Устройство: <span style={detailValue}>{device}</span>
                </Text>
                <Text style={detailText}>
                  Местоположение: <span style={detailValue}>{location}</span>
                </Text>
                <Text style={detailText}>
                  Время входа: <span style={detailValue}>{loginTime}</span>
                </Text>
              </Section>
              <Text style={mainText}>
                Если вы не узнаёте этот вход или считаете, что кто-то получил
                несанкционированный доступ к вашему аккаунту, пожалуйста,
                немедленно примите меры:
              </Text>
              <Section style={actionSection}>
                <Text style={actionText}>
                  1.{' '}
                  <Link href={`${FRONTEND_URL}`} style={link}>
                    Измените ваш пароль
                  </Link>
                </Text>
                <Text style={actionText}>
                  2.{' '}
                  <Link href={`${FRONTEND_URL}`} style={link}>
                    Просмотрите активные сессии
                  </Link>{' '}
                  и завершите любую подозрительную активность.
                </Text>
                <Text style={actionText}>
                  3. Свяжитесь с нашей службой поддержки, если у вас есть
                  вопросы.
                </Text>
              </Section>
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

const detailsSection = {
  backgroundColor: '#f8f9fa',
  borderRadius: '8px',
  padding: '16px',
  margin: '24px 0'
}

const detailText = {
  color: '#4a4a4a',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0 0 8px'
}

const detailValue = {
  fontWeight: 'bold'
}

const actionSection = {
  padding: '16px 0 0'
}

const actionText = {
  color: '#4a4a4a',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 12px'
}

const link = {
  color: '#0070f3',
  textDecoration: 'underline'
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
