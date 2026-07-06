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
  subject: string
  body: string
}

export function BroadcastEmail({ name, subject, body }: Props) {
  return (
    <Html>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>{subject}</Heading>
          <Text style={paragraph}>Hi {name},</Text>
          {body.split('\n').map((line, i) => (
            <Text key={i} style={paragraph}>{line}</Text>
          ))}
          <Hr style={hr} />
          <Text style={footer}>Hobbycloud</Text>
        </Container>
      </Body>
    </Html>
  )
}
