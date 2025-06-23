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

interface NewPostEmailProps {
  authorName: string
  postContent: string
  postId: number | string
  postPreviewImage?: string
}

export default function NewPostEmail({
  authorName,
  postContent,
  postId,
  postPreviewImage
}: NewPostEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Новый пост от {authorName} в Zling</Preview>
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
              <Heading style={h1}>Новый пост от {authorName}</Heading>
              <Text style={mainText}>
                {authorName} только что опубликовал(а) новый пост в Zling:
              </Text>
              {postPreviewImage && (
                <Section style={{ textAlign: 'center', marginBottom: 16 }}>
                  <Img
                    src={postPreviewImage}
                    alt="Превью поста"
                    width="320"
                    style={{ borderRadius: 8 }}
                  />
                </Section>
              )}
              <Section style={postContentSection}>
                <Text style={postContentText}>
                  {postContent.length > 200
                    ? postContent.slice(0, 200) + '...'
                    : postContent}
                </Text>
              </Section>
              <Section style={actionSection}>
                <Link
                  href={`${FRONTEND_URL}/${authorName}/post/${postId}`}
                  style={button}
                >
                  Читать пост
                </Link>
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

const postContentSection = {
  backgroundColor: '#f8f9fa',
  borderRadius: '8px',
  padding: '16px',
  margin: '24px 0'
}

const postContentText = {
  color: '#333333',
  fontSize: '15px',
  lineHeight: '22px',
  margin: 0
}

const actionSection = {
  padding: '16px 0 0',
  textAlign: 'center' as const
}

const button = {
  display: 'inline-block',
  backgroundColor: '#0070f3',
  color: '#fff',
  padding: '12px 24px',
  borderRadius: '6px',
  textDecoration: 'none',
  fontWeight: 'bold',
  fontSize: '16px',
  marginTop: '12px'
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
