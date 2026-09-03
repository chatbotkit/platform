'use client'

import { useCallback, useEffect, useState } from 'react'

import toast from '@/lib/toast'

import { useConfirmDelete } from '@/components/Confirm'
import List from '@/components/List'

import useFetch from '@/hooks/useFetch'
import { useApexHostURL, useSpaceApex } from '@/hooks/useHostname'
import usePopup from '@/hooks/usePopup'

/**
 * Describes a site's serving configuration in a single human-readable line.
 *
 * @param {object} site
 * @returns {string}
 */
function describeSite(site) {
  const parts = []

  parts.push(site.prefix ? `prefix: ${site.prefix}` : 'root')

  if (site.index) {
    parts.push(`index: ${site.index}`)
  }

  return parts.join(' · ')
}

/**
 * SiteFormContent renders the create/edit form fields for a space site. The
 * enclosing popup is itself a `<form>`, so the named fields are read back via
 * `formToData` in the popup action handler.
 *
 * @param {object} props
 * @param {object} [props.site] - The site being edited (omit/null when creating)
 */
function SiteFormContent({ site }) {
  const spaceApex = useSpaceApex()

  // @note `site` is `null` when creating; a default param only covers
  // `undefined`, so normalize here before reading fields.
  const values = site || {}

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium auto-text-gray-700">Slug</span>
        <input
          className="default-input"
          type="text"
          name="slug"
          defaultValue={values.slug || ''}
          placeholder="e.g. acme"
          required
          autoFocus
        />
        <span className="text-xs auto-text-gray-400">
          Type a label like <code>acme</code> and we&apos;ll use{' '}
          <code>acme.{spaceApex}</code>.
        </span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium auto-text-gray-700">Name</span>
        <input
          className="default-input"
          type="text"
          name="name"
          defaultValue={values.name || ''}
          placeholder="Optional label"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium auto-text-gray-700">
          Folder prefix
        </span>
        <input
          className="default-input"
          type="text"
          name="prefix"
          defaultValue={values.prefix || ''}
          placeholder="e.g. marketing (leave empty for the space root)"
        />
      </label>

      <div className="flex flex-row gap-3">
        <label className="flex flex-col gap-1 flex-1">
          <span className="text-sm font-medium auto-text-gray-700">
            Index file
          </span>
          <input
            className="default-input"
            type="text"
            name="index"
            defaultValue={values.index || ''}
            placeholder="index.html"
          />
        </label>

        <label className="flex flex-col gap-1 flex-1">
          <span className="text-sm font-medium auto-text-gray-700">
            Not-found file
          </span>
          <input
            className="default-input"
            type="text"
            name="notFound"
            defaultValue={values.notFound || ''}
            placeholder="404.html"
          />
        </label>
      </div>
    </div>
  )
}

/**
 * Builds the API payload from the popup form data. Empty `index`/`notFound`
 * are dropped so the server/database defaults apply (and an update leaves them
 * unchanged); `prefix` is normalized to `null` when blank.
 *
 * @param {Record<string, any>} data
 * @returns {Record<string, any>}
 */
function buildPayload(data) {
  const payload = {
    name: data.name ?? '',
    slug: (data.slug || '').trim(),
    prefix: (data.prefix || '').trim() || null,
  }

  const index = (data.index || '').trim()

  if (index) {
    payload.index = index
  }

  const notFound = (data.notFound || '').trim()

  if (notFound) {
    payload.notFound = notFound
  }

  return payload
}

/**
 * SpaceSiteList displays and manages the static sites published from a space.
 *
 * It is a self-contained, `spaceId`-scoped panel - rendered inline on the space
 * page and openable inside a `usePopup` from the blueprint designer (the same
 * dual-use pattern as `SpaceStorageList`). Create/edit happen in nested popups;
 * delete is confirmed.
 *
 * @param {object} props
 * @param {string} props.spaceId - The ID of the space
 * @param {object[]} [props.defaultItems] - Pre-loaded sites (skips the initial fetch)
 * @param {boolean} [props.readOnly] - Hide create/edit/delete affordances
 */
export default function SpaceSiteList({
  spaceId,
  defaultItems = [],
  readOnly = false,
}) {
  const [sites, setSites] = useState(defaultItems)

  const spaceApex = useSpaceApex()

  const toApexHostURL = useApexHostURL()

  const { fetch: load } = useFetch({
    loadingMessage: false,
    failureMessage: false,
  })

  const { fetch: mutate } = useFetch({ failureMessage: true })

  const { popup, openPopup, closePopup } = usePopup()

  const confirmDelete = useConfirmDelete()

  const loadSites = useCallback(async () => {
    const { data, error } = await load(`/api/v1/space/${spaceId}/site/list`)

    if (!error && data) {
      setSites(data.items || [])
    }
  }, [spaceId, load])

  useEffect(() => {
    if (!defaultItems.length) {
      loadSites()
    }
  }, [defaultItems.length, loadSites])

  const handleOpen = useCallback(
    (site) => {
      window.open(
        toApexHostURL(site.slug, spaceApex),
        '_blank',
        'noopener,noreferrer'
      )
    },
    [spaceApex, toApexHostURL]
  )

  const handleSave = useCallback(
    async (site, data) => {
      const payload = buildPayload(data)

      const url = site
        ? `/api/v1/space/${spaceId}/site/${site.id}/update`
        : `/api/v1/space/${spaceId}/site/create`

      const { error } = await mutate(url, { data: payload })

      if (error) {
        return
      }

      toast.success(site ? 'Site updated!' : 'Site created!')

      closePopup()

      await loadSites()
    },
    [spaceId, mutate, closePopup, loadSites]
  )

  const openForm = useCallback(
    (site) => {
      openPopup(() => <SiteFormContent site={site} />, {
        title: site ? 'Edit Site' : 'Create Site',
        cancelButtonCaption: 'Cancel',
        actions: {
          [site ? 'Save' : 'Create']: {
            default: true,
            fn: (data) => handleSave(site, data),
          },
        },
      })
    },
    [openPopup, handleSave]
  )

  const handleDelete = useCallback(
    async (site) => {
      const confirmed = await confirmDelete(
        `Are you sure you want to delete ${site.slug}.${spaceApex}?`
      )

      if (!confirmed) {
        return
      }

      const { error } = await mutate(
        `/api/v1/space/${spaceId}/site/${site.id}/delete`,
        { data: {} }
      )

      if (error) {
        return
      }

      toast.success('Site deleted!')

      await loadSites()
    },
    [spaceId, spaceApex, mutate, confirmDelete, loadSites]
  )

  return (
    <div className="relative">
      {popup}
      <List
        actions={
          readOnly ? null : (
            <button
              className="primary-button small"
              type="button"
              onClick={() => openForm(null)}
            >
              Create Site
            </button>
          )
        }
        emptyMessage="No sites published from this space yet."
      >
        {sites.map((site) => {
          const actions = { Open: () => handleOpen(site) }

          if (!readOnly) {
            actions.Edit = () => openForm(site)
            actions.Delete = () => handleDelete(site)
          }

          return (
            <List.Item
              key={site.id}
              title={`${site.slug}.${spaceApex}`}
              body={describeSite(site)}
              timestamp={site.updatedAt}
              actions={actions}
              onClick={() => handleOpen(site)}
            />
          )
        })}
      </List>
    </div>
  )
}
