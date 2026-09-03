import { useMemo, useState } from 'react'

import { getExternalAPIHostURL } from '@/lib/host'

import datasetsConfig from '@/config/datasets'
import {
  maxSearchRecords as defaultMaxSearchRecords,
  maxTokens as defaultRecordMaxTokens,
} from '@/config/records'
import { defaultRerankModel } from '@/config/models'

import prisma from '@/prisma/client'
import { DatasetVisibility } from '@/prisma/enums'

import { formToData } from '@/lib/form'
import { getSoftSession } from '@/lib/session.get'
import { withDatasetResources } from '@/lib/solution'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import BotList from '@/components/BotList'
import BotSelect from '@/components/BotSelect'
import CodeAction from '@/components/CodeAction'
import CommaListSelect from '@/components/CommaListSelect'
import { useConfirm, useConfirmDelete } from '@/components/Confirm'
import ConversationManager from '@/components/ConversationManager'
import DatasetFiles from '@/components/DatasetFiles'
import DescriptionInput from '@/components/DescriptionInput'
import DocsLink from '@/components/DocsLink'
import EventLog from '@/components/EventLog'
import Expando from '@/components/Expando'
import FAQ from '@/components/FAQ'
import Headline from '@/components/Headline'
import HubOptions from '@/components/HubOptions'
import Link from '@/components/Link'
import MetaInput from '@/components/MetaInput'
import ObjectView from '@/components/ObjectView'
import PageSections from '@/components/PageSections'
import PlatformExperienceOnly from '@/components/PlatformExperienceOnly'
import DatasetRecordList from '@/components/DatasetRecordList'
import RerankerModelSelect from '@/components/RerankerModelSelect'
import ThisSolution from '@/components/ThisSolution'
import TokenAutoTextarea from '@/components/TokenAutoTextarea'
import WebhookSetupSection from '@/components/WebhookSetupSection'

import useExternalAPIURL from '@/hooks/useExternalAPIURL'
import useFetch from '@/hooks/useFetch'
import usePopup from '@/hooks/usePopup'
import useRouter from '@/hooks/useRouter'
import useScopedCreateData from '@/hooks/useScopedCreateData'

import faq from '@/content/faqs/platform-dataset-instance.yaml'
import IntegrationList from '@/components/IntegrationList'

export const VISIBLE_EVENT_TYPES = [
  // @note whitelist only specific events if applicable
]

export function Form({ dataset }) {
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
    event.stopPropagation()

    const data = formToData(event.target)

    if (!data) {
      return
    }

    if (dataset.id) {
      const { error } = await fetch(`/api/v1/dataset/${dataset.id}/update`, {
        data,

        successMessage: 'Dataset updated.',
      })

      if (!error) {
        Object.assign(dataset, data)

        setUpdateCounter((updateCounter) => updateCounter + 1)
      }
    } else {
      const {
        data: { id: datasetId },
      } = await fetch(`/api/v1/dataset/create`, {
        data: scopeCreateData(data),

        successMessage: 'Dataset created.',
      })

      if (datasetId) {
        router.push(`/datasets/${datasetId}`)
      }
    }

    if (router.query.botId) {
      await fetch(`/api/v1/bot/${router.query.botId}/update`, {
        data: {
          datasetId: dataset.id,
        },

        successMessage: 'Bot assigned to dataset.',
      })
    }
  }

  async function handleDelete(event) {
    event.preventDefault()
    event.stopPropagation()

    if (!(await confirmDelete('Do you really want to delete this dataset?'))) {
      return
    }

    const { error } = await fetch(`/api/v1/dataset/${dataset.id}/delete`, {
      data: {},

      successMessage: 'Dataset deleted...',
    })

    if (!error) {
      router.push(`/datasets`)
    }
  }

  function handleOnChange(event) {
    event.preventDefault()
    event.stopPropagation()

    if (dataset.id) {
      return
    }

    const { name, value, form } = event.target

    switch (name) {
      case 'recordMaxTokens': {
        const number = parseInt(value)

        if (!isNaN(number)) {
          form.searchMaxTokens.value =
            number *
            (parseInt(form.searchMaxRecords.value) || defaultMaxSearchRecords)
        }

        break
      }

      case 'searchMaxRecords': {
        const number = parseInt(value)

        if (!isNaN(number)) {
          form.searchMaxTokens.value =
            number *
            (parseInt(form.recordMaxTokens.value) || defaultRecordMaxTokens)
        }

        break
      }
    }
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
      <form
        className="divided-area"
        onSubmit={handleOnSubmit}
        onChange={handleOnChange}
      >
        <div className="divided-area">
          {/* dataset configuration */}
          <div>
            <Headline title="Dataset Configuration">
              This information is used to configure the dataset.
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
                    defaultValue={dataset.name}
                  />
                </div>
                <p className="input-description">
                  Type any name to recognize the dataset from others.{' '}
                  <strong>
                    The name can any influence how the dataset is used.
                  </strong>
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
                    defaultValue={dataset.description}
                  />
                </div>
                <p className="input-description">
                  Type description to inform what this dataset is about.{' '}
                  <strong>
                    The description can influence how the dataset is used.
                  </strong>
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
                      defaultValue={dataset.alias}
                      pattern="[a-z0-9_-]*"
                      maxLength={128}
                    />
                  </div>
                  <p className="input-description">
                    Optional unique alias for this dataset. Use lowercase
                    letters, numbers, hyphens, and underscores only. Can be used
                    to reference this dataset via @alias.
                  </p>
                </div>
                {/* reranker */}
                <div>
                  <label className="default-label" htmlFor="reranker">
                    Reranker
                    <sup className="beta">BETA</sup>
                  </label>
                  <div className="mt-1">
                    <RerankerModelSelect
                      className="default-input w-full max-w-xs"
                      name="reranker"
                      defaultValue={dataset.reranker}
                    />
                  </div>
                  <p className="input-description">
                    Provide reranker class for this dataset. For more
                    information about rerankers, please refer to the{' '}
                    <DocsLink className="default-link" slug="rerankers">
                      documentation
                    </DocsLink>
                    .
                  </p>
                </div>
                {/* recordMaxTokens */}
                <div>
                  <label className="default-label" htmlFor="recordMaxTokens">
                    Record Max Tokens
                  </label>
                  <div className="mt-1">
                    <input
                      className="default-input w-full max-w-xs"
                      type="number"
                      name="recordMaxTokens"
                      defaultValue={
                        dataset.recordMaxTokens || defaultRecordMaxTokens
                      }
                      min={2}
                      step={1}
                    />
                  </div>
                  <p className="input-description">
                    The maximum number of tokens to use for new records. This
                    value is only taken into account when importing data from
                    files and integrations. We recommend to use a value between{' '}
                    <strong>{defaultRecordMaxTokens}</strong> and{' '}
                    <strong>{defaultRecordMaxTokens * 2}</strong>.
                  </p>
                </div>
                {/* searchMinScore */}
                <div>
                  <label className="default-label" htmlFor="searchMinScore">
                    Search Min Score
                  </label>
                  <div className="mt-1">
                    <input
                      className="default-input w-full max-w-xs"
                      type="number"
                      name="searchMinScore"
                      defaultValue={dataset.searchMinScore}
                      min={0}
                      max={1}
                      step="any"
                    />
                  </div>
                  <p className="input-description">
                    The score to filter search results by. Leave at{' '}
                    <strong>0</strong> to let the reranker and record limits
                    shape the results.
                  </p>
                </div>
                {/* searchMaxRecords */}
                <div>
                  <label className="default-label" htmlFor="searchMaxRecords">
                    Search Max Records
                  </label>
                  <div className="mt-1">
                    <input
                      className="default-input w-full max-w-xs"
                      type="number"
                      name="searchMaxRecords"
                      defaultValue={
                        dataset.searchMaxRecords || defaultMaxSearchRecords
                      }
                      min={1}
                      max={100}
                      step={1}
                    />
                  </div>
                  <p className="input-description">
                    The maximum number of records to return for each dataset
                    search. It is recommended to use a value between{' '}
                    <strong>1</strong> and <strong>10</strong>.
                  </p>
                </div>
                {/* searchMaxTokens */}
                <div>
                  <label className="default-label" htmlFor="searchMaxTokens">
                    Search Max Tokens
                  </label>
                  <div className="mt-1">
                    <input
                      className="default-input w-full max-w-xs"
                      type="number"
                      name="searchMaxTokens"
                      defaultValue={dataset.searchMaxTokens}
                      min={2}
                      step={1}
                    />
                  </div>
                  <p className="input-description">
                    The maximum number of tokens to use for all found dataset
                    record. If not specified, the default value is used. It is
                    recommended to use a value large enough to cover the maximum
                    number of tokens for all found records. For example, if the
                    maximum number of tokens for each record is{' '}
                    <strong>{defaultRecordMaxTokens}</strong> and the maximum
                    number of records to return is <strong>5</strong>, then the
                    maximum number of tokens to use is{' '}
                    <strong>{defaultRecordMaxTokens * 5}</strong>.
                  </p>
                </div>
                {/* separators */}
                <div>
                  <label className="default-label" htmlFor="separators">
                    Separators
                  </label>
                  <div className="mt-1">
                    <CommaListSelect
                      className="default-input w-full"
                      name="separators"
                      defaultValue={dataset.separators}
                      placeholder="Type the separators and press enter..."
                    />
                  </div>
                  <p className="input-description">
                    Provide a list of separators to use when tokenizing text.
                    The text will be split into chunks starting with the first
                    separator found. Subsequent splits will be made using the
                    next separator found, etc. You can use escape sequences like{' '}
                    <strong>
                      <code>\n</code>
                    </strong>{' '}
                    for new line,{' '}
                    <strong>
                      <code>\t</code>
                    </strong>{' '}
                    for tab, etc. You should at the very least include the
                    following separators:{' '}
                    {['\n\n', '\n'].map((separator, index, array) => {
                      return (
                        <span key={index}>
                          <strong key={index}>
                            {JSON.stringify(separator)}
                          </strong>
                          {index < array.length - 2
                            ? ', '
                            : index < array.length - 1
                              ? ' and '
                              : ''}
                        </span>
                      )
                    })}
                    . If not specified, the default separators are used.
                  </p>
                </div>
                {/* matchInstruction */}
                <div>
                  <label className="default-label" htmlFor="matchInstruction">
                    Match Instruction
                  </label>
                  <div className="mt-1">
                    <TokenAutoTextarea
                      className="default-input w-full"
                      name="matchInstruction"
                      defaultValue={dataset.matchInstruction}
                      placeholder={datasetsConfig.defaultMatchInstruction}
                      hideZero={true}
                    />
                  </div>
                  <p className="input-description">
                    Provide optional instruction to use when a suitable dataset
                    record match is found. We will use the default instruction
                    if not specified.
                  </p>
                </div>
                {/* mismatchInstruction */}
                <div>
                  <label
                    className="default-label"
                    htmlFor="mismatchInstruction"
                  >
                    Mismatch Instruction
                  </label>
                  <div className="mt-1">
                    <TokenAutoTextarea
                      className="default-input w-full"
                      name="mismatchInstruction"
                      defaultValue={dataset.mismatchInstruction}
                      placeholder={datasetsConfig.defaultMismatchInstruction}
                      hideZero={true}
                    />
                  </div>
                  <p className="input-description">
                    Provide optional instruction to use when no suitable dataset
                    records are found. We will use the default instruction if
                    not specified.
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
                      defaultValue={dataset.visibility}
                    >
                      {Object.entries(DatasetVisibility).map(([key, value]) => (
                        <option key={key} value={key}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="input-description">
                    Private datasets are only accessible by the owner. Protected
                    datasets are accessible by the owner and all child Users.
                    Public datasets are accessible by all users of the platform.
                  </p>
                </div>
                {/* meta */}
                <div>
                  <label className="default-label" htmlFor="meta">
                    Meta
                  </label>
                  <div className="mt-1">
                    <MetaInput name="meta" defaultMeta={dataset.meta} />
                  </div>
                  <p className="input-description">
                    Custom metadata for this dataset.
                  </p>
                </div>
              </Expando>
              {/* hub options */}
              {dataset?.id ? (
                <HubOptions type="dataset" instance={dataset} />
              ) : null}
            </div>
          </div>
        </div>
        {/* actions */}
        <div>
          <div className="action-area">
            {/* <BackLink className="default-button" href="/datasets">
              Back To Datasets
            </BackLink> */}
            {dataset.id ? (
              <button
                className="danger-button"
                type="button"
                onClick={handleDelete}
              >
                Delete
              </button>
            ) : null}
            {dataset.id ? (
              <Link
                className="default-button"
                href={`/datasets/${dataset.id}/records/new`}
              >
                Create Record
              </Link>
            ) : null}
            <span className="action-area-space" />
            <button type="submit" className="primary-button">
              {dataset.id ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </form>
    </>
  )
}

export function Integrations({ dataset }) {
  const integrations = useMemo(() => {
    return Object.keys(dataset)
      .filter((k) => k.endsWith('Integrations'))
      .filter((k) => dataset[k].length > 0)
      .flatMap((key) => {
        const type = key.replace(/Integrations$/, '')

        return dataset[key].map((integration) => {
          return {
            ...integration,

            type,
          }
        })
      })

    // @note we want to run this only once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resource = useMemo(
    () => ({ type: 'dataset', id: dataset.id }),
    [dataset.id]
  )

  return (
    <>
      <IntegrationList integrations={integrations} resource={resource} />
    </>
  )
}

export function Bots({ dataset }) {
  const [bots, setBots] = useState(dataset.bots || [])

  const confirm = useConfirm()

  const { popup, openPopup, closePopup, setDisabled } = usePopup()

  const { fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  async function handleLink({ botId }) {
    if (!botId) {
      return
    }

    setDisabled(true)

    try {
      const { error } = await fetch(`/api/v1/bot/${botId}/update`, {
        data: {
          datasetId: dataset.id,
        },

        successMessage: 'Bot linked to dataset.',
      })

      if (error) {
        return
      }

      // @note refetch the bot so we can display it in the list below

      const { data: bot } = await fetch(`/api/v1/bot/${botId}/fetch`)

      setBots((bots) => [
        bot || { id: botId },
        ...bots.filter(({ id }) => id !== botId),
      ])

      closePopup()
    } finally {
      setDisabled(false)
    }
  }

  function handleLinkClick() {
    openPopup(
      <div className="space-y-4">
        <p className="text-sm">
          Select the bot you want to link to this dataset.
        </p>
        <BotSelect
          className="default-input w-full"
          name="botId"
          refLink={false}
        />
      </div>,
      {
        closePopupOnClickOutside: true,
        title: 'Link Bot',
        actions: {
          Link: {
            default: true,

            fn: handleLink,
          },
        },
      }
    )
  }

  const single = bots.length === 1

  async function handleUnlinkClick() {
    const confirmed = await confirm(
      single
        ? 'Do you really want to unlink this bot from the dataset?'
        : 'Do you really want to unlink these bots from the dataset?',
      {
        title: single ? 'Unlink Bot' : 'Unlink Bots',

        actions: {
          Unlink: { result: true, danger: true },
        },
      }
    )

    if (!confirmed) {
      return
    }

    const results = await Promise.all(
      bots.map(({ id }) => {
        return fetch(`/api/v1/bot/${id}/update`, {
          data: {
            datasetId: null,
          },

          successMessage: 'Bot unlinked from dataset.',
        })
      })
    )

    // @note keep the bots we failed to unlink

    const failed = bots.filter((bot, index) => results[index].error)

    setBots(failed)
  }

  return (
    <>
      {popup}
      <BotList
        items={bots}
        setItems={setBots}
        exportRoute={null}
        deleteRoute={null}
        filter={false}
        quickAccess={true}
        trailingActions={
          bots.length ? (
            <button
              className="text-sm default-link"
              type="button"
              onClick={handleUnlinkClick}
            >
              {single ? 'Unlink bot' : 'Unlink bots'}
            </button>
          ) : (
            <button
              className="text-sm default-link"
              type="button"
              onClick={handleLinkClick}
            >
              Link bot
            </button>
          )
        }
      />
    </>
  )
}

export function Chat({ dataset, disabled }) {
  const instance = useMemo(() => {
    return {
      backstory: `${datasetsConfig.defaultTestBackstory}\n\nDataset Name: ${dataset.name}\nDataset Description: ${dataset.description}`,

      model: datasetsConfig.defaultTestModel,

      datasetId: dataset.id,
    }
  }, [dataset.id, dataset.name, dataset.description])

  return (
    <div className="space-y-6">
      <ConversationManager
        instance={instance}
        autoStart={true}
        autoAddBackstory={false}
        advancedOptions={false}
        stream={true}
        verbose={true}
        conversationLink={true}
        situationLink={true}
        disabled={disabled}
      />
      <Expando titleClassName="default-link text-sm" title="Chat Configuration">
        <p className="mb-2 text-sm text-gray-500">
          This chat instance is using the following configuration:
        </p>
        <ObjectView className="text-xs" object={instance} />
      </Expando>
    </div>
  )
}

export function Records({ dataset }) {
  return (
    <DatasetRecordList
      datasetId={dataset.id}
      defaultItems={dataset.records}
      defaultCursor={dataset.cursor || null}
      defaultTotalCount={dataset?._count?.records ?? null}
      defaultHasMore={!!dataset.cursor}
      recordMaxTokens={dataset.recordMaxTokens || defaultRecordMaxTokens}
    />
  )
}

function getDatasetSetupSections(datasetId, apiBase = getExternalAPIHostURL('/v1')) {
  return {
    sdk: {
      title: 'Node SDK',
      instructions: [
        'Initialize the SDK with your API secret.',
        'Create records with dataset.record.create to add text directly.',
        'For files, create and upload a file, then attach and sync it to the dataset.',
        'Search the dataset to verify the newly added content is retrievable.',
      ],
      code: {
        language: 'javascript',
        content: `import { ChatBotKit } from '@chatbotkit/sdk'

const client = new ChatBotKit({
  secret: process.env.CHATBOTKIT_API_SECRET,
})

const datasetId = '${datasetId}'

// Add a record directly
await client.dataset.record.create(datasetId, {
  text: 'Our refund policy allows returns within 30 days of purchase.',
})

// Add data from a file
const file = await client.file.create({})

await client.file.upload(file.id, {
  name: 'faq.txt',
  type: 'text/plain',
  data: Buffer.from('Business hours: Monday to Friday, 9am-5pm.'),
})

await client.dataset.file.attach(datasetId, file.id, {
  type: 'source',
})

await client.dataset.file.sync(datasetId, file.id, {})

// Search the dataset
const { records } = await client.dataset.search(
  datasetId,
  'what are your business hours?'
)

console.log(records)`,
      },
    },
    go: {
      title: 'Go SDK',
      instructions: [
        'Initialize the Go SDK client with your API secret.',
        'Create records with Dataset.Record.Create to add text directly.',
        'Attach and sync an existing uploaded file ID to import file content.',
        'Search the dataset with Dataset.Search to verify ingestion.',
      ],
      code: {
        language: 'go',
        content: `package main

import (
  "context"
  "fmt"
  "os"

  "github.com/chatbotkit/go-sdk/sdk"
  "github.com/chatbotkit/go-sdk/types"
)

func main() {
  ctx := context.Background()

  client := sdk.New(sdk.Options{
    Secret: os.Getenv("CHATBOTKIT_API_SECRET"),
  })

  datasetID := "${datasetId}"

  // Add a record directly
  _, err := client.Dataset.Record.Create(ctx, datasetID, types.DatasetRecordCreateRequest{
    Text: "Our refund policy allows returns within 30 days of purchase.",
  })
  if err != nil {
    panic(err)
  }

  // Add data from an already uploaded file
  // @note upload can be performed via REST API or dashboard, then reuse fileID here
  fileID := "your_uploaded_file_id"

  source := types.TypeSource
  _, err = client.Dataset.File.Attach(ctx, datasetID, fileID, types.DatasetFileAttachRequest{
    Type: &source,
  })
  if err != nil {
    panic(err)
  }

  _, err = client.Dataset.File.Sync(ctx, datasetID, fileID)
  if err != nil {
    panic(err)
  }

  // Search the dataset
  results, err := client.Dataset.Search(ctx, datasetID, types.DatasetSearchRequest{
    Text: "what are your business hours?",
  })
  if err != nil {
    panic(err)
  }

  fmt.Printf("Found %d records\\n", len(results.Records))
}`,
      },
    },
    api: {
      title: 'REST API',
      instructions: [
        'Use your API secret as a Bearer token in the Authorization header.',
        'Create records by posting text to the dataset record endpoint.',
        'For files, create a file, request upload details, upload bytes, then attach and sync.',
        'Search the dataset using the search endpoint to validate indexed content.',
      ],
      code: {
        language: 'bash',
        content: `# Required env vars:
# export CHATBOTKIT_API_SECRET="..."
# export DATASET_ID="${datasetId}"

API_BASE="${apiBase}"
AUTH_HEADER="Authorization: Bearer $CHATBOTKIT_API_SECRET"
JSON_HEADER="Content-Type: application/json"

# Add a record directly
curl -X POST "$API_BASE/dataset/$DATASET_ID/record/create" \\
  -H "$AUTH_HEADER" \\
  -H "$JSON_HEADER" \\
  -d '{
    "text": "Our support email is support@example.com"
  }'

# Add data from a file (create file -> upload -> attach -> sync)
CREATE_FILE_RESPONSE=$(curl -sS -X POST "$API_BASE/file/create" \\
  -H "$AUTH_HEADER" \\
  -H "$JSON_HEADER" \\
  -d '{"name":"faq.txt"}')

FILE_ID=$(echo "$CREATE_FILE_RESPONSE" | jq -r '.id')

UPLOAD_RESPONSE=$(curl -sS -X POST "$API_BASE/file/$FILE_ID/upload" \\
  -H "$AUTH_HEADER" \\
  -H "$JSON_HEADER" \\
  -d '{
    "file": {
      "name": "faq.txt",
      "type": "text/plain",
      "size": 44
    }
  }')

UPLOAD_URL=$(echo "$UPLOAD_RESPONSE" | jq -r '.uploadRequest.url')

echo 'Business hours: Monday to Friday, 9am-5pm.' > faq.txt
curl -X PUT "$UPLOAD_URL" --data-binary @faq.txt

curl -X POST "$API_BASE/dataset/$DATASET_ID/file/$FILE_ID/attach" \\
  -H "$AUTH_HEADER" \\
  -H "$JSON_HEADER" \\
  -d '{"type":"source"}'

curl -X POST "$API_BASE/dataset/$DATASET_ID/file/$FILE_ID/sync" \\
  -H "$AUTH_HEADER" \\
  -H "$JSON_HEADER" \\
  -d '{}'

# Search the dataset
curl -X POST "$API_BASE/dataset/$DATASET_ID/search" \\
  -H "$AUTH_HEADER" \\
  -H "$JSON_HEADER" \\
  -d '{
    "search": "what are your business hours?"
  }'`,
      },
    },
  }
}

export default function Index({ dataset }) {
  const getAPIURL = useExternalAPIURL()

  return (
    <>
      {/* <div className="main-page last">
        <NavHeader link="/datasets" caption="datasets" title="Dataset">
          <p>
            A dataset is a collection of information used to train your chatbot
            to recognize and respond to user input. For more information, please
            refer to the Datasets{' '}
            <DocsLink slug="datasets">documentation</DocsLink>.
          </p>
        </NavHeader>
      </div> */}
      <PageSections className="pt-12">
        <section data-page-section-title="Configuration"
          data-page-section-index="200"
        >
          <div className="main-page">
            <Form dataset={dataset} />
          </div>
        </section>
        {dataset.id ? (
          <section data-page-section-title="Bot">
            <div className="main-page">
              <Headline title="Dataset Bot">
                The bot which uses this dataset as its knowledge base.
              </Headline>
              <Bots dataset={dataset} />
            </div>
          </section>
        ) : null}
        {dataset.id ? (
          <section data-page-section-title="Files"
          data-page-section-index="100"
          >
            <div className="main-page">
              <Headline title="Dataset Files">
                Populate your dataset with your files.
              </Headline>
              <DatasetFiles dataset={dataset} />
            </div>
          </section>
        ) : null}
        {dataset.id ? (
          <section data-page-section-title="Integrations">
            <div className="main-page">
              <Headline title="Dataset Integrations">
                Make the most out of your dataset by connecting it to external
                apps and services.
              </Headline>
              <Integrations dataset={dataset} />
            </div>
          </section>
        ) : null}
        {dataset.id ? (
          <section data-page-section-title="Chat">
            <div className="main-page">
              <Headline title="Chat With This Dataset">
                {dataset.records.length ? (
                  <>
                This tool is provided for testing purposes only. For optimal
                    results, we recommend creating a custom chatbot or
                    integration with a tailored backstory.
                  </>
                ) : (
                  <>
                    You need at least a few records before you can start
                    chatting with your dataset. You can either create records
                    manually or use an{' '}
                    <Link className="default-link" href="/integrations">
                      integration
                    </Link>
                    .
                  </>
                )}{' '}
                You can also try out this dataset as a source in the{' '}
                <Link
                  className="default-link"
                  href="/apps/chat"
                >
                  Chat
                </Link>{' '}
                app.
              </Headline>
              <Chat key={dataset.id} dataset={dataset} />
            </div>
          </section>
        ) : null}
        {dataset.id ? (
          <section data-page-section-title="Search">
            <div className="main-page">
              <Headline title="Search This Dataset">
                Embark on a thrilling data adventure and unearth valuable
                insights.
              </Headline>
              <Records dataset={dataset} />
            </div>
          </section>
        ) : null}
        {/* {dataset.id ? (
          <section>
            <div className="main-page">
              <Headline title="Meta">
                Meta fields assigned to this dataset.
              </Headline>
              <MetaArea instance={dataset} />
            </div>
          </section>
        ) : null} */}
        {dataset.id ? (
          <PlatformExperienceOnly>
            <section data-page-section-title="SDK">
              <div className="main-page">
                <Headline title="Use This Dataset with SDK or API">
                  Add data to this dataset either as records or from files
                  using ChatBotKit SDKs and API endpoints.
                </Headline>
                <Expando
                  titleClassName="default-link text-sm"
                  title="Show Examples"
                >
                  <WebhookSetupSection.Multi
                    sections={getDatasetSetupSections(
                      dataset.id,
                      getAPIURL('/v1')
                    )}
                  />
                </Expando>
              </div>
            </section>
          </PlatformExperienceOnly>
        ) : null}
        {dataset.id ? (
          <section data-page-section-title="Events">
            <div className="main-page">
              <Headline title="Events">
                Keep tabs on your dataset events.
              </Headline>
              <EventLog
                eventTypes={VISIBLE_EVENT_TYPES}
                autoLoad={true}
                contextFilters={{ datasetId: dataset.id }}
                filter={false}
              />
            </div>
          </section>
        ) : null}
      </PageSections>
    </>
  )
}

Index.getLayout = function (children, { dataset }) {
  return (
    <Dashboard
      breadcrumbs={['Datasets', 'ChatBotKit']}
      title={dataset.name || dataset.id || 'New'}
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

  if (context.query.datasetId === 'new') {
    return {
      props: makeJsonSafe({
        dataset: {
          reranker: defaultRerankModel,

          recordMaxTokens: defaultRecordMaxTokens,

          searchMinScore: 0,
          searchMaxRecords: defaultMaxSearchRecords,
          searchMaxTokens: defaultMaxSearchRecords * defaultRecordMaxTokens,

          separators: ['\\n\\n', '\\n'].join(','),
        },
      }),
    }
  }

  const dataset = await prisma.dataset.findUnique({
    where: {
      id: context.query.datasetId,
    },

    include: {
      files: {
        select: {
          fileId: true,

          file: {
            select: {
              name: true,
            },
          },
        },
      },

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

  const { getStore } = await import('@/lib/store.types')

  const store = await getStore()

  const [recordsResult, recordCount] = await Promise.all([
    store.listRecords({ datasetId: dataset.id, limit: 10 }),
    store.countRecords({ datasetId: dataset.id }),
  ])

  dataset.records = recordsResult.records.map((record) => ({
    id: record.id,
    text: record.text,
    source: record.source,
    meta: record.meta,
    expiresAt: record.expiresAt,
  }))

  dataset.cursor = recordsResult.nextCursor || null

  dataset._count = { records: recordCount }

  return {
    props: makeJsonSafe({
      dataset: makeJsonSafe(dataset),
    }),
  }
}
