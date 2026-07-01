import {
  Html,
  Body,
  Container,
  Text,
  Heading,
  Section,
  Hr,
} from '@react-email/components'
import { main, container, heading, paragraph, hr, footer } from '@/lib/email-styles'

interface Props {
  name: string
  subject: string
  message: string
  ticketId: string
}

export function TicketReplyEmail({ name, subject, message }: Props) {
  return (
    <Html>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>New reply on &quot;{subject}&quot;</Heading>
          <Text style={paragraph}>Hi {name},</Text>
          <Text style={paragraph}>
            Support has replied to your ticket.
          </Text>
          <Section style={{
            backgroundColor: '#f8f9fa',
            border: '1px solid #e6e6e6',
            borderRadius: '6px',
            padding: '12px 16px',
            marginBottom: '16px',
          }}>
            <Text style={{ fontSize: '13px', color: '#1a1a1a', margin: 0, whiteSpace: 'pre-wrap' }}>
              {message}
            </Text>
          </Section>
          <Text style={paragraph}>
            Reply in the dashboard to continue the conversation.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>el4scloud team</Text>
        </Container>
      </Body>
    </Html>
  )
}
