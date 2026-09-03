import { useState } from 'react'

import { toTitleCase } from '@/lib/string'

import CodeAction from '@/components/CodeAction'
import { useConfirm } from '@/components/Confirm'
import Expando from '@/components/Expando'
import IconSelect from '@/components/IconSelect'
import Toggle from '@/components/Toggle'

import useExternalFrontendURL from '@/hooks/useExternalFrontendURL'
import useFetch from '@/hooks/useFetch'

import pluralize from 'pluralize'

export default function HubOptions({ type, instance }) {
  const buildFrontendURL = useExternalFrontendURL()

  const confirm = useConfirm()

  const key = `hub${toTitleCase(type)}Page`

  const { code, fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  const [id, setId] = useState(instance[key]?.id || '')

  const [slug, setSlug] = useState(instance[key]?.slug || '')

  const [icon, setIcon] = useState(instance[key]?.icon || '')

  const [shareLog, setShareLog] = useState(instance[key]?.shareLog || false)

  async function handlePublish(event) {
    event.preventDefault()
    event.stopPropagation()

    const data = {
      name: instance.name,
      description: instance.description,

      slug,
      icon,

      ...(type === 'blueprint' ? { shareLog } : {}),
    }

    const { error: fetchError, data: fetchData } = await fetch(
      `/api/v1/hub/${type}/${instance.id}/publish`,
      {
        data,

        successMessage: `${toTitleCase(type)} published.`,
      }
    )

    if (!fetchError) {
      instance[key] = instance[key] || {}

      Object.assign(instance[key], data)

      setId(fetchData.id)
    }
  }

  async function handleUnpublish(event) {
    event.preventDefault()
    event.stopPropagation()

    if (!(await confirm(`Do you really want to unpublish this ${type}?`))) {
      return
    }

    const { error: fetchError } = await fetch(
      `/api/v1/hub/${type}/${instance.id}/unpublish`,
      {
        data: {},

        successMessage: `${toTitleCase(type)} unpublished...`,
      }
    )

    if (!fetchError) {
      instance[key] = null

      setId('')

      setSlug('')

      setIcon('')

      setShareLog(false)
    }
  }

  return (
    <>
      <CodeAction key={code} code={code} />
      <Expando titleClassName="default-link text-sm" title="Hub Options">
        <div className="divided-area">
          <div className="mt-6 space-y-6">
            <div>
              <p className="input-description">
                You can publish this {type} to the hub. Once published, it will
                be available to all users to view and copy. This is a great way
                to share your work with others and promote your projects.
              </p>
              {id ? (
                <p className="input-description">
                  <span>The external URL is:</span>{' '}
                  <a
                    className="default-link"
                    href={buildFrontendURL(
                      `/hub/${pluralize(type, 2)}/${slug || id}`
                    )}
                    target="_blank"
                    rel="noopener"
                  >
                    {buildFrontendURL(`/hub/${pluralize(type, 2)}/${slug || id}`)}
                  </a>
                </p>
              ) : null}
            </div>
            {/* slug */}
            <div>
              <label className="default-label" htmlFor="slug">
                Slug
              </label>
              <div className="mt-1">
                <input
                  className="default-input w-full max-w-xs"
                  type="text"
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                />
              </div>
              <p className="input-description">
                Set {type} slug. This slug will be used in the URL.
              </p>
            </div>
            {/* icon */}
            <div>
              <label className="default-label" htmlFor="icon">
                Icon
              </label>
              <div className="mt-1">
                <IconSelect
                  value={icon}
                  onChange={(event) => setIcon(event.target.value)}
                />
              </div>
              <p className="input-description">
                Set {type} icon. This icon will be used in the hub.
              </p>
            </div>
            {/* shareLog (blueprint only) */}
            {type === 'blueprint' ? (
              <div>
                <label className="default-label" htmlFor="shareLog">
                  Share Execution Log
                </label>
                <div className="mt-1">
                  <Toggle checked={shareLog} setChecked={setShareLog} />
                </div>
                <p className="input-description">
                  Allow the agent execution log to be publicly visible. This
                  lets others see how the agent processes requests.{' '}
                  <strong>
                    Do not share the log unless you are comfortable with this
                    information being public.
                  </strong>
                </p>
              </div>
            ) : null}
          </div>
          {/* actions */}
          <div>
            <div className="action-area">
              <button
                className="primary-button small"
                type="button"
                onClick={handlePublish}
              >
                Publish
              </button>
              {id ? (
                <button
                  className="danger-button small"
                  type="button"
                  onClick={handleUnpublish}
                >
                  Unpublish
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </Expando>
    </>
  )
}
