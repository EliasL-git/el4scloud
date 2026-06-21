import {
  Html,
  Body,
  Container,
  Text,
  Heading,
  Section,
  Hr,
} from '@react-email/components'

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
            Your request for <strong>{requestedAmount}</strong> of additional storage has been approved!
          </Text>
          <Section style={box}>
            <Text style={boxText}>
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

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
  padding: '40px 0',
}

const container = {
  backgroundColor: '#ffffff',
  border: '1px solid #e6e6e6',
  borderRadius: '8px',
  margin: '0 auto',
  padding: '32px',
  maxWidth: '480px',
}

const heading = {
  fontSize: '20px',
  fontWeight: '600',
  color: '#1a1a1a',
  margin: '0 0 20px',
}

const paragraph = {
  fontSize: '14px',
  lineHeight: '22px',
  color: '#4a4a4a',
  margin: '0 0 12px',
}

const box = {
  backgroundColor: '#f0fdf4',
  border: '1px solid #bbf7d0',
  borderRadius: '6px',
  padding: '12px 16px',
  marginBottom: '16px',
}

const boxText = {
  fontSize: '14px',
  color: '#166534',
  margin: 0,
}

const hr = {
  border: 'none',
  borderTop: '1px solid #e6e6e6',
  margin: '24px 0 16px',
}

const footer = {
  fontSize: '12px',
  color: '#999',
  margin: 0,
}
