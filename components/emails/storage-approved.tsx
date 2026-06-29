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
  requestedAmount: string
  approvedAmount: string
  adminNote?: string
}

export function StorageApprovedEmail({ name, requestedAmount, approvedAmount, adminNote }: Props) {
  return (
    <Html>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Storage upgrade approved</Heading>
          <Text style={paragraph}>Hi {name},</Text>
          <Text style={paragraph}>
            Your request for {requestedAmount} of additional storage has been approved!
          </Text>
          <Section style={{
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '6px',
            padding: '12px 16px',
            marginBottom: '16px',
          }}>
            <Text style={{ fontSize: '14px', color: '#166534', margin: 0 }}>
              <strong>Approved amount:</strong> {approvedAmount}
            </Text>
          </Section>
          {adminNote && (
            <Text style={paragraph}>
              Note from admin: {adminNote}
            </Text>
          )}
          <Text style={paragraph}>
            You can now upload more files to el4scloud.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>el4scloud team</Text>
        </Container>
      </Body>
    </Html>
  )
}
