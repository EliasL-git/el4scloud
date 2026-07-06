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
  domain: string
}

export function BannedDomainTerminationEmail({ name, domain }: Props) {
  return (
    <Html>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Account terminated</Heading>
          <Text style={paragraph}>Hi {name},</Text>
          <Text style={paragraph}>
            Your account has been terminated because you used a blocked email domain
            ({domain}) to sign up. This domain is on our blocklist of temporary or
            disposable email providers, which are not allowed on our platform.
          </Text>
          <Text style={paragraph}>
            This decision wasn't made lightly, but after careful consideration we have chosen to
            permanently terminate your account. Please don't use temporary email services to sign up.
          </Text>
          <Text style={paragraph}>
            If you believe this was a mistake, you may appeal this decision by contacting support.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>Hobbycloud</Text>
        </Container>
      </Body>
    </Html>
  )
}
