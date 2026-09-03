import * as React from 'react'

import { siteUrl } from '@/config/site'

import type { EmailBranding } from '@/layouts/Email'

import { BrandedEmail, Button, Text } from '../layouts/Email'

export interface TeamInvitationProps {
  teamName?: string
  teamDescription?: string
  branding?: EmailBranding
}

/**
 * Email component for team invitation notifications
 */
export default function TeamInvitation({
  teamName: _teamName,
  teamDescription: _teamDescription,

  branding,
}: TeamInvitationProps): React.JSX.Element {
  const teamName = React.useMemo(() => (_teamName || '').trim(), [_teamName])
  const teamDescription = React.useMemo(
    () => (_teamDescription || '').trim(),
    [_teamDescription]
  )

  const brand: string = branding?.name || 'ChatBotKit'
  const baseUrl: string = branding?.baseUrl || siteUrl

  return (
    <BrandedEmail
      branding={branding}
      preview={
        teamName
          ? `You've been added to the team "${teamName}"`
          : `You've been added to a team on ${brand}`
      }
    >
      <Text>Hello!</Text>
      <Text>
        {teamName ? (
          <>
            You&apos;ve been added to the team &quot;{teamName}&quot; on {brand}
            . This means you now have access to collaborate on projects and
            resources shared by this team.
          </>
        ) : (
          <>
            You&apos;ve been added to a team on {brand}. This means you now have
            access to collaborate on projects and resources shared by this team.
          </>
        )}
      </Text>
      {teamDescription ? (
        <Text>
          <strong>About this team:</strong> {teamDescription}
        </Text>
      ) : null}
      <Text>
        As a team member, you can now access shared resources including agents,
        datasets, skillsets other AI tools that the team has created or been
        granted access to.
      </Text>
      <Button href={`${baseUrl}/overview`}>View Dashboard</Button>
      <Text>
        If you have any questions about your team membership or need help
        getting started, please don&apos;t hesitate to reach out to our support
        team.
      </Text>
      <Text>Welcome, and thank you for choosing {brand}!</Text>
      <Text>
        Best regards,
        <br />
        The {brand} Team
      </Text>
    </BrandedEmail>
  )
}

TeamInvitation.getSubject = ({
  branding,
}: Pick<TeamInvitationProps, 'branding'>) => {
  const brand = branding?.name || 'ChatBotKit'

  return `Welcome to your team on ${brand}`
}

TeamInvitation.PreviewProps = {
  teamName: 'Example Team',
  teamDescription: 'A sample team for demonstrating AI collaboration',
}
