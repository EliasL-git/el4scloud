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
  approvedDate: string
  fileCount: number
  scheduledDate: string
  adminNote?: string
}

export function DeletionApprovedEmail({ name, approvedDate, fileCount, scheduledDate, adminNote }: Props) {
  return (
    <Html>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Account deletion approved</Heading>
          <Text style={paragraph}>Hi {name},</Text>
          <Text style={paragraph}>
            Your account deletion request was approved on <strong>{approvedDate}</strong>.
          </Text>
          <Section style={box}>
            <Text style={boxText}>
              This means <strong>{fileCount}</strong> file{fileCount !== 1 ? 's' : ''} are
              scheduled for removal on <strong>{scheduledDate}</strong>.
            </Text>
          </Section>
          {adminNote && (
            <Text style={paragraph}>
              Note from admin: {adminNote}
            </Text>
          )}
          <Text style={paragraph}>
            Until then, your account is marked as terminated and you will not be able to upload new files.
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
  backgroundColor: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: '6px',
  padding: '12px 16px',
  marginBottom: '16px',
}

const boxText = {
  fontSize: '14px',
  color: '#991b1b',
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
