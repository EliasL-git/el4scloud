import {
  Html,
  Body,
  Container,
  Text,
  Heading,
  Hr,
} from '@react-email/components'
import { main, container, heading, paragraph, hr, footer } from '@/lib/email-styles'

interface Props {
  username: string
  resetUrl: string
}

export function ResetPasswordEmail({ username, resetUrl }: Props) {
  return (
    <Html>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Reset your password</Heading>
          <Text style={paragraph}>Hi {username},</Text>
          <Text style={paragraph}>
            We received a request to reset your password. Click the link below to choose a new one.
          </Text>
          <Text style={{ ...paragraph, textAlign: 'center' as const, marginTop: 24, marginBottom: 24 }}>
            <a
              href={resetUrl}
              style={{
                backgroundColor: '#000',
                color: '#fff',
                padding: '12px 24px',
                borderRadius: '6px',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: '500',
                display: 'inline-block',
              }}
            >
              Reset password
            </a>
          </Text>
          <Text style={paragraph}>
            Or copy and paste this link into your browser:
          </Text>
          <Text style={{ fontSize: '12px', color: '#666', wordBreak: 'break-all', margin: '4px 0 12px' }}>
            {resetUrl}
          </Text>
          <Text style={paragraph}>
            If you didn't request this, you can safely ignore this email.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>Hobbycloud team</Text>
        </Container>
      </Body>
    </Html>
  )
}
