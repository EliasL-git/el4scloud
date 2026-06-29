import {
  Html,
  Body,
  Container,
  Text,
  Heading,
  Section,
  Hr,
  Link,
} from '@react-email/components'

interface Props {
  username: string
  verificationUrl: string
}

export function VerifyEmailEmail({ username, verificationUrl }: Props) {
  return (
    <Html>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Verify your email</Heading>
          <Text style={paragraph}>Hi {username},</Text>
          <Text style={paragraph}>
            Thanks for creating an account! Click the button below to verify your email address and get started.
          </Text>
          <Section style={{ textAlign: 'center' as const, marginTop: 24, marginBottom: 24 }}>
            <Link
              href={verificationUrl}
              style={button}
            >
              Verify email
            </Link>
          </Section>
          <Text style={paragraph}>
            Or copy and paste this link into your browser:
          </Text>
          <Text style={linkText}>
            {verificationUrl}
          </Text>
          <Hr style={hr} />
          <Text style={footer}>
            If you didn't create an account, you can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: '#f5f5f5',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  padding: '40px 0',
}

const container = {
  backgroundColor: '#ffffff',
  border: '1px solid #e0e0e0',
  borderRadius: '8px',
  margin: '0 auto',
  maxWidth: '480px',
  padding: '32px',
}

const heading = {
  fontSize: '20px',
  fontWeight: '600',
  margin: '0 0 16px',
}

const paragraph = {
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '8px 0',
  color: '#333',
}

const button = {
  backgroundColor: '#000',
  color: '#fff',
  padding: '12px 24px',
  borderRadius: '6px',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: '500',
  display: 'inline-block',
}

const linkText = {
  fontSize: '12px',
  color: '#666',
  wordBreak: 'break-all' as const,
  margin: '4px 0 12px',
}

const hr = {
  border: 'none',
  borderTop: '1px solid #e0e0e0',
  margin: '24px 0 16px',
}

const footer = {
  fontSize: '12px',
  color: '#999',
  margin: '0',
}