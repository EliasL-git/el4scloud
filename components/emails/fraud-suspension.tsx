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
  score: number
}

export function FraudSuspensionEmail({ name, score }: Props) {
  return (
    <Html>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Account temporarily suspended</Heading>
          <Text style={paragraph}>Hi {name},</Text>
          <Text style={paragraph}>
            Your account has been temporarily suspended by our fraud detection system (score: {score}).
            This means you may not use our platform while the suspension is active.
          </Text>
          <Text style={paragraph}>
            If you believe this was a mistake, you may contact support to appeal this decision.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>Hobbycloud</Text>
        </Container>
      </Body>
    </Html>
  )
}
