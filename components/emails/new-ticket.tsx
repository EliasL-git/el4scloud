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
  userName: string
  userEmail: string
  subject: string
  message: string
  ticketId: string
}

export function NewTicketEmail({ userName, userEmail, subject, message }: Props) {
  return (
    <Html>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>New support ticket</Heading>
          <Text style={paragraph}>A new support ticket has been opened.</Text>
          <Section style={{
            backgroundColor: '#f8f9fa',
            border: '1px solid #e6e6e6',
            borderRadius: '6px',
            padding: '12px 16px',
            marginBottom: '16px',
          }}>
            <Text style={{ fontSize: '13px', color: '#4a4a4a', margin: '0 0 4px' }}>
              <strong>From:</strong> {userName} ({userEmail})
            </Text>
            <Text style={{ fontSize: '13px', color: '#4a4a4a', margin: '0 0 4px' }}>
              <strong>Subject:</strong> {subject}
            </Text>
            <Text style={{ fontSize: '13px', color: '#4a4a4a', margin: 0 }}>
              <strong>Message:</strong>
            </Text>
            <Text style={{ fontSize: '13px', color: '#1a1a1a', margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>
              {message}
            </Text>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>Hobbycloud team</Text>
        </Container>
      </Body>
    </Html>
  )
}
