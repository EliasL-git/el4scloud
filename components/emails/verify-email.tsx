import {
  Html,
  Body,
  Container,
  Text,
  Heading,
  Section,
  Hr,
} from '@react-email/components'
import { main, container, heading, paragraph, hr, footer, codeBox, codeText, expiryText } from '@/lib/email-styles'

interface Props {
  username: string
  code: string
}

export function VerifyEmailEmail({ username, code }: Props) {
  return (
    <Html>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Verify your email</Heading>
          <Text style={paragraph}>Hi {username},</Text>
          <Text style={paragraph}>
            Thanks for creating an account! Use the code below to verify your email address.
          </Text>
          <Section style={codeBox}>
            <Text style={codeText}>{code}</Text>
            <Text style={expiryText}>This code expires in 1 hour</Text>
          </Section>
          <Text style={paragraph}>
            Enter this code on the verification page to activate your account.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>
            If you didn't create an account, you can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
