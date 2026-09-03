import type { ReactElement } from 'react'
import { render } from 'react-email'

import type { EmailTransport } from '@chatbotkit-dev/email'
import { sendEmailNotification } from '@chatbotkit-dev/email'

import limitsConfig, { hasPlans } from '@/config/limits'

import { isBillingConfigured } from '@/lib/billing.core'
import debug, { log } from '@/lib/debug'
import type { AllTypes } from '@/lib/limit.core'
import { logAudit } from '@/lib/log'
import { slidingWindow } from '@/lib/ratelimit'
import { isUserIdentityEmail } from '@/lib/user.identity'
import { isEffectiveWhitelabelAccount } from '@/lib/user.type'

import type { EmailBranding } from '@/layouts/Email'

import ContentAbuseDetected from '@/emails/ContentAbuseDetected'
import DatasetSyncCompleted from '@/emails/DatasetSyncCompleted'
import EmailLogin from '@/emails/EmailLogin'
import ExceededAccountLimits from '@/emails/ExceededAccountLimits'
import ExceededDatabaseLimits from '@/emails/ExceededDatabaseLimits'
import ExceededRateLimits from '@/emails/ExceededRateLimits'
import InvoicePaymentFailed from '@/emails/InvoicePaymentFailed'
import InvoicePaymentSucceeded from '@/emails/InvoicePaymentSucceeded'
import NearlyExceededAccountLimits from '@/emails/NearlyExceededAccountLimits'
import NearlyExceededDatabaseLimits from '@/emails/NearlyExceededDatabaseLimits'
import SubscriptionDeleted from '@/emails/SubscriptionDeleted'
import TeamInvitation from '@/emails/TeamInvitation'
import TrialStart from '@/emails/TrialStart'
import TrialStartDuplicateCardDetected from '@/emails/TrialStartDuplicateCardDetected'
import UsagePolicyTriggered from '@/emails/UsagePolicyTriggered'
import UserDeleted from '@/emails/UserDeleted'

export interface NotificationUser {
  id: string
  email: string
  name?: string | null
  parentId?: string | null
}

/**
 * Whitelabel partners run their own billing and branding, so our
 * ChatBotKit-branded "upgrade your plan" limit emails must never reach their
 * customers. Every limit/usage notification below is gated on this.
 */
async function isLimitNotificationSuppressed(
  user: NotificationUser
): Promise<boolean> {
  if (await isEffectiveWhitelabelAccount(user)) {
    debug(`skipping limit notification for whitelabel account`, { user }).log(
      'notify.whitelabel'
    )

    return true
  }

  return false
}

export type NotificationType = string

export type NotificationProps = Record<string, unknown>

export type Limit = AllTypes

/**
 * It is possible that this is not necessary but we are implementing it here
 * just in case to limit the expose of race conditions related to the ratelimit
 * checking protocol below.
 */
const notificationRateLimitState: Record<string, boolean> = {}

export async function shouldSendNotification(
  user: NotificationUser,
  type: string
): Promise<boolean> {
  const limit = `notification-${type}-${user.id}`

  // @note As per the comment related to notificationRateLimitState, it is quite
  // possible that ratelimit has a race-condition due to its async nature, thus
  // concurrent calls in the same VM will not correctly outline the rate. This
  // is why we implement an additional check here just be sure. This of course
  // does not solve the issue where concurrent calls from different VMs, for
  // example different requests, send multiple emails. This can only be solved
  // with a dedicated queue with content deduplication.

  // @todo maybe add content deduplication queue

  if (!(limit in notificationRateLimitState)) {
    const { success } = await slidingWindow(limit, 1, '1 d')

    notificationRateLimitState[limit] = success
  }

  const success = notificationRateLimitState[limit]

  debug(`notification limit found`, { limit, success })

  return success
}

interface NotifySettings {
  /** @see NotificationEmail.essential */
  essential?: boolean

  skipRateCheck?: boolean

  /**
   * Delivers this message as an identity the platform hosts for someone else - a
   * whitelabel partner, a portal on its own domain - instead of sending it from
   * the platform's own address. The caller supplies it; where it came from and
   * what it delivers through is not the platform's business.
   */
  transport?: EmailTransport
}

export async function notify(
  user: NotificationUser,
  type: NotificationType,
  element: ReactElement,
  subject: string,
  settings?: NotifySettings
): Promise<void> {
  debug(`notifying ${type}`, { user, settings }).log('notify.notify')

  if (isUserIdentityEmail(user.email)) {
    debug(`skipping notification for database-only User identity`, {
      userId: user.id,
    }).log('notify.userIdentity')

    return
  }

  const { skipRateCheck = false } = settings || {}

  if (!skipRateCheck) {
    debug(`checking rate limit`).log('notify.notify')

    if (!(await shouldSendNotification(user, type))) {
      debug(`skip notification`).log('notify.notify')

      return
    }
  }

  debug(`sending email`).log('notify.notify')

  const text = await render(element, { plainText: true })
  const html = await render(element)

  if (settings?.transport) {
    await settings.transport.send({
      to: user.email,
      subject,
      text,
      html,
    })
  } else {
    // @note the sending identity belongs to the email provider. This only
    // chooses where replies go.

    // @note no reply address: where replies to this deployment's notifications
    // go is the email provider's business, not the platform's.

    await sendEmailNotification({
      to: user.email,
      subject,
      content: { text, html },
      essential: settings?.essential,
    })
  }
}

// @note whether this deployment sells upgrades at all: the limit emails offer
// a paid remedy only where a billing surface exists to follow through on it.
// Deployment-level on purpose - per-user nuances (whitelabel partners) are
// already handled by the suppression check above.
function sellsUpgrades(): boolean {
  return hasPlans && isBillingConfigured()
}

export async function notifyExceededRateLimits(
  user: NotificationUser,
  limits: Limit[]
): Promise<void> {
  if (await isLimitNotificationSuppressed(user)) {
    return
  }

  await notify(
    user,
    'exceeded-rate-limits',
    <ExceededRateLimits limits={limits} upgradeAvailable={sellsUpgrades()} />,
    ExceededRateLimits.subject
  )
}

/**
 * @todo use different email template
 */
export async function notifyExceededDatabaseLimits(
  user: NotificationUser,
  limits: Limit[]
): Promise<void> {
  if (await isLimitNotificationSuppressed(user)) {
    return
  }

  await notify(
    user,
    'exceeded-database-limits',
    <ExceededDatabaseLimits
      limits={limits}
      upgradeAvailable={sellsUpgrades()}
    />,
    ExceededDatabaseLimits.subject
  )
}

/**
 * @todo use different email template
 */
export async function notifyNearlyExceededDatabaseLimits(
  user: NotificationUser,
  limits: Limit[]
): Promise<void> {
  if (await isLimitNotificationSuppressed(user)) {
    return
  }

  await notify(
    user,
    'nearly-exceeded-database-limits',
    <NearlyExceededDatabaseLimits
      limits={limits}
      upgradeAvailable={sellsUpgrades()}
    />,
    NearlyExceededDatabaseLimits.subject
  )
}

export async function notifyExceededAccountLimits(
  user: NotificationUser,
  limits: Limit[]
): Promise<void> {
  if (await isLimitNotificationSuppressed(user)) {
    return
  }

  await notify(
    user,
    'exceeded-account-limits',
    <ExceededAccountLimits
      limits={limits}
      upgradeAvailable={sellsUpgrades()}
    />,
    ExceededAccountLimits.subject
  )
}

export async function notifyNearlyExceededAccountLimits(
  user: NotificationUser,
  limits: Limit[]
): Promise<void> {
  if (await isLimitNotificationSuppressed(user)) {
    return
  }

  await notify(
    user,
    'nearly-exceeded-account-limits',
    <NearlyExceededAccountLimits
      limits={limits}
      upgradeAvailable={sellsUpgrades()}
    />,
    NearlyExceededAccountLimits.subject
  )
}

export async function notifyTrialStart(user: NotificationUser): Promise<void> {
  await notify(
    user,
    'trial-start',
    <TrialStart numberOfTokens={limitsConfig.trial.tokens} />,
    TrialStart.subject
  )
}

export async function notifyTrialStartDuplicateCardDetected(
  user: NotificationUser
): Promise<void> {
  await notify(
    user,
    'trial-start-duplicate-card-detected',
    <TrialStartDuplicateCardDetected />,
    TrialStartDuplicateCardDetected.subject
  )
}

export async function notifyInvoicePaymentFailed(
  user: NotificationUser
): Promise<void> {
  await notify(
    user,
    'invoice-payment-failed',
    <InvoicePaymentFailed />,
    InvoicePaymentFailed.subject
  )
}

export async function notifyInvoicePaymentSucceeded(
  user: NotificationUser
): Promise<void> {
  await notify(
    user,
    'invoice-payment-succeeded',
    <InvoicePaymentSucceeded />,
    InvoicePaymentSucceeded.subject
  )
}

export async function notifyContentAbuseDetected(
  user: NotificationUser,
  conversationId: string,
  categories: string[]
): Promise<void> {
  await notify(
    user,
    'content-abuse-detected',
    <ContentAbuseDetected
      conversationId={conversationId}
      categories={categories}
    />,
    ContentAbuseDetected.subject,
    {
      skipRateCheck: true,
    }
  )
}

export async function notifyUsagePolicyTriggered(
  recipients: NotificationUser[],
  props: {
    botId: string
    metric: string
    threshold: number
    blocked: boolean
    blockMinutes: number | undefined
  }
): Promise<void> {
  // @note rate check is skipped here because the usage-policy evaluator does its
  // own per-policy-window deduplication before calling this.
  for (const recipient of recipients) {
    await notify(
      recipient,
      'usage-policy-triggered',
      <UsagePolicyTriggered {...props} />,
      UsagePolicyTriggered.subject,
      { skipRateCheck: true }
    )
  }
}

export async function notifySubscriptionDeleted(
  user: NotificationUser
): Promise<void> {
  await notify(
    user,
    'subscription-deleted',
    <SubscriptionDeleted />,
    SubscriptionDeleted.subject
  )
}

export async function notifyUserDeleted(user: NotificationUser): Promise<void> {
  await notify(user, 'user-deleted', <UserDeleted />, UserDeleted.subject, {
    skipRateCheck: true,
  })
}

export async function notifyDatasetSyncCompleted(
  user: NotificationUser,
  datasetId: string,
  urls?: string[]
): Promise<void> {
  await notify(
    user,
    'dataset-sync-completed',
    <DatasetSyncCompleted datasetId={datasetId} urls={urls} />,
    DatasetSyncCompleted.subject,
    { skipRateCheck: true }
  )
}

export async function notifyTeamInvitation({
  user,

  teamName,
  teamDescription,

  branding,
  transport,
}: {
  user: NotificationUser

  teamName: string
  teamDescription?: string

  branding?: EmailBranding
  transport?: EmailTransport
}): Promise<void> {
  await logAudit({
    user,
    action: 'EMAIL',
    oldValues: undefined,
    newValues: { email: user.email, teamName },
    relations: {
      // @todo associated with the team
    },
    meta: {
      email: user.email,
      teamName,
    },
  })

  const type = branding ? `team-invitation:${branding.id}` : 'team-invitation'

  await notify(
    user,
    type,
    <TeamInvitation
      teamName={teamName}
      teamDescription={teamDescription}
      branding={branding}
    />,
    TeamInvitation.getSubject({ branding }),
    {
      skipRateCheck: true,
      essential: true,
      transport,
    }
  )
}

export async function notifyEmailLogin(
  user: NotificationUser,
  {
    token,

    branding,
    transport,
  }: {
    token: string

    branding?: EmailBranding
    transport?: EmailTransport
  }
): Promise<void> {
  log(`emailing login details`, { userId: user.id, email: user.email })

  await logAudit({
    user,
    action: 'EMAIL',
    oldValues: undefined,
    newValues: undefined,
    relations: {
      // @todo associated with the session
    },
    meta: {
      email: user.email,
    },
  })

  const type = branding ? `email-login:${branding.id}` : 'email-login'

  await notify(
    user,
    type,
    <EmailLogin token={token} branding={branding} />,
    EmailLogin.getSubject({ branding }),
    {
      skipRateCheck: true,
      essential: true,
      transport,
    }
  )
}
