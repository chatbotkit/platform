'use client'

import { useCallback, useEffect, useState } from 'react'

import { errorToErrorResponse } from '@/lib/error'
import toast from '@/lib/toast'

import { AppNavExtra } from '@/layouts/App'

import { useConfirmDelete } from '@/components/Confirm'
import List from '@/components/List'
import MarkdownInput from '@/components/MarkdownInput'

import usePopup from '@/hooks/usePopup'

import { deleteFile, listFiles, moveFile, readFile, writeFile } from '../../server'

function unwrap(result) {
  if (!result) {
    throw new Error('Unexpected action result')
  }

  if ('error' in result) {
    throw errorToErrorResponse(result.error)
  }

  return result
}

/** The leaf name of a path, for a denser file list. */
function basename(path) {
  const parts = path.split('/')

  return parts[parts.length - 1] || path
}

/**
 * The path form shared by the create and rename dialogs. `name="path"` so the
 * popup's form serialises it for the action's `fn(data)`; the Enter key submits
 * via `onSubmit` (which mirrors the default action).
 */
function PathFields({ label, hint, defaultValue, onSubmit }) {
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium auto-text-gray-700">{label}</span>
        <input
          className="default-input"
          type="text"
          name="path"
          defaultValue={defaultValue}
          placeholder="e.g. playbooks/security.md"
          required
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()

              onSubmit?.(e.currentTarget.value)
            }
          }}
        />
        {hint ? (
          <span className="text-xs auto-text-gray-400">{hint}</span>
        ) : null}
      </label>
    </div>
  )
}

export function PlaybooksMain({ factory }) {
  const [files, setFiles] = useState(null)
  const [activePath, setActivePath] = useState(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const { popup, openPopup, closePopup } = usePopup()

  const confirmDelete = useConfirmDelete()

  const reload = useCallback(async () => {
    try {
      const { items } = unwrap(await listFiles({ factory }))

      setFiles(items.filter((item) => !item.isDirectory))
    } catch (e) {
      toast.error(e.message)

      setFiles([])
    }
  }, [factory])

  useEffect(() => {
    reload()
  }, [reload])

  const open = async (path) => {
    setLoading(true)

    try {
      const { content } = unwrap(await readFile({ factory, path }))

      setActivePath(path)
      setContent(content)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const save = async () => {
    if (!activePath) {
      return
    }

    setSaving(true)

    const toastId = toast.loading('Saving...', {})

    try {
      unwrap(await writeFile({ factory, path: activePath, content }))

      toast.success('Saved', { id: toastId })

      reload()
    } catch (e) {
      toast.error(e.message, { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  const openCreate = () => {
    const doCreate = async (rawPath) => {
      const path = (rawPath || '').trim()

      if (!path) {
        toast.error('Enter a playbook path')

        return
      }

      closePopup()

      try {
        unwrap(await writeFile({ factory, path, content: '' }))

        await reload()
        await open(path)
      } catch (e) {
        toast.error(e.message)
      }
    }

    openPopup(
      () => (
        <PathFields
          label="Playbook path"
          hint="Use forward slashes for folders. Markdown (.md) is recommended."
          defaultValue="playbooks/notes.md"
          onSubmit={doCreate}
        />
      ),
      {
        title: 'New playbook',
        actions: {
          'Create playbook': { default: true, fn: (data) => doCreate(data.path) },
        },
      }
    )
  }

  const openRename = (currentPath) => {
    const doMove = async (rawPath) => {
      const destinationPath = (rawPath || '').trim()

      if (!destinationPath) {
        toast.error('Enter a destination path')

        return
      }

      if (destinationPath === currentPath) {
        closePopup()

        return
      }

      closePopup()

      const toastId = toast.loading('Moving...', {})

      try {
        unwrap(await moveFile({ factory, path: currentPath, destinationPath }))

        toast.success('Moved', { id: toastId })

        // keep the editor pointed at the file if it was the one moved
        if (activePath === currentPath) {
          setActivePath(destinationPath)
        }

        reload()
      } catch (e) {
        toast.error(e.message, { id: toastId })
      }
    }

    openPopup(
      () => (
        <PathFields
          label="Destination path"
          hint="Rename the file or move it into another folder."
          defaultValue={currentPath}
          onSubmit={doMove}
        />
      ),
      {
        title: 'Rename / move',
        actions: {
          Move: { default: true, fn: (data) => doMove(data.path) },
        },
      }
    )
  }

  const remove = async (path) => {
    const confirmed = await confirmDelete(
      `Delete "${path}"? This cannot be undone.`,
      { title: 'Delete file' }
    )

    if (!confirmed) {
      return
    }

    try {
      unwrap(await deleteFile({ factory, path }))

      if (activePath === path) {
        setActivePath(null)
        setContent('')
      }

      reload()
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <div className="flex h-screen w-full flex-row">
      {popup}

      {/* top-bar actions, next to the profile icon */}
      <AppNavExtra>
        <div className="flex items-center gap-2">
          <button type="button" className="default-button" onClick={openCreate}>
            New playbook
          </button>
          {activePath && (
            <button
              type="button"
              className="primary-button"
              disabled={saving || loading}
              onClick={save}
            >
              Save
            </button>
          )}
        </div>
      </AppNavExtra>

      {/* list */}
      <div className="subtle-scrollbar w-full max-w-[20rem] shrink-0 overflow-auto p-3">
        {files === null ? (
          <p className="px-1 py-2 text-sm auto-text-gray-500">Loading...</p>
        ) : (
          <List emptyMessage="No playbooks yet.">
            {(files || []).map((file) => (
              <List.Item
                key={file.path}
                title={basename(file.path)}
                body={file.path.includes('/') ? file.path : undefined}
                timestamp={file.updatedAt}
                selected={activePath === file.path}
                onClick={() => open(file.path)}
                actions={{
                  Rename: () => openRename(file.path),
                  Delete: () => remove(file.path),
                }}
              />
            ))}
          </List>
        )}
      </div>

      {/* editor */}
      <div className="w-full overflow-auto border-l auto-border-gray-100">
        {activePath ? (
          <div className="mx-auto max-w-3xl px-6 pt-5 pb-8 md:px-10 md:pb-12">
            <div className="mb-4 font-mono text-xs auto-text-gray-400">
              {activePath}
            </div>
            <MarkdownInput
              className="!max-h-none min-h-[70vh] text-sm"
              value={content}
              setValue={setContent}
              disabled={loading}
            />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 p-8 text-center">
            <p className="text-sm auto-text-gray-500">
              Select a playbook to edit, or create a new one.
            </p>
            <p className="text-xs auto-text-gray-400">
              These hold your scope and standards - the agent reads them before
              every task.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
