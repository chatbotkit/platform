'use client'

import { useCallback, useState } from 'react'

import toast from '@/lib/toast'

import { AppScene } from '@/layouts/App'

import AutoTextarea from '@/components/AutoTextarea'
import { useConfirmDelete } from '@/components/Confirm'
import List from '@/components/List'

import usePopup from '@/hooks/usePopup'

import {
  createSitemap,
  deleteSitemap,
  syncSitemap,
  updateSitemap,
} from '../../server'

import clsx from 'clsx'

function Scene({ className, ...props }) {
  return (
    <AppScene
      {...props}
      className={clsx('scene', className)}
      name={null}
      headline="Manage Websites"
      description="Configure website integrations to import content."
    />
  )
}

function WebsiteScreen({ sitemap = {}, blueprintId: _blueprintId, datasets }) {
  return (
    <div className="space-y-6">
      <div>
        <label className="default-label" htmlFor="name">
          Name
        </label>
        <div className="mt-1">
          <input
            className="default-input w-full"
            name="name"
            defaultValue={sitemap.name}
            required
          />
        </div>
        <p className="input-description">
          The name of your website integration.
        </p>
      </div>
      <div>
        <label className="default-label" htmlFor="description">
          Description
        </label>
        <div className="mt-1">
          <AutoTextarea
            className="default-input w-full"
            name="description"
            defaultValue={sitemap.description}
            rows={2}
          />
        </div>
        <p className="input-description">
          A brief description of this website.
        </p>
      </div>
      <div>
        <label className="default-label" htmlFor="url">
          Sitemap URL
        </label>
        <div className="mt-1">
          <input
            className="default-input w-full"
            name="url"
            type="url"
            defaultValue={sitemap.url}
            placeholder="https://example.com/sitemap.xml"
            required
          />
        </div>
        <p className="input-description">
          The sitemap URL to import content from.
        </p>
      </div>
      {/* Hidden field for datasetId - automatically uses the single dataset */}
      <input type="hidden" name="datasetId" value={datasets[0]?.id || ''} />
    </div>
  )
}

function SitemapList({
  sitemaps: _sitemaps,
  setSitemaps,
  blueprintId,
  datasets,
}) {
  const { popup, openPopup, closePopup } = usePopup()
  const confirmDelete = useConfirmDelete()

  const openCreateScreen = useCallback(() => {
    openPopup(<WebsiteScreen blueprintId={blueprintId} datasets={datasets} />, {
      title: 'Add Website',
      actions: {
        Create: {
          fn: async (props) => {
            closePopup()

            const toastId = toast.loading('Adding website...', {})
            const result = await createSitemap({ ...props, blueprintId })

            if ('error' in result) {
              toast.error(result.error.message, { id: toastId })

              return
            }

            setSitemaps((items) => [...items, result])
            toast.success('Website added!', { id: toastId })
          },
          default: true,
        },
      },
    })
  }, [blueprintId, datasets, closePopup, openPopup, setSitemaps])

  const openEditScreen = useCallback(
    (sitemap) => {
      openPopup(
        <WebsiteScreen
          sitemap={sitemap}
          blueprintId={blueprintId}
          datasets={datasets}
        />,
        {
          title: 'Edit Website',
          actions: {
            Save: {
              fn: async (props) => {
                closePopup()

                const toastId = toast.loading('Updating website...', {})
                const result = await updateSitemap({ id: sitemap.id, ...props })

                if ('error' in result) {
                  toast.error(result.error.message, { id: toastId })

                  return
                }

                setSitemaps((items) =>
                  items.map((item) => (item.id === sitemap.id ? result : item))
                )
                toast.success('Website updated!', { id: toastId })
              },
              default: true,
            },
          },
        }
      )
    },
    [blueprintId, datasets, closePopup, openPopup, setSitemaps]
  )

  const handleSync = useCallback(async (sitemap) => {
    const toastId = toast.loading('Syncing website...', {})
    const result = await syncSitemap({ id: sitemap.id })

    if ('error' in result) {
      toast.error(result.error.message, { id: toastId })

      return
    }

    toast.success('Website synced successfully!', { id: toastId })
  }, [])

  const handleDelete = useCallback(
    async (sitemap) => {
      if (
        !(await confirmDelete(
          `Are you sure you want to delete "${sitemap.name}"?`
        ))
      ) {
        return
      }

      const toastId = toast.loading('Deleting website...', {})
      const result = await deleteSitemap({ id: sitemap.id })

      if ('error' in result) {
        toast.error(result.error.message, { id: toastId })

        return
      }

      setSitemaps((items) => items.filter((item) => item.id !== sitemap.id))
      toast.success('Website deleted!', { id: toastId })
    },
    [confirmDelete, setSitemaps]
  )

  return (
    <>
      {popup}
      <List
        emptyMessage="No websites added yet."
        actions={
          <button
            className="primary-button small"
            type="button"
            onClick={openCreateScreen}
          >
            Add Website
          </button>
        }
      >
        {_sitemaps.map((sitemap) => (
          <List.Item
            key={sitemap.id}
            title={sitemap.name}
            body={[sitemap.description, sitemap.url]}
            timestamp={sitemap.updatedAt}
            actions={{
              Sync: () => handleSync(sitemap),
              Edit: () => openEditScreen(sitemap),
              Delete: () => handleDelete(sitemap),
            }}
          />
        ))}
      </List>
    </>
  )
}

export function Main({ blueprintId, sitemaps: _sitemaps, datasets }) {
  const [sitemaps, setSitemaps] = useState(_sitemaps)

  return (
    <>
      <Scene compact={true} />
      <SitemapList
        sitemaps={sitemaps}
        setSitemaps={setSitemaps}
        blueprintId={blueprintId}
        datasets={datasets}
      />
    </>
  )
}
