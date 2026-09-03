import { useEffect, useMemo, useState } from 'react'

import { maxTokens as defaultRecordMaxTokens } from '@/config/records'

import prisma from '@/prisma/client'

import { formToData } from '@/lib/form'
import { it } from '@/lib/it'
import { runTasks } from '@/lib/job'
import { getAccept } from '@/lib/mime'
import { getSoftSession } from '@/lib/session.get'
import { withDatasetResources } from '@/lib/solution'
import { getStore } from '@/lib/store.types'
import { getRandomId } from '@/lib/string'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import BackButton from '@/components/BackButton'
import CodeAction from '@/components/CodeAction'
import { useConfirm } from '@/components/Confirm'
import Expando from '@/components/Expando'
import FAQ from '@/components/FAQ'
import FileManager from '@/components/FileManager'
import ForwardButton from '@/components/ForwardButton'
import Headline from '@/components/Headline'
import KeyCombo from '@/components/KeyCombo'
import MetaInput from '@/components/MetaInput'
import PageSections from '@/components/PageSections'
import RecordInput from '@/components/RecordInput'
import SimpleTabs from '@/components/SimpleTabs'
import ThisSolution from '@/components/ThisSolution'

import useDebounce from '@/hooks/useDebounce'
import useFetch from '@/hooks/useFetch'
import usePopup from '@/hooks/usePopup'
import useRouter from '@/hooks/useRouter'
import useTextCompletion from '@/hooks/useTextCompletion'

import faq from '@/content/faqs/platform-dataset-record-instance.yaml'

import pluralize from 'pluralize'

const MULTI_RECORD_CREATE_CONCURRENCY = 5

export function Import({ text, setText, setMulti, closePopup }) {
  const confirm = useConfirm()

  const [files, setFiles] = useState([])

  const [url, setUrl] = useState('')

  const { loading, setLoading, fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  async function importFiles() {
    if (
      text &&
      !(await confirm(
        'Your record already has some information. Do you want to override it?'
      ))
    ) {
      return
    }

    const worker = new Worker(
      new URL('../../../../../workers/file.worker.js', import.meta.url)
    )

    worker.onmessage = function ({ data: { text } }) {
      setLoading(false)

      setText(text)
      setMulti(true)

      closePopup()
    }

    worker.messageerror = function () {
      setLoading(false)
    }

    worker.onerror = function () {
      setLoading(false)
    }

    setLoading(true)

    worker.postMessage({ files })
  }

  async function importURL() {
    if (
      text &&
      !(await confirm(
        'Your record already has some information. Do you want to override it?'
      ))
    ) {
      return
    }

    const { error, data } = await fetch('/api/v1/url/fetch', {
      data: {
        url,
      },
    })

    if (!error) {
      setText(data.text)
      setMulti(true)

      closePopup()
    }
  }

  const tabs = {
    File: (
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="default-label" htmlFor="url">
            File
          </label>
          <div>
            <FileManager
              files={files}
              setFiles={setFiles}
              accept={getAccept([
                '.md',
                '.txt',
                '.pdf',
                '.docx',
                '.pptx',
                '.xlsx',
                '.csv',
                '.json',
                '.yaml',
                '.html',
              ])}
            />
          </div>
          <p className="text-sm text-gray-500">
            Please select the files you would like to import. Note that
            importing the same file twice may create multiple records with the
            same content.
          </p>
        </div>
        <div className="flex flex-row space-x-2">
          <button
            className="default-button"
            type="button"
            onClick={() => closePopup()}
            disabled={loading}
          >
            Cancel
          </button>
          <div className="flex-1" />
          <button
            className="primary-button"
            type="button"
            onClick={() => importFiles()}
            disabled={loading || !files.length}
          >
            Import {pluralize('File', files.length)}
          </button>
        </div>
      </div>
    ),

    URL: (
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="default-label" htmlFor="url">
            URL
          </label>
          <div>
            <input
              className="default-input w-full"
              name="url"
              type="url"
              placeholder="https://..."
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              disabled={loading}
            />
          </div>
          <p className="text-sm text-gray-500">
            Please enter the URL of the webpage you would like to import as a
            dataset record. Note that only the text content of the webpage will
            be imported, not any images or other multimedia.
          </p>
        </div>
        <div className="flex flex-row space-x-2">
          <button
            className="default-button"
            type="button"
            onClick={() => closePopup()}
            disabled={loading}
          >
            Cancel
          </button>
          <div className="flex-1" />
          <button
            className="primary-button"
            type="button"
            onClick={() => importURL()}
            disabled={loading || !url}
          >
            Import URL
          </button>
        </div>
      </div>
    ),
  }

  return <SimpleTabs tabs={tabs} />
}

export function Form({ dataset }) {
  const confirm = useConfirm()

  const [updateCounter, setUpdateCounter] = useState(0)

  const recordMaxTokens = dataset.recordMaxTokens || defaultRecordMaxTokens

  const router = useRouter()

  const [text, setText] = useState(dataset.record.text || '')

  const [records, setRecords] = useState([text])

  const [multi, setMulti] = useState(false)

  const [parsing, setParsing] = useState(false)

  useEffect(() => {
    setText(dataset.record.text || '')
  }, [router.asPath])

  const { code, loading, fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  const debouncedText = useDebounce(text, 1000)

  const gptWorker = useMemo(() => {
    const worker =
      typeof Worker === 'function'
        ? new Worker(
            new URL('../../../../../workers/gpt.worker.js', import.meta.url)
          )
        : undefined

    worker?.addEventListener('message', ({ data: { action, result } }) => {
      if (!result) {
        return
      }

      const { chunks } = result

      switch (action) {
        case 'split':
          setParsing(false)

          setRecords(chunks)

          break
      }
    })

    return worker
  }, [])

  useEffect(() => {
    gptWorker.postMessage({ action: 'getTextTokensLength', params: { text } })

    setParsing(true)

    gptWorker.postMessage({
      action: 'split',
      params: {
        text,
        maxTokens: recordMaxTokens,
      },
    })
  }, [debouncedText])

  const { popup, openPopup, closePopup } = usePopup({
    noActions: true,
  })

  const { onKeyDown: onKeyDownTextComplete } = useTextCompletion()

  async function createSingleRecord(event) {
    event.preventDefault()

    const text = event.target.dataset.text

    const { error } = await fetch(
      `/api/v1/dataset/${dataset.id}/record/create`,
      {
        data: {
          text: text,
          meta: {
            manual: true,
          },
        },

        successMessage: 'Dataset record created.',
      }
    )

    if (!error) {
      setRecords(records.filter((record) => record !== text))
    }
  }

  async function handleOnSubmit(event) {
    event.preventDefault()

    const data = formToData(event.target)

    if (!data) {
      return
    }

    if (dataset.record.id) {
      const { error } = await fetch(
        `/api/v1/dataset/${dataset.id}/record/${dataset.record.id}/update`,
        {
          data,

          successMessage: 'Dataset record updated.',
        }
      )

      if (!error) {
        Object.assign(dataset.record, data)

        setUpdateCounter((updateCounter) => updateCounter + 1)
      }
    } else {
      const {
        data: { id: recordId },
      } = await fetch(`/api/v1/dataset/${dataset.id}/record/create`, {
        data,

        successMessage: 'Dataset record created.',
      })

      if (recordId) {
        router.push(`/datasets/${dataset.id}/records/${recordId}`)
      }
    }
  }

  async function backToDataset(event) {
    event.preventDefault()

    if (text !== dataset.record.text) {
      if (
        !(await confirm('There are unsaved changes. Do you want to continue?'))
      ) {
        return
      }
    }

    router.push(`/datasets/${dataset.id}`)
  }

  async function deleteRecord(event) {
    event.preventDefault()

    if (
      !(await confirm(
        'You are about to delete this record. Do you want to continue?'
      ))
    ) {
      return
    }

    const { error } = await fetch(
      `/api/v1/dataset/${dataset.id}/record/${dataset.record.id}/delete`,
      {
        data: {},
      }
    )

    if (!error) {
      router.push(`/datasets/${dataset.id}`)
    }
  }

  async function gotoCreateNewRecord(event) {
    event.preventDefault()

    if (text !== dataset.record.text) {
      if (
        !(await confirm('There are unsaved changes. Do you want to continue?'))
      ) {
        return
      }
    }

    router.push(`/datasets/${dataset.id}/records/new`)
  }

  async function openImportWizard(event) {
    event.preventDefault()

    openPopup(
      <Import
        text={text}
        setText={setText}
        multi={multi}
        setMulti={setMulti}
        closePopup={closePopup}
      />,
      {
        closePopupOnClickOutside: false,
        title: 'Import',
      }
    )
  }

  async function createMultipleRecords(event) {
    event.preventDefault()

    if (
      !(await confirm(
        `You are about to create ${records.length} records. Do you want to continue?`
      ))
    ) {
      return
    }

    const toastId = getRandomId('tmp-')

    await runTasks(
      Array(MULTI_RECORD_CREATE_CONCURRENCY)
        .fill(it(records))
        .map(async (records) => {
          for (const block of records) {
            await fetch(`/api/v1/dataset/${dataset.id}/record/create`, {
              data: {
                text: block,
              },

              successMessage: `Dataset records created.`,

              toastId,
            })
          }
        })
    )

    router.push(`/datasets/${dataset.id}`)
  }

  return (
    <>
      <CodeAction key={code} code={code} />
      <ThisSolution
        type="dataset"
        instance={dataset}
        updateKey={updateCounter}
        portal={true}
      />
      <form className="divided-area" onSubmit={handleOnSubmit}>
        <div className="divided-area">
          {/* configuration */}
          <div>
            <Headline title="Dataset Record Configuration">
              This information is used to configure the record.
            </Headline>
            <div className="mt-6 space-y-6">
              {/* single */}
              {!multi ? (
                <div>
                  <label className="default-label" htmlFor="text">
                    Text
                  </label>
                  <div className="mt-1">
                    <RecordInput
                      className="default-input"
                      name="text"
                      value={text}
                      onChange={(event) => setText(event.target.value)}
                      onKeyDown={onKeyDownTextComplete}
                      maxTokens={recordMaxTokens}
                      disabled={loading}
                      required={true}
                      tabIndex={1}
                    />
                  </div>
                  <p className="input-description">
                    The text define the contents for the record. It can be any
                    arbitrary text that will provide context for the bot during
                    a conversation. Use{' '}
                    <strong>
                      <KeyCombo secondKey="Enter" />
                    </strong>{' '}
                    to auto complete any entered text.
                  </p>
                </div>
              ) : null}
              {/* multi */}
              {multi ? (
                <div>
                  <label className="default-label" htmlFor="multi">
                    Multiple Records
                  </label>
                  <div className="mt-1">
                    <div
                      className="default-input h-[600px] overflow-auto p-4 space-y-6 relative"
                      tabIndex={1}
                    >
                      {parsing ? (
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-sm">
                          Parsing...
                        </div>
                      ) : (
                        (records ? records : [text]).map((block, id) => {
                          return (
                            <div key={id} className="space-y-2">
                              <div className="text-sm line-clamp-6">
                                {block}
                              </div>
                              <div>
                                <button
                                  className="default-link text-sm"
                                  type="button"
                                  onClick={createSingleRecord}
                                  data-text={block}
                                >
                                  Create This Record
                                </button>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                  <p className="input-description">
                    You need to create multiple records. Either select
                    individual records from the list or create all{' '}
                    {records.length} records at once.
                  </p>
                </div>
              ) : null}
              {/* source */}
              <div>
                <label className="default-label" htmlFor="source">
                  Source
                </label>
                <div className="mt-1">
                  <input
                    className="default-input w-full"
                    name="source"
                    type="text"
                    defaultValue={dataset.record.source}
                    placeholder="https://..."
                    disabled={loading}
                    tabIndex={2}
                  />
                </div>
                <p className="input-description">
                  The source of the record. This is a URL that points to the
                  original source of the record.
                </p>
              </div>
              {/* advanced options */}
              <Expando
                titleClassName="default-link text-sm"
                title="Advanced Options"
              >
                {/* meta */}
                <div>
                  <label className="default-label" htmlFor="meta">
                    Meta
                  </label>
                  <div className="mt-1">
                    <MetaInput name="meta" defaultMeta={dataset.record.meta} />
                  </div>
                  <p className="input-description">
                    Custom metadata for this record.
                  </p>
                </div>
              </Expando>
            </div>
          </div>
        </div>
        {/* actions */}
        <div>
          <div className="action-area">
            <BackButton
              type="button"
              className="default-button"
              onClick={backToDataset}
              disabled={loading}
            >
              Back To Dataset
            </BackButton>
            {dataset.record.id ? (
              <ForwardButton
                className="default-button"
                type="button"
                onClick={gotoCreateNewRecord}
                disabled={loading}
              >
                Create New Record
              </ForwardButton>
            ) : null}
            {dataset.record.id ? (
              <button
                type="button"
                className="danger-button"
                onClick={deleteRecord}
                disabled={loading}
              >
                Delete
              </button>
            ) : null}
            {!dataset.record.id ? (
              <button
                type="button"
                className="default-button"
                onClick={openImportWizard}
                disabled={loading}
              >
                Import
              </button>
            ) : null}
            {!dataset.record.id && multi && records.length > 1 ? (
              <button
                className="default-button"
                type="button"
                onClick={() => setMulti(false)}
                disabled={loading}
              >
                Edit
              </button>
            ) : null}
            {!dataset.record.id && !multi && records.length > 1 ? (
              <button
                className="default-button"
                type="button"
                onClick={() => setMulti(true)}
                disabled={loading}
              >
                Pack
              </button>
            ) : null}
            <span className="action-area-space" />
            {!dataset.record.id && multi ? (
              <button
                className="primary-button"
                type="button"
                onClick={createMultipleRecords}
                disabled={loading}
              >
                Create {records.length} {pluralize('Records', records.length)}
              </button>
            ) : null}
            {!dataset.record.id && !multi && records.length > 1 ? (
              <button
                className="default-button"
                type="button"
                onClick={createMultipleRecords}
                disabled={loading}
              >
                Create {records.length} {pluralize('Records', records.length)}
              </button>
            ) : null}
            {text.length > 0 && !multi ? (
              <button
                className="primary-button"
                type="submit"
                disabled={loading}
              >
                {dataset.record.id ? 'Save' : 'Create'}
              </button>
            ) : null}
          </div>
        </div>
        {popup}
      </form>
    </>
  )
}

export default function Index({ dataset }) {
  // const recordMaxTokens = dataset.recordMaxTokens || defaultRecordMaxTokens

  return (
    <>
      {/* <div className="main-page last">
        <NavHeader
          link={`/datasets/${dataset.id}`}
          caption="dataset"
          title="Record"
        >
          <p>
            A dataset record is a single piece of data in a dataset. It can
            contain up to {recordMaxTokens} tokens, which can be words, phrases,
            or symbols.
          </p>
        </NavHeader>
      </div> */}
      <PageSections className="pt-12">
        <section data-page-section-title="Configuration">
          <div className="main-page">
            <Form dataset={dataset} />
          </div>
        </section>
        {/* {dataset.record?.id ? (
          <section>
            <div className="main-page">
              <Headline title="Meta">
                Meta fields assigned to this dataset record.
              </Headline>
              <MetaArea instance={dataset.record} />
            </div>
          </section>
        ) : null} */}
      </PageSections>
    </>
  )
}

Index.getLayout = function (children, { dataset }) {
  return (
    <Dashboard
      breadcrumbs={[dataset.name || dataset.id, 'Datasets', 'ChatBotKit']}
      title={dataset.record.id || 'New'}
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

  const dataset = await prisma.dataset.findUnique({
    where: {
      id: context.query.datasetId,
    },

    select: {
      id: true,

      userId: true,

      name: true,

      recordMaxTokens: true,

      ...withDatasetResources(session.user.id),
    },
  })

  if (!dataset) {
    return {
      notFound: true,
    }
  }

  if (dataset.userId !== session.user.id) {
    return {
      notFound: true,
    }
  }

  if (context.query.recordId === 'new') {
    dataset.record = {
      text: '',
    }

    return {
      props: makeJsonSafe({
        dataset,
      }),
    }
  }

  // Fetch record from vector store
  const store = await getStore()

  let record = null

  try {
    record = await store.accessRecord({
      datasetId: dataset.id,
      recordId: context.query.recordId,
    })
  } catch {
    // Record not found
  }

  if (!record) {
    return {
      notFound: true,
    }
  }

  dataset.record = {
    id: record.id,
    text: record.text,
    source: record.source,
    meta: record.meta,
  }

  return {
    props: makeJsonSafe({
      dataset,
    }),
  }
}
