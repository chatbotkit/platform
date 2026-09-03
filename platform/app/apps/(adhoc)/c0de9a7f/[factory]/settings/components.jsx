'use client'

import { useState } from 'react'

import { errorToErrorResponse } from '@/lib/error'
import toast from '@/lib/toast'

import { AppScene } from '@/layouts/App'

import DynamicIcon from '@/components/DynamicIcon'
import Expando from '@/components/Expando'
import LanguageModelSelect from '@/components/LanguageModelSelect'
import RevealTextarea from '@/components/RevealTextarea'
import RevealToken from '@/components/RevealToken'
import WebhookSetupSection from '@/components/WebhookSetupSection'

import {
  saveGithubApp,
  setBotModel,
  setDailyTokenBudget,
  testGithubApp,
} from '../../server'

import clsx from 'clsx'

function unwrap(result) {
  if (!result) {
    throw new Error('Unexpected action result')
  }

  if ('error' in result) {
    throw errorToErrorResponse(result.error)
  }

  return result
}

function StatusTag({ ok }) {
  return (
    <span className={clsx('tag', ok ? 'tag-success' : 'tag-muted')}>
      {ok ? 'connected' : 'not connected'}
    </span>
  )
}

/** One access-level pill, e.g. "Read & write" or "Read-only". */
function Access({ level, tone = 'muted' }) {
  return (
    <span
      className={clsx(
        'tag whitespace-nowrap',
        tone === 'write' ? 'tag-success' : 'tag-muted'
      )}
    >
      {level}
    </span>
  )
}

/** One permission row: name + access pill + what the agent uses it for. */
function Permission({ name, level, tone, children }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
      <div className="flex items-center gap-2 sm:w-44 sm:shrink-0">
        <span className="text-sm font-medium">{name}</span>
        <Access level={level} tone={tone} />
      </div>
      <p className="text-sm auto-text-gray-500">{children}</p>
    </div>
  )
}

/**
 * The expandable permissions guide - which GitHub App permissions the factory
 * agent needs, tailored to its two GitHub tools (REST call + repo git token).
 */
function PermissionsGuide() {
  return (
    <Expando
      title="Which permissions does the App need?"
      titleClassName="text-sm font-medium auto-text-gray-700"
    >
      <p className="text-sm auto-text-gray-500">
        The agent works through two tools - a call to any authenticated GitHub
        REST endpoint, and a short-lived git token for its shell - both bounded
        by what you grant here. Grant what your tasks actually need; you can
        widen or narrow these later and re-accept on the installation. The
        factory is driven by tasks, not @mentions, so it needs no webhook
        events.
      </p>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide auto-text-gray-400">
          Repository permissions · required
        </span>
        <Permission name="Metadata" level="Read-only">
          Mandatory and selected by default - read basic repository information.
        </Permission>
        <Permission name="Contents" level="Read & write" tone="write">
          Clone repositories, create branches, and commit and push code and
          docs. Use Read-only if the agent should never write.
        </Permission>
        <Permission name="Pull requests" level="Read & write" tone="write">
          Open, update, review, comment on, and merge pull requests.
        </Permission>
        <Permission name="Issues" level="Read & write" tone="write">
          Triage work: comment, label, assign, and open or close issues.
        </Permission>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide auto-text-gray-400">
          Repository permissions · optional
        </span>
        <Permission name="Workflows" level="Read & write" tone="write">
          Only to add or edit GitHub Actions files under{' '}
          <code>.github/workflows</code> - GitHub blocks pushing workflow files
          without it.
        </Permission>
        <Permission name="Commit statuses" level="Read & write" tone="write">
          Publish commit statuses (e.g. results of a check the agent ran).
        </Permission>
        <Permission name="Administration" level="Read & write" tone="write">
          Only if the factory will create or configure repositories. Powerful -
          grant it only when a task needs it.
        </Permission>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide auto-text-gray-400">
          Organisation permissions · optional
        </span>
        <Permission name="Members" level="Read-only">
          Resolve teams and usernames so the agent can assign issues and pull
          requests to the right people.
        </Permission>
      </div>
    </Expando>
  )
}

function Scene({ className, ...props }) {
  return (
    <AppScene
      {...props}
      className={clsx('scene', className)}
      name={null}
      headline="Settings"
      description="Connect this factory's GitHub organisation as a GitHub App. The agent operates across every repository the App is installed on."
    />
  )
}

export function SettingsMain({ factory, status }) {
  const [configured, setConfigured] = useState(status.configured)
  const [appId, setAppId] = useState(status.appId || '')
  const [privateKey, setPrivateKey] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [installations, setInstallations] = useState(null)

  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [savingModel, setSavingModel] = useState(false)
  const [savingBudget, setSavingBudget] = useState(false)

  const saveModel = async (event) => {
    event.preventDefault()

    const model = new FormData(event.currentTarget).get('model')

    setSavingModel(true)

    const toastId = toast.loading('Saving model...', {})

    try {
      unwrap(await setBotModel({ factory, model }))

      toast.success('Model saved', { id: toastId })
    } catch (e) {
      toast.error(e.message, { id: toastId })
    } finally {
      setSavingModel(false)
    }
  }

  const saveBudget = async (event) => {
    event.preventDefault()

    const dailyTokenBudget = Math.round(
      Number(new FormData(event.currentTarget).get('dailyTokenBudget'))
    )

    if (!Number.isFinite(dailyTokenBudget) || dailyTokenBudget <= 0) {
      toast.error('Enter a positive daily token budget')

      return
    }

    setSavingBudget(true)

    const toastId = toast.loading('Saving budget...', {})

    try {
      unwrap(await setDailyTokenBudget({ factory, dailyTokenBudget }))

      toast.success('Budget saved', { id: toastId })
    } catch (e) {
      toast.error(e.message, { id: toastId })
    } finally {
      setSavingBudget(false)
    }
  }

  const save = async () => {
    if (!appId.trim()) {
      toast.error('Enter the GitHub App ID')

      return
    }

    setSaving(true)

    const toastId = toast.loading('Saving...', {})

    try {
      const next = unwrap(
        await saveGithubApp({
          factory,
          appId: appId.trim() || undefined,
          privateKey: privateKey.trim() || undefined,
          webhookSecret: webhookSecret.trim() || undefined,
        })
      )

      setConfigured(next.configured)
      setPrivateKey('')
      setWebhookSecret('')

      toast.success('Saved', { id: toastId })
    } catch (e) {
      toast.error(e.message, { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  const test = async () => {
    setTesting(true)
    setInstallations(null)

    const toastId = toast.loading('Testing GitHub App...', {})

    try {
      const { installations } = unwrap(await testGithubApp({ factory }))

      setInstallations(installations)

      toast.success(
        `Authenticated · ${installations} installation${
          installations === 1 ? '' : 's'
        }`,
        { id: toastId }
      )
    } catch (e) {
      toast.error(e.message, { id: toastId })
    } finally {
      setTesting(false)
    }
  }

  return (
    <>
      <Scene compact={true} />

      <div className="flex max-w-2xl flex-col gap-6">
        <section className="flex flex-col gap-4 rounded-xl border auto-border-gray-100 p-4">
          <div className="flex items-center gap-2">
            <DynamicIcon icon="@logo/github.com" className="h-5 w-5" />
            <span className="font-medium">GitHub App</span>
            <StatusTag ok={configured} />
          </div>

          <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm auto-text-gray-500">
            <li>
              Create a GitHub App on your organisation (Settings → Developer
              settings → GitHub Apps), with the repository permissions your
              tasks need.
            </li>
            <li>
              Install it on the organisation (all repositories, or a subset).
            </li>
            <li>
              Paste the App ID and a generated private key (PEM) below, then run
              Test.
            </li>
          </ol>

          <PermissionsGuide />

          <div>
            <label className="default-label" htmlFor="appId">
              App ID
            </label>
            <div className="mt-1">
              <input
                className="default-input w-full max-w-xs sm:text-sm"
                name="appId"
                type="text"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="123456"
              />
            </div>
            <p className="input-description">
              Your GitHub App id (App settings → <q>About</q>). Signs the App
              JWT used to mint installation tokens.
            </p>
          </div>

          <div>
            <label className="default-label" htmlFor="privateKey">
              Private Key
            </label>
            <div className="mt-1">
              <RevealTextarea
                className="default-input w-full max-h-96 !overflow-auto not-focus:max-h-24 [&:not(:focus)]:gradient-mask-b-10"
                name="privateKey"
                token={privateKey}
                setToken={setPrivateKey}
                placeholder={
                  '-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----'
                }
              />
            </div>
            <p className="input-description">
              The GitHub App private key (PEM), generated in the App settings.
              {configured ? ' Leave blank to keep the current key.' : ''}
            </p>
          </div>

          <div>
            <label className="default-label" htmlFor="webhookSecret">
              Webhook Secret
            </label>
            <div className="mt-1">
              <RevealToken
                className="default-input w-full sm:text-sm"
                name="webhookSecret"
                token={webhookSecret}
                setToken={setWebhookSecret}
                placeholder="optional"
              />
            </div>
            <p className="input-description">
              Optional - validates inbound webhook deliveries.
              {configured ? ' Leave blank to keep the current secret.' : ''}
            </p>
          </div>

          {status.webhookUrl && (
            <div className="border-t auto-border-gray-100 pt-4">
              <WebhookSetupSection
                endpoints={[
                  {
                    label: 'Webhook Payload URL',
                    url: status.webhookUrl,
                    description:
                      'Set this as the Webhook URL in your GitHub App (Content type: application/json), using the Webhook Secret above.',
                    required: true,
                    copyMessage: 'Webhook URL copied to clipboard',
                  },
                ]}
                instructions={[
                  'In your GitHub App settings, set the Webhook URL to the Payload URL above and the Webhook Secret to match the value entered here.',
                  'Grant the repository permissions your tasks need (e.g. Contents, Issues, Pull requests).',
                  'Install the App on your organisation and choose which repositories it can access.',
                ]}
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="primary-button"
              disabled={saving}
              onClick={save}
            >
              Save
            </button>
            <button
              type="button"
              className="default-button"
              disabled={testing}
              onClick={test}
            >
              Test connection
            </button>
            {installations !== null && (
              <span className="text-sm auto-text-gray-500">
                {installations} installation{installations === 1 ? '' : 's'}{' '}
                reachable
              </span>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-xl border auto-border-gray-100 p-4">
          <span className="font-medium">Agent model</span>

          <form className="flex flex-col gap-4" onSubmit={saveModel}>
            <div>
              <label className="default-label" htmlFor="model">
                Model
              </label>
              <div className="mt-1">
                <LanguageModelSelect
                  className="default-input w-full max-w-xs sm:text-sm"
                  name="model"
                  defaultValue={status.model}
                />
              </div>
              <p className="input-description">
                The language model this factory&apos;s agent uses. Defaults to
                GLM-5.2.
              </p>
            </div>
            <div>
              <button
                type="submit"
                className="primary-button"
                disabled={savingModel}
              >
                Save model
              </button>
            </div>
          </form>
        </section>

        <section className="flex flex-col gap-4 rounded-xl border auto-border-gray-100 p-4">
          <span className="font-medium">Spend limit</span>

          <form className="flex flex-col gap-4" onSubmit={saveBudget}>
            <div>
              <label className="default-label" htmlFor="dailyTokenBudget">
                Daily token budget
              </label>
              <div className="mt-1">
                <input
                  className="default-input w-full max-w-xs sm:text-sm"
                  name="dailyTokenBudget"
                  type="number"
                  min="1000"
                  step="1000"
                  defaultValue={status.dailyTokenBudget}
                />
              </div>
              <p className="input-description">
                The agent is blocked for a day once it uses this many tokens
                within 24 hours - a guard against a runaway task. Kept tight by
                default (100,000); raise it as you come to trust the factory.
              </p>
            </div>
            <div>
              <button
                type="submit"
                className="primary-button"
                disabled={savingBudget}
              >
                Save budget
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  )
}
