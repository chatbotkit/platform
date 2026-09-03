import { useState } from 'react'

import prisma from '@/prisma/client'
import { FileVisibility } from '@/prisma/enums'

import { formToData } from '@/lib/form'
import { getSoftSession } from '@/lib/session.get'
import { withFileResources } from '@/lib/solution'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import CodeAction from '@/components/CodeAction'
import { useConfirmDelete } from '@/components/Confirm'
import DescriptionInput from '@/components/DescriptionInput'
import Expando from '@/components/Expando'
import FAQ from '@/components/FAQ'
import FileDownloadButton from '@/components/FileDownloadButton'
import FileEditButton from '@/components/FileEditButton'
import FileUploadButton from '@/components/FileUploadButton'
import Headline from '@/components/Headline'
import MetaInput from '@/components/MetaInput'
import PageSections from '@/components/PageSections'
import ThisSolution from '@/components/ThisSolution'

import useFetch from '@/hooks/useFetch'
import useRouter from '@/hooks/useRouter'
import useScopedCreateData from '@/hooks/useScopedCreateData'

import faq from '@/content/faqs/platform-file-instance.yaml'

export function Form({ file }) {
  const confirmDelete = useConfirmDelete()

  const [updateCounter, setUpdateCounter] = useState(0)

  const router = useRouter()

  const scopeCreateData = useScopedCreateData()

  const { code, fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  async function handleOnSubmit(event) {
    event.preventDefault()

    const data = formToData(event.target)

    if (!data) {
      return
    }

    if (data.public) {
      delete data.public

      data.visibility = FileVisibility.public
    } else {
      delete data.public

      data.visibility = FileVisibility.private
    }

    if (file.id) {
      const { error } = await fetch(`/api/v1/file/${file.id}/update`, {
        data,

        successMessage: 'File updated.',
      })

      if (!error) {
        Object.assign(file, data)

        setUpdateCounter((updateCounter) => updateCounter + 1)
      }
    } else {
      const {
        data: { id: fileId },
      } = await fetch(`/api/v1/file/create`, {
        data: scopeCreateData(data),

        successMessage: 'File created.',
      })

      if (fileId) {
        router.push(`/files/${fileId}`)
      }
    }
  }

  async function handleDelete(event) {
    event.preventDefault()

    if (!(await confirmDelete('Do you really want to delete this file?'))) {
      return
    }

    const { error } = await fetch(`/api/v1/file/${file.id}/delete`, {
      data: {},
    })

    if (!error) {
      router.push(`/files`)
    }
  }

  return (
    <>
      <CodeAction key={code} code={code} />
      <ThisSolution
        type="file"
        instance={file}
        updateKey={updateCounter}
        portal={true}
      />
      <form className="divided-area" onSubmit={handleOnSubmit}>
        <div className="divided-area">
          {/* file configuration */}
          <div>
            <Headline title="File Configuration">
              This information is used to configure the file.
            </Headline>
            <div className="mt-6 space-y-6">
              {/* name */}
              <div>
                <label className="default-label" htmlFor="name">
                  Name
                </label>
                <div className="mt-1">
                  <input
                    className="default-input w-full"
                    name="name"
                    type="text"
                    defaultValue={file.name}
                  />
                </div>
                <p className="input-description">
                  Type any name to recognize the file from others. This
                  information is not used as part of your chatbot conversations.
                </p>
              </div>
              {/* description */}
              <div>
                <label className="default-label" htmlFor="description">
                  Description
                </label>
                <div className="mt-1">
                  <DescriptionInput
                    className="default-input w-full"
                    name="description"
                    defaultValue={file.description}
                  />
                </div>
                <p className="input-description">
                  Type description to inform what this file is about. This
                  information is not used as part of your chatbot conversations.
                </p>
              </div>
              {/* advanced options */}
              <Expando
                titleClassName="default-link text-sm"
                title="Advanced Options"
              >
                {/* alias */}
                <div>
                  <label className="default-label" htmlFor="alias">
                    Alias
                  </label>
                  <div className="mt-1">
                    <input
                      className="default-input w-full max-w-xs"
                      name="alias"
                      type="text"
                      defaultValue={file.alias}
                      pattern="[a-z0-9_-]*"
                      maxLength={128}
                    />
                  </div>
                  <p className="input-description">
                    Optional unique alias for this file. Use lowercase letters,
                    numbers, hyphens, and underscores only. Can be used to
                    reference this file via @alias.
                  </p>
                </div>
                {/* visibility */}
                <div>
                  <label className="default-label" htmlFor="visibility">
                    Visibility
                  </label>
                  <div className="mt-1">
                    <select
                      name="visibility"
                      className="default-input w-full max-w-xs"
                      defaultValue={file.visibility}
                    >
                      {Object.entries(FileVisibility).map(([key, value]) => (
                        <option key={key} value={key}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="input-description">
                    Private files are only accessible by the owner. Protected
                    files are accessible by the owner and all child Users.
                    Public files are accessible by all users of the platform.
                  </p>
                </div>
                {/* meta */}
                <div>
                  <label className="default-label" htmlFor="meta">
                    Meta
                  </label>
                  <div className="mt-1">
                    <MetaInput name="meta" defaultMeta={file.meta} />
                  </div>
                  <p className="input-description">
                    Custom metadata for this file.
                  </p>
                </div>
              </Expando>
            </div>
          </div>
        </div>
        {/* actions */}
        <div>
          <div className="action-area">
            {/* <BackLink className="default-button" href="/files">
              Back To Files
            </BackLink> */}
            {file.id ? (
              <button
                type="button"
                className="danger-button"
                onClick={handleDelete}
              >
                Delete
              </button>
            ) : null}
            {file.id ? (
              <FileUploadButton className="default-button" fileId={file.id} />
            ) : null}
            {file.id ? (
              <FileDownloadButton className="default-button" fileId={file.id} />
            ) : null}
            {file.id ? (
              <FileEditButton
                className="default-button"
                fileId={file.id}
                fileName={file.name}
                contentType={file.meta?.contentType || file.type}
              />
            ) : null}
            <span className="action-area-space" />
            <button type="submit" className="primary-button">
              {file.id ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </form>
    </>
  )
}

export default function Index({ file }) {
  return (
    <>
      {/* <div className="main-page last">
        <NavHeader link="/files" caption="files" title="File">
          <p>
            A file represents a single blob of data that can be used by your
            bot, widget or a dataset.
          </p>
        </NavHeader>
      </div> */}
      <PageSections className="pt-12">
        <section data-page-section-title="Configuration">
          <div className="main-page">
            <Form file={file} />
          </div>
        </section>
        {/* {file.id ? (
          <section>
            <div className="main-page">
              <Headline title="Meta">
                Meta fields assigned to this file.
              </Headline>
              <MetaArea instance={file} />
            </div>
          </section>
        ) : null} */}
      </PageSections>
    </>
  )
}

Index.getLayout = function (children, { file }) {
  return (
    <Dashboard
      breadcrumbs={['Files', 'ChatBotKit']}
      title={file.name || file.id || 'New'}
      authenticated={true}
    >
      {children}
      <FAQ faq={faq} />
    </Dashboard>
  )
}

export async function getServerSideProps(context) {
  const session = await getSoftSession(context.req, context.res)

  if (!session) {
    return {
      redirect: {
        destination: `/signin?callbackUrl=${context.resolvedUrl}`,
        permanent: false,
      },
    }
  }

  if (context.query.fileId === 'new') {
    return {
      props: makeJsonSafe({
        file: {},
      }),
    }
  }

  const file = await prisma.file.findUnique({
    where: {
      id: context.query.fileId,
    },

    include: {
      ...withFileResources(session.user.id),
    },
  })

  if (!file) {
    return {
      notFound: true,
    }
  }

  if (file.userId !== session.user.id) {
    return {
      notFound: true,
    }
  }

  return {
    props: makeJsonSafe({
      file,
    }),
  }
}
