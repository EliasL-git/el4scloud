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
  deletionRequestedAt: string
  approvedAt: string
  startedAt: string
  finishedAt: string
  totalDeleted: string
  timeFromStart: string
  timeFromRequest: string
}

export function DeletionCompletedEmail({
  name,
  deletionRequestedAt,
  approvedAt,
  startedAt,
  finishedAt,
  totalDeleted,
  timeFromStart,
  timeFromRequest,
}: Props) {
  const tdLabel = { fontSize: '12px', color: '#6b7280', padding: '4px 8px 4px 0', whiteSpace: 'nowrap' as const, verticalAlign: 'top' as const }
  const tdValue = { fontSize: '13px', color: '#166534', padding: '4px 0' }

  return (
    <Html>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Account deletion completed</Heading>
          <Text style={paragraph}>Hi {name},</Text>
          <Text style={paragraph}>
            Your account data has been fully deleted from our systems.
          </Text>
          <Section style={{
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '6px',
            padding: '12px 16px',
            marginBottom: '16px',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
              <tr>
                <td style={tdLabel}>Deletion requested at:</td>
                <td style={tdValue}>{deletionRequestedAt}</td>
              </tr>
              <tr>
                <td style={tdLabel}>Approved at:</td>
                <td style={tdValue}>{approvedAt}</td>
              </tr>
              <tr>
                <td style={tdLabel}>Started at:</td>
                <td style={tdValue}>{startedAt}</td>
              </tr>
              <tr>
                <td style={tdLabel}>Finished at:</td>
                <td style={tdValue}>{finishedAt}</td>
              </tr>
              <tr>
                <td style={tdLabel}>Total deleted data:</td>
                <td style={tdValue}>{totalDeleted}</td>
              </tr>
              <tr>
                <td style={tdLabel}>Time to delete:</td>
                <td style={tdValue}>{timeFromStart}</td>
              </tr>
              <tr>
                <td style={tdLabel}>Total time from request:</td>
                <td style={tdValue}>{timeFromRequest}</td>
              </tr>
            </table>
          </Section>
          <Text style={paragraph}>
            If you have any questions, please contact our support team.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>el4scloud team</Text>
        </Container>
      </Body>
    </Html>
  )
}
