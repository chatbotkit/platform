'use client'

import { useCallback, useEffect, useState } from 'react'

import toast from '@/lib/toast'

import List from '@/components/List'
import Safedown from '@/components/Safedown'
import Spinner from '@/components/Spinner'

import useDebounce from '@/hooks/useDebounce'
import useFetch from '@/hooks/useFetch'
import usePopup from '@/hooks/usePopup'

function formatInstalls(count) {
  if (!count || count <= 0) {
    return null
  }

  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M installs`
  }

  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}K installs`
  }

  return `${count} install${count === 1 ? '' : 's'}`
}

function stripFrontmatter(content) {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
}

function SkillDetailView({ skill }) {
  const { fetch } = useFetch({ loadingMessage: false, failureMessage: false })

  const [content, setContent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function loadContent() {
      try {
        const { data, error: fetchError } = await fetch(
          '/api/auxiliary/skillset/ability/clawhub/handler',
          {
            headers: { 'x-chatbotkit-handler-name': 'readSkill' },
            data: { slug: skill.id },
          }
        )

        if (cancelled) {
          return
        }

        if (fetchError) {
          setError('Failed to load skill content')
        } else {
          setContent(data?.content || '')
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load skill content')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadContent()

    return () => {
      cancelled = true
    }
  }, [skill.id, fetch])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner className="w-6 h-6" />
      </div>
    )
  }

  if (error) {
    return <div className="text-sm text-red-500">{error}</div>
  }

  if (!content) {
    return (
      <div className="text-sm auto-text-gray-400">No content available.</div>
    )
  }

  return (
    <Safedown className="prose dark:prose-invert prose-sm max-w-none prose-pre:overflow-auto">
      {stripFrontmatter(content)}
    </Safedown>
  )
}

/**
 * SkillBrowser displays a searchable list of available skills from the
 * ClawHub catalogue. Clicking a skill calls `onDetail` to open the detail
 * view. `onSelect` is used for direct install without preview.
 *
 * @param {{ onSelect: (skill: object) => void, onDetail: (skill: object) => void }} props
 */
export default function SkillBrowser({ onDetail }) {
  const { fetch } = useFetch({
    loadingMessage: false,
    failureMessage: false,
  })

  const [skills, setSkills] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('')

  const debouncedFilter = useDebounce(filter, 300)

  useEffect(() => {
    if (!debouncedFilter.trim()) {
      return
    }

    let cancelled = false

    async function loadSkills() {
      setLoading(true)
      setError(null)

      try {
        const q = debouncedFilter.trim()

        const { data, error: fetchError } = await fetch(
          '/api/auxiliary/skillset/ability/clawhub/handler',
          {
            headers: { 'x-chatbotkit-handler-name': 'listSkills' },
            data: { q },
            loadingMessage: false,
            failureMessage: false,
          }
        )

        if (cancelled) {
          return
        }

        if (fetchError) {
          setError(
            typeof fetchError === 'string'
              ? fetchError
              : 'Failed to load skills'
          )
          setSkills([])

          return
        }

        setSkills(data?.items || [])
      } catch {
        if (!cancelled) {
          setError('Failed to load skills')
          setSkills([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadSkills()

    return () => {
      cancelled = true
    }
  }, [fetch, debouncedFilter])

  if (!debouncedFilter.trim()) {
    return (
      <div className="flex flex-col gap-3">
        <input
          type="text"
          className="default-input"
          placeholder="Search skills..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          autoFocus
        />
        <div className="flex items-center justify-center py-8 text-sm auto-text-gray-400">
          Type to search the catalogue
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <input
          type="text"
          className="default-input"
          placeholder="Search skills..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          autoFocus
        />
        <div className="flex items-center justify-center py-10">
          <Spinner className="w-6 h-6" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        type="text"
        className="default-input"
        placeholder="Search skills..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        autoFocus
      />
      {error ? (
        <div className="flex items-center justify-center py-8 text-red-500 text-sm">
          {error}
        </div>
      ) : null}
      <List emptyMessage="No skills found.">
        {skills.map((skill) => (
          <List.Item
            key={skill.id}
            title={skill.name}
            body={
              skill.description
                ? `${skill.description}${skill.installs ? ` · ${formatInstalls(skill.installs)}` : ''}`
                : formatInstalls(skill.installs)
            }
            onClick={() => onDetail?.(skill)}
          />
        ))}
      </List>
    </div>
  )
}

/**
 * Hook that exposes a SkillBrowser popup with built-in install support.
 *
 * Pass `spaceId` to enable the Install skill button. Pass `onInstalled` to
 * be notified after a successful install (e.g. to refresh a skill list).
 *
 * Returns `popup` (the portal JSX to render) and `openSkillBrowser()` which
 * opens the browse popup.
 *
 * @param {{ spaceId?: string|null, onInstalled?: () => void }} [options]
 */
export function useSkillBrowser({ spaceId, onInstalled } = {}) {
  const { popup, openPopup, closePopup } = usePopup()
  const { fetch } = useFetch({ loadingMessage: false, failureMessage: false })

  const openSkillBrowser = useCallback(() => {
    async function handleInstall(skill) {
      if (!spaceId || spaceId.startsWith('#')) {
        toast.error('Connect to a saved space first')

        return
      }

      const toastId = toast.loading(`Installing ${skill.name}...`)

      try {
        const { error: installError } = await fetch(
          '/api/auxiliary/skillset/ability/clawhub/handler',
          {
            data: { spaceId, slug: skill.id },
            headers: { 'x-chatbotkit-handler-name': 'installToSpace' },
          }
        )

        if (installError) {
          throw new Error(installError.message || 'Failed to install skill')
        }

        toast.success(`Installed ${skill.name}!`, { id: toastId })

        closePopup()
        onInstalled?.()
      } catch (e) {
        toast.error(e.message, { id: toastId })
      }
    }

    function showList() {
      openPopup(
        () => <SkillBrowser onDetail={(skill) => showDetail(skill)} />,
        {
          title: 'Browse Skills',
          noActions: true,
          dialogClassName: 'sm:max-w-xl max-h-[80svh]',
          dialogInnerClassName: 'overflow-y-auto',
          animateContentHeight: false,
        }
      )
    }

    function showDetail(skill) {
      openPopup(() => <SkillDetailView skill={skill} />, {
        title: skill.name,
        cancelButtonCaption: 'Back',
        actions: {
          'Install skill': () => handleInstall(skill),
        },
        dialogClassName: 'sm:max-w-xl max-h-[80svh]',
        dialogInnerClassName: 'overflow-y-auto',
        animateContentHeight: false,
        onClose: showList,
      })
    }

    showList()
  }, [openPopup, closePopup, fetch, spaceId, onInstalled])

  return { popup, openSkillBrowser }
}
