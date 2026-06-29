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
  name: string
  requestedAmount: string
  adminNote?: string
}

export function StorageRejectedEmail({ name, requestedAmount, adminNote }: Props) {
  return (
    <Html>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Storage upgrade request</Heading>
          <Text style={paragraph}>Hi {name},</Text>
          <Text style={paragraph}>
            Your request for {requestedAmount} of additional storage was not approved at this time.
          </Text>
          {adminNote && (
            <Text style={paragraph}>
              Note from admin: {adminNote}
            </Text>
          )}
          <Text style={paragraph}>
            If you have questions, feel free to reach out.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>el4scloud team</Text>
        </Container>
      </Body>
    </Html>
  )
}
