import '@xyflow/react/dist/style.css'

import {
  Children as ReactChildren,
  createContext,
  memo,
  useCallback,
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import {
  LuBot,
  LuDatabaseZap,
  LuKeyRound,
  LuListTodo,
  LuOrbit,
  LuPackage,
} from 'react-icons/lu'
import {
  RxDownload,
  RxGrid,
  RxGroup,
  RxLayout,
  RxMargin,
  RxReset,
} from 'react-icons/rx'

import { formatIntegrationInbox } from '@chatbotkit-dev/email'
import { ONE_DAY_IN_MILLISECONDS, formatDuration } from '@chatbotkit-dev/time'

import { apps as configApps } from '@/config/apps'
import { DEFAULT_LIMITS } from '@/config/execution'
import { defaultRerankModel } from '@/config/models'

import filesData from '@/data/files.yaml'
import spacesData from '@/data/spaces.yaml'

import examplesData from '@/examples/catalogue/blueprints.yaml'

import prisma from '@/prisma/client'

import { resolveAbilityTemplate } from '@/lib/ability.icon'
import { isText } from '@/lib/binary'
import {
  getReferenceFieldType,
  isReferenceFieldFor,
} from '@/lib/blueprint.fields'
import { isCuid } from '@/lib/cuid'
import { assert, warn } from '@/lib/debug'
import { getShortDescription } from '@/lib/description.parse'
import { isDevelopment, isProduction } from '@/lib/env'
import { getExternalAPIHost } from '@/lib/host'
import { toThemeAwareIcon } from '@/lib/icon.theme'
import {
  buildTemplateInstruction,
  isTemplateField,
  parseTemplateInstruction,
} from '@/lib/instruction.template.parse'
import { getInstructionType } from '@/lib/instruction.type'
import { items } from '@/lib/integration.items'
import { getPublicMeta } from '@/lib/meta'
import { isJsonFile, isYamlFile } from '@/lib/mime'
import { nameToType } from '@/lib/mime2'
import { parseLanguageModel } from '@/lib/model.utils'
import { nameToIcon } from '@/lib/name.icon'
import { shortFormat } from '@/lib/number'
import { equal, merge, omit, rename, revalue } from '@/lib/object'
import { encodePath } from '@/lib/path'
import { saveBlob } from '@/lib/save'
import { getSecretAuthenticationBlockReason } from '@/lib/secret.authenticate'
import { getSoftSession } from '@/lib/session.get'
import { buildSlackManifestInstallUrl } from '@/lib/slack.manifest'
import { topologicalSort } from '@/lib/sort'
import { getRandomId, toHeadingCase } from '@/lib/string'
import { makeJsonSafe } from '@/lib/struct'
import { getTemplate } from '@/lib/template'
import toast from '@/lib/toast'
import { isUuid } from '@/lib/uuid'
import {
  stringify as stringifyYaml,
  tryParse as tryParseYaml,
} from '@/lib/yaml'

import AutoTextarea from '@/components/AutoTextarea'
import BackstoryInput from '@/components/BackstoryInput'
import BotBlockTag from '@/components/BotBlockTag'
import Box from '@/components/Box'
import Children from '@/components/Children'
import CommaListSelect from '@/components/CommaListSelect'
import Confirm from '@/components/Confirm'
import { useConfirm } from '@/components/Confirm'
import {
  Folder as ContextFolder,
  Item as ContextItem,
  useContextSchema,
  useInputContext,
  useInputState,
} from '@/components/ContextInput'
import ConversationsButton from '@/components/ConversationsButton'
import CopyButton, { copyTextToClipboard } from '@/components/CopyButton'
import DailyChart from '@/components/DailyChart'
import DatasetFiles from '@/components/DatasetFiles'
import DaysSelect from '@/components/DaysSelect'
import DescriptionInput from '@/components/DescriptionInput'
import DurationSelect from '@/components/DurationSelect'
import DynamicIcon from '@/components/DynamicIcon'
import DynamicImage from '@/components/DynamicImage'
import EventLog from '@/components/EventLog'
import ExtractSchemaInput from '@/components/ExtractSchemaInput'
import FileDownloadButton from '@/components/FileDownloadButton'
import FileEditButton from '@/components/FileEditButton'
import FileUploadButton from '@/components/FileUploadButton'
import { GlobalRootPortal } from '@/components/GlobalRoot'
import InstructionInput from '@/components/InstructionInput'
import LanguageModelSelect from '@/components/LanguageModelSelect'
import Link from '@/components/Link'
import Meta from '@/components/Meta'
import MetaInput from '@/components/MetaInput'
import NameInput from '@/components/NameInput'
import NoRubberBand from '@/components/NoRubberBand'
import ObjectInput from '@/components/ObjectInput'
import Pagedown from '@/components/Pagedown'
import PolicyConfigInput from '@/components/PolicyConfigInput'
import Portal from '@/components/Portal'
import PortalConfigInput from '@/components/PortalConfigInput'
import ProfileBar from '@/components/ProfileBar'
import RefreshTimer from '@/components/RefreshTimer'
import RerankerModelSelect from '@/components/RerankerModelSelect'
import RevealTextarea from '@/components/RevealTextarea'
import ScheduleSelect from '@/components/ScheduleSelect'
import SchemaPanel, {
  SchemaPanelModeProvider,
  SchemaPanelPositionProvider,
  useSchemaPanelMode,
} from '@/components/SchemaPanel'
import SideWidget from '@/components/SideWidget'
import { useSkillBrowser } from '@/components/SkillBrowser'
import SkillsetAbilityTester from '@/components/SkillsetAbilityTester'
import SpaceSiteList from '@/components/SpaceSiteList'
import SpaceStorageList, {
  useSpaceFileActions,
} from '@/components/SpaceStorageList'
import Spinner from '@/components/Spinner'
import SuperTools, { useSuperTools } from '@/components/SuperTools'
import TimezoneSelect from '@/components/TimezoneSelect'
import TooltipButton from '@/components/TooltipButton'
import WidgetScript from '@/components/WidgetScript'

import useBotBlock from '@/hooks/useBotBlock'
import useCache from '@/hooks/useCache'
import useClipboardContainer from '@/hooks/useClipboardContainer'
import useComboKeybinding from '@/hooks/useComboKeyBinding'
import useDOMQuerySelector from '@/hooks/useDOMQuerySelector'
import useDebounce from '@/hooks/useDebounce'
import useDebouncedInput from '@/hooks/useDebouncedInput'
import useDropzone from '@/hooks/useDropzone'
import useExternalAPIURL from '@/hooks/useExternalAPIURL'
import useExtractIntegrationSeries from '@/hooks/useExtractIntegrationSeries'
import useFetch from '@/hooks/useFetch'
import useFunctionPacks from '@/hooks/useFunctionPacks'
import useFuzzySearch from '@/hooks/useFuzzySearch'
import useFuzzySearchFunction from '@/hooks/useFuzzySearchFunction'
import useHistory from '@/hooks/useHistory'
import useInitial from '@/hooks/useInitial'
import useMediaQuery from '@/hooks/useMediaQuery'
import usePartner from '@/hooks/usePartner'
import usePopup from '@/hooks/usePopup'
import usePostMessageHandler from '@/hooks/usePostMessageHandler'
import usePreventLeave from '@/hooks/usePreventLeave'
import useReadyNotification, {
  useReadyNotificationHandler,
} from '@/hooks/useReadyNotification'
import useRouter from '@/hooks/useRouter'
import useTeamSwitch from '@/hooks/useTeamSwitch'
import useTheme from '@/hooks/useTheme'
import useUserSwitch from '@/hooks/useUserSwitch'
import useWebMCP from '@/hooks/useWebMCP'

import { blueprintSchema as AbilityType } from '@/schemas/api/v1/ability'
import { blueprintSchema as AnamIntegrationType } from '@/schemas/api/v1/anamIntegration'
import { blueprintSchema as AvatarIntegrationType } from '@/schemas/api/v1/avatarIntegration'
import { blueprintSchema as BotType } from '@/schemas/api/v1/bot'
import { blueprintSchema as DatasetType } from '@/schemas/api/v1/dataset'
import { blueprintSchema as DiscordIntegrationType } from '@/schemas/api/v1/discordIntegration'
import { blueprintSchema as EmailIntegrationType } from '@/schemas/api/v1/emailIntegration'
import { blueprintSchema as ExtractIntegrationType } from '@/schemas/api/v1/extractIntegration'
import { blueprintSchema as FileType } from '@/schemas/api/v1/file'
import { blueprintSchema as GithubIntegrationType } from '@/schemas/api/v1/githubIntegration'
import { blueprintSchema as GooglechatIntegrationType } from '@/schemas/api/v1/googlechatIntegration'
import { blueprintSchema as InstagramIntegrationType } from '@/schemas/api/v1/instagramIntegration'
import { blueprintSchema as McpserverIntegrationType } from '@/schemas/api/v1/mcpserverIntegration'
import { blueprintSchema as MessengerIntegrationType } from '@/schemas/api/v1/messengerIntegration'
import { blueprintSchema as MicrosoftteamsIntegrationType } from '@/schemas/api/v1/microsoftteamsIntegration'
import { blueprintSchema as NotionIntegrationType } from '@/schemas/api/v1/notionIntegration'
import { blueprintSchema as OAuthConnectionType } from '@/schemas/api/v1/oAuthConnection'
import { blueprintSchema as PolicyType } from '@/schemas/api/v1/policy'
import { blueprintSchema as PortalType } from '@/schemas/api/v1/portal'
import { blueprintSchema as RecallIntegrationType } from '@/schemas/api/v1/recallIntegration'
import { blueprintSchema as SecretType } from '@/schemas/api/v1/secret'
import { blueprintSchema as SitemapIntegrationType } from '@/schemas/api/v1/sitemapIntegration'
import { blueprintSchema as SkillserverIntegrationType } from '@/schemas/api/v1/skillserverIntegration'
import { blueprintSchema as SkillsetType } from '@/schemas/api/v1/skillset'
import { blueprintSchema as SlackIntegrationType } from '@/schemas/api/v1/slackIntegration'
import { blueprintSchema as SpaceType } from '@/schemas/api/v1/space'
import { blueprintSchema as supportIntegrationType } from '@/schemas/api/v1/supportIntegration'
import { blueprintSchema as TaskType } from '@/schemas/api/v1/task'
import { blueprintSchema as TelegramIntegrationType } from '@/schemas/api/v1/telegramIntegration'
import { blueprintSchema as TriggerIntegrationType } from '@/schemas/api/v1/triggerIntegration'
import { blueprintSchema as TwilioIntegrationType } from '@/schemas/api/v1/twilioIntegration'
import { blueprintSchema as WhatsappIntegrationType } from '@/schemas/api/v1/whatsappIntegration'
import { blueprintSchema as WidgetIntegrationType } from '@/schemas/api/v1/widgetIntegration'

import { createClient } from '@/graphql/v1/client'
import McpIcon from '@/icons/brands/mcp.svg'
import WidgetIcon from '@/icons/widget.svg'

import useWidgetInstance from '@chatbotkit/react/hooks/useWidgetInstance'
import useWidgetInstanceFunctions from '@chatbotkit/react/hooks/useWidgetInstanceFunctions'
import dagre from '@dagrejs/dagre'
import { XMarkIcon } from '@heroicons/react/20/solid'
import {
  ArrowLeftIcon,
  ArrowUpRightIcon,
  DocumentDuplicateIcon,
  EllipsisHorizontalIcon,
  ExclamationTriangleIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline'
import {
  Background,
  BaseEdge,
  ConnectionLineType,
  ControlButton,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MiniMap,
  NodeResizer,
  Position,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  getSmoothStepPath,
  useConnection,
  useEdgesState,
  useNodeConnections,
  useNodesInitialized,
  useNodesState,
  useOnSelectionChange,
  useReactFlow,
  useUpdateNodeInternals,
} from '@xyflow/react'

import clsx from 'clsx'
import pluralize from 'pluralize'
import { zodToJsonSchema } from 'zod-to-json-schema'

// --- Deployment Config ---

// @note deployment values resolved server-side (getServerSideProps) that
// client components deep in the flow need - the email integration domain
// comes from the email module, which must not enter the client bundle.
// Provided at the Page level, consumed by the node configurators.
const DeploymentConfigContext = createContext({ emailIntegrationDomain: '' })

// --- Events ---

export const VISIBLE_EVENT_TYPES = [
  // @note whitelist only specific events if applicable
]

// --- Constants ---

export const BLUEPRINT_STARTER_EXAMPLE_SLUG = 'blueprint-starter'

export const DEFAULT_BASEBOX_WIDTH = 340
export const DEFAULT_BASEBOX_HEIGHT = 140

export const DEFAULT_ICONBOX_WIDTH = 180
export const DEFAULT_ICONBOX_HEIGHT = 180

export const DEFAULT_VERTICALBOX_WIDTH = 180
export const DEFAULT_VERTICALBOX_HEIGHT = 280

export const DEFAULT_PORTALBOX_WIDTH = 180
export const DEFAULT_PORTALBOX_HEIGHT = 180

export const DEFAULT_FRAME_WIDTH = 360
export const DEFAULT_FRAME_HEIGHT = 220

export const DEFAULT_TOOL_WIDTH = 280
export const DEFAULT_TOOL_HEIGHT = 200

// @note minimum zoom used specifically when fitting the whole blueprint into
// view. React Flow clamps the fit zoom to the flow's interactive `minZoom`
// (default 0.2), which means large blueprints - especially ones with notes,
// frames or images placed away from the core graph - can't zoom out far
// enough to fit, leaving those annotations outside the viewport, clipped. We
// let the fit go well below the interactive floor so everything is framed.
export const FIT_VIEW_MIN_ZOOM = 0.05

// @note mode for public-facing blueprint previews where no authenticated API calls should be made
export const MODE_PUBLIC_PREVIEW = 'publicPreview'

// @note maximum number of history entries for undo/redo functionality
export const MAX_HISTORY_LENGTH = 50

// @note snap grid size matches React Flow's default internal grid size when snapToGrid is enabled
export const SNAP_GRID_SIZE = 15

const ERROR_LOG_TOOL_RESOURCE_HANDLE_PREFIX = 'errorLogResource:'
const ERROR_LOG_TOOL_RESOURCE_DATA_KEY = 'resources'

const ERROR_LOG_TOOL_RESOURCE_TYPES = [
  'bot',
  'dataset',
  'skillset',
  'widgetIntegration',
  'slackIntegration',
  'discordIntegration',
  'microsoftteamsIntegration',
  'googlechatIntegration',
  'whatsappIntegration',
  'messengerIntegration',
  'telegramIntegration',
  'twilioIntegration',
  'emailIntegration',
  'sitemapIntegration',
  'notionIntegration',
  'triggerIntegration',
  'supportIntegration',
  'extractIntegration',
  'mcpserverIntegration',
  'skillserverIntegration',
]

// --- Icons ---

/**
 *
 */
export function ThinBotMessageSquareIcon(props) {
  return <LuBot {...props} strokeWidth={1.5} />
}

/**
 *
 */
export function ThinPackageIcon(props) {
  return <LuPackage {...props} strokeWidth={1.5} />
}

/**
 *
 */
export function ThinDatabaseZapIcon(props) {
  return <LuDatabaseZap {...props} strokeWidth={1.5} />
}

/**
 *
 */
export function ThinOrbitIcon(props) {
  return <LuOrbit {...props} strokeWidth={1.5} />
}

/**
 *
 */
export function ThinKeyRoundIcon(props) {
  return <LuKeyRound {...props} strokeWidth={1.5} />
}

/**
 *
 */
export function ThinListTodoIcon(props) {
  return <LuListTodo {...props} strokeWidth={1.5} />
}

// --- Grid and Snapping ---

/**
 * Snaps a coordinate value to the nearest grid point.
 *
 * @param {number} value - The coordinate value to snap
 * @param {number} [gridSize=SNAP_GRID_SIZE] - The grid size to snap to
 * @returns {number} The snapped coordinate value
 */
function snapToGridCoordinate(value, gridSize = SNAP_GRID_SIZE) {
  return Math.round(value / gridSize) * gridSize
}

/**
 * Snaps a position object to the grid.
 *
 * @param {{x: number, y: number}} position - The position to snap
 * @param {number} [gridSize=SNAP_GRID_SIZE] - The grid size to snap to
 * @returns {{x: number, y: number}} The snapped position
 */
function snapPositionToGrid(position, gridSize = SNAP_GRID_SIZE) {
  return {
    x: snapToGridCoordinate(position.x, gridSize),
    y: snapToGridCoordinate(position.y, gridSize),
  }
}

// --- Collection Utilities ---

/**
 * Used to get the collection name for a given type.
 */
function getCollection(type) {
  return pluralize(type, 2)
}

// --- Node Type Utilities ---

function isAnnotationNodeType(type) {
  return type === 'note' || type === 'image' || type === 'frame'
}

function isToolNodeType(type) {
  return type?.startsWith('tool:')
}

function isNonResourceNodeType(type) {
  return isAnnotationNodeType(type) || isToolNodeType(type)
}

function isErrorLogToolResourceHandle(handleId) {
  return handleId?.startsWith(ERROR_LOG_TOOL_RESOURCE_HANDLE_PREFIX)
}

function isErrorLogToolResourceType(type) {
  return ERROR_LOG_TOOL_RESOURCE_TYPES.includes(type)
}

function getErrorLogToolResourceEntries(data = {}) {
  const resources = Array.isArray(data?.[ERROR_LOG_TOOL_RESOURCE_DATA_KEY])
    ? data[ERROR_LOG_TOOL_RESOURCE_DATA_KEY]
    : []

  return resources
    .map((resource, index) => ({
      key: ERROR_LOG_TOOL_RESOURCE_DATA_KEY,
      value: resource?.id,
      sourceHandle: `${ERROR_LOG_TOOL_RESOURCE_HANDLE_PREFIX}${index}`,
      targetHandle: resource?.type,
    }))
    .filter(
      ({ value, targetHandle }) =>
        typeof value === 'string' &&
        value &&
        isErrorLogToolResourceType(targetHandle)
    )
}

function normalizeErrorLogToolConnectionEdge(edge, getNode) {
  if (getNode(edge.source)?.type === 'tool:errorLog') {
    return edge
  }

  if (
    getNode(edge.target)?.type === 'tool:errorLog' &&
    isErrorLogToolResourceHandle(edge.targetHandle) &&
    isErrorLogToolResourceType(edge.sourceHandle)
  ) {
    return {
      ...edge,
      source: edge.target,
      sourceHandle: edge.targetHandle,
      target: edge.source,
      targetHandle: edge.sourceHandle,
    }
  }

  return edge
}

function isValidErrorLogToolConnection({
  sourceHandle,
  sourceNodeType,
  targetHandle,
  targetNodeType,
}) {
  if (
    sourceNodeType === 'tool:errorLog' &&
    isErrorLogToolResourceHandle(sourceHandle)
  ) {
    return (
      isErrorLogToolResourceType(targetHandle) &&
      targetNodeType === targetHandle
    )
  }

  if (
    targetNodeType === 'tool:errorLog' &&
    isErrorLogToolResourceHandle(targetHandle)
  ) {
    return (
      isErrorLogToolResourceType(sourceHandle) &&
      sourceNodeType === sourceHandle
    )
  }

  return null
}

export function getFilteredDanglingResources(resources, filter = () => true) {
  return Object.entries(resources)
    .flatMap(([type, rs]) => rs.map((resource) => [type, resource]))
    .filter(filter)
}

// --- Format Components ---

/**
 * Determines whether a resource ID field points at the blueprint graph, an
 * external platform resource, or an invalid value.
 *
 * @param {unknown} value
 * @param {Array<{id: string}>} nodes
 * @returns {'empty' | 'connected' | 'valid' | 'orphan'}
 */
export function getResourceIdConnectionStatus(value, nodes = []) {
  const normalizedValue = typeof value === 'string' ? value.trim() : value

  if (!normalizedValue || typeof normalizedValue !== 'string') {
    return 'empty'
  }

  if (
    normalizedValue.startsWith('@') ||
    (normalizedValue.startsWith('(') && normalizedValue.endsWith(')'))
  ) {
    return 'empty'
  }

  if (normalizedValue.startsWith('#')) {
    const nodeExists = nodes.some((node) => node.id === normalizedValue)

    return nodeExists ? 'connected' : 'orphan'
  }

  return isCuid(normalizedValue) || isUuid(normalizedValue) ? 'valid' : 'orphan'
}

/**
 * Format component for resource ID fields in ability instruction parameters.
 * Shows visual connection status for blueprint-local resource references:
 * - Blue/violet ring: Field is connected to an existing node
 * - Red ring: Field points to a non-existent blueprint-local resource or
 *   is not shaped like a valid external resource ID
 * - Normal: Field is empty or references an external/dynamic resource
 */
export function ResourceIdFormatComponent({
  schema,

  label = schema.title,

  name,
  description,

  defaultValue: _defaultValue = '',
  value: _value,
  setValue: _setValue,

  defaultDisabled,
  disabled,
  setDisabled,

  placeholder,

  optional,

  className,
  inputClassName: _inputClassName,

  children,

  ...props
}) {
  const { getNodes } = useReactFlow()

  const state = useInputState({
    name,
    defaultValue: _defaultValue,
    value: _value,
    setValue: _setValue,
    defaultDisabled,
    disabled,
    setDisabled,
    optional,
  })

  const { inputClassName } = useContextSchema()

  // Determine connection status

  const connectionStatus = useMemo(() => {
    return getResourceIdConnectionStatus(state.value, getNodes())
  }, [state.value, getNodes])

  return (
    <ContextItem
      {...props}
      className={clsx(
        'break-all hyphens-auto', // the space is small so we need to break everything
        className
      )}
      label={label}
      name={name}
      description={description}
      state={state}
    >
      <input
        type="text"
        className={clsx(
          'w-full',
          inputClassName,
          _inputClassName,
          // Connection status styling - override default border and text color
          {
            '!border-violet-500 !ring-violet-500 !text-violet-600 dark:!text-violet-400':
              connectionStatus === 'connected' || connectionStatus === 'valid',
            '!border-red-500 !ring-red-500 !text-red-600 dark:!text-red-400':
              connectionStatus === 'orphan',
          }
        )}
        value={state.value || ''}
        onChange={(event) => state.setValue(event.target.value)}
        placeholder={placeholder}
        disabled={state.disabled}
        spellCheck={false}
      />
      {children}
    </ContextItem>
  )
}

/**
 *
 */
export function AutoTextareaFormatComponent({
  schema,

  label = schema.title,

  name,
  description,

  defaultValue: _defaultValue = '',
  value: _value,
  setValue: _setValue,

  defaultDisabled,
  disabled,
  setDisabled,

  placeholder,

  spellCheck = true,

  optional,

  className,
  inputClassName: _inputClassName,

  children,

  ...props
}) {
  const state = useInputState({
    name,
    defaultValue: _defaultValue,
    value: _value,
    setValue: _setValue,
    defaultDisabled,
    disabled,
    setDisabled,
    optional,
  })

  const { inputClassName } = useContextSchema()

  return (
    <ContextItem
      {...props}
      className={clsx(
        'break-all hyphens-auto', // the space is small so we need to break everything
        className
      )}
      label={label}
      name={name}
      description={description}
      state={state}
    >
      <AutoTextarea
        className={clsx(
          'w-full !max-h-48 !overflow-auto',
          inputClassName,
          _inputClassName
        )}
        wrapperClassName="flex-1"
        value={state.value}
        onChange={(event) => state.setValue(event.target.value)}
        placeholder={placeholder}
        spellCheck={spellCheck}
        disabled={state.disabled}
      />
      {children}
    </ContextItem>
  )
}

/**
 *
 */
export function NameFormatComponent({
  schema,

  label = schema.title,

  name,
  description,

  defaultValue: _defaultValue = '',
  value: _value,
  setValue: _setValue,

  defaultDisabled,
  disabled,
  setDisabled,

  placeholder,

  spellCheck = true,

  optional,

  className,
  inputClassName: _inputClassName,

  children,

  ...props
}) {
  const state = useInputState({
    name,
    defaultValue: _defaultValue,
    value: _value,
    setValue: _setValue,
    defaultDisabled,
    disabled,
    setDisabled,
    optional,
  })

  const { inputClassName } = useContextSchema()

  return (
    <ContextItem
      {...props}
      className={clsx(
        'break-all hyphens-auto', // the space is small so we need to break everything
        className
      )}
      label={label}
      name={name}
      description={description}
      state={state}
    >
      <NameInput
        className={clsx(
          'w-full !max-h-48 !overflow-auto',
          inputClassName,
          _inputClassName
        )}
        // wrapperClassName="flex-1"
        value={state.value}
        onChange={(event) => state.setValue(event.target.value)}
        placeholder={placeholder}
        spellCheck={spellCheck}
        disabled={state.disabled}
      />
      {children}
    </ContextItem>
  )
}

/**
 *
 */
export function DescriptionFormatComponent({
  schema,

  label = schema.title,

  name,
  description,

  defaultValue: _defaultValue = '',
  value: _value,
  setValue: _setValue,

  defaultDisabled,
  disabled,
  setDisabled,

  placeholder,

  spellCheck = true,

  optional,

  className,
  inputClassName: _inputClassName,

  children,

  ...props
}) {
  const state = useInputState({
    name,
    defaultValue: _defaultValue,
    value: _value,
    setValue: _setValue,
    defaultDisabled,
    disabled,
    setDisabled,
    optional,
  })

  const { inputClassName } = useContextSchema()

  return (
    <ContextItem
      {...props}
      className={clsx(
        'break-all hyphens-auto', // the space is small so we need to break everything
        className
      )}
      label={label}
      name={name}
      description={description}
      state={state}
    >
      <DescriptionInput
        className={clsx(
          'w-full !max-h-48 !overflow-auto',
          inputClassName,
          _inputClassName
        )}
        wrapperClassName="flex-1"
        value={state.value}
        onChange={(event) => state.setValue(event.target.value)}
        placeholder={placeholder}
        spellCheck={spellCheck}
        disabled={state.disabled}
      />
      {children}
    </ContextItem>
  )
}

/**
 *
 */
export function CommaListFormatComponent({
  schema,

  label = schema.title,

  name,
  description,

  defaultValue: _defaultValue,
  value: _value,
  setValue: _setValue,

  defaultDisabled,
  disabled,
  setDisabled,

  optional,

  className,
  inputClassName: _inputClassName,

  children,

  ...props
}) {
  const state = useInputState({
    name,
    defaultValue: _defaultValue,
    value: _value,
    setValue: _setValue,
    defaultDisabled,
    disabled,
    setDisabled,
    optional,
  })

  const { inputClassName } = useContextSchema()

  return (
    <ContextItem
      {...props}
      className={clsx(className)}
      label={label}
      name={name}
      description={description}
      state={state}
    >
      <CommaListSelect
        className={clsx('w-full', inputClassName, _inputClassName)}
        wrapperClassName="flex-1"
        value={state.value}
        setValue={state.setValue}
        disabled={state.disabled}
      />
      {children}
    </ContextItem>
  )
}

/**
 *
 */
export function ObjectFormatComponent({
  schema,

  label = schema.title,

  name,
  description,

  defaultValue: _defaultValue,
  value: _value,
  setValue: _setValue,

  defaultDisabled,
  disabled,
  setDisabled,

  optional,

  className,

  inputClassName: _inputClassName,

  children,

  ...props
}) {
  const state = useInputState({
    name,
    defaultValue: _defaultValue,
    value: _value,
    setValue: _setValue,
    defaultDisabled,
    disabled,
    setDisabled,
    optional,
  })

  const { inputClassName } = useContextSchema()

  return (
    <ContextItem
      {...props}
      className={clsx(
        'break-all', // the space is small so we need to break everything
        className
      )}
      label={label}
      name={name}
      description={description}
      state={state}
    >
      <ObjectInput
        className={clsx(
          'w-full !max-h-48 !overflow-auto',
          inputClassName,
          _inputClassName
        )}
        wrapperClassName="flex-1"
        object={state.value}
        setObject={state.setValue}
        placeholder={schema.description}
        disabled={state.disabled}
      />
      {children}
    </ContextItem>
  )
}

/**
 *
 */
export function DurationSelectFormatComponent({
  schema,

  label = schema.title,

  name,
  description,

  defaultValue: _defaultValue = null,
  value: _value,
  setValue: _setValue,

  defaultDisabled,
  disabled,
  setDisabled,

  optional,

  className,
  inputClassName: _inputClassName,

  children,

  ...props
}) {
  const state = useInputState({
    name,
    defaultValue: _defaultValue,
    value: _value,
    setValue: _setValue,
    defaultDisabled,
    disabled,
    setDisabled,
    optional,
  })

  const { inputClassName } = useContextSchema()

  return (
    <ContextItem
      {...props}
      className={clsx(className)}
      label={label}
      name={name}
      description={description}
      state={state}
    >
      <DurationSelect
        className={clsx('w-full', inputClassName, _inputClassName)}
        // wrapperClassName="flex-1"
        nullable
        // @note the caption and unit options default to the session-reuse set;
        // a field may override them via its schema (see typeKey2PropertiesMap)
        defaultCaption={schema.defaultCaption ?? '1 day (default)'}
        maximum={schema.maximum}
        allowNoSession={schema.allowNoSession}
        {...(schema.minutesOptions
          ? { minutesOptions: schema.minutesOptions }
          : {})}
        value={state.value ?? ''}
        // @note "automatic" submits an empty value; store it as null (not "")
        // so it resolves to the auto default and passes number/null validation
        // when the blueprint is applied. "no session" submits 0.
        onChange={(event) => {
          const value = event.target.value

          state.setValue(value === '' ? null : Number(value))
        }}
        disabled={state.disabled}
      />
      {children}
    </ContextItem>
  )
}

/**
 *
 */
export function DaysSelectFormatComponent({
  schema,

  label = schema.title,

  name,
  description,

  defaultValue: _defaultValue = 0,
  value: _value,
  setValue: _setValue,

  defaultDisabled,
  disabled,
  setDisabled,

  optional,

  className,
  inputClassName: _inputClassName,

  children,

  ...props
}) {
  const state = useInputState({
    name,
    defaultValue: _defaultValue,
    value: _value,
    setValue: _setValue,
    defaultDisabled,
    disabled,
    setDisabled,
    optional,
  })

  const { inputClassName } = useContextSchema()

  return (
    <ContextItem
      {...props}
      className={clsx(className)}
      label={label}
      name={name}
      description={description}
      state={state}
    >
      <DaysSelect
        className={clsx('w-full', inputClassName, _inputClassName)}
        wrapperClassName="flex-1"
        value={state.value}
        onChange={(event) => state.setValue(event.target.value)}
        disabled={state.disabled}
      />
      {children}
    </ContextItem>
  )
}

/**
 *
 */
export function ScheduleSelectFormatComponent({
  schema,

  label = schema.title,

  name,
  description,

  defaultValue: _defaultValue = 'never',
  value: _value,
  setValue: _setValue,

  defaultDisabled,
  disabled,
  setDisabled,

  optional,

  className,
  inputClassName: _inputClassName,

  children,

  ...props
}) {
  const state = useInputState({
    name,
    defaultValue: _defaultValue,
    value: _value,
    setValue: _setValue,
    defaultDisabled,
    disabled,
    setDisabled,
    optional,
  })

  const { inputClassName } = useContextSchema()

  return (
    <ContextItem
      {...props}
      className={clsx(className)}
      label={label}
      name={name}
      description={description}
      state={state}
    >
      <ScheduleSelect
        className={clsx('w-full', inputClassName, _inputClassName)}
        wrapperClassName="flex-1"
        value={state.value}
        setValue={state.setValue}
        allowCustom={true}
        disabled={state.disabled}
      />
      {children}
    </ContextItem>
  )
}

/**
 *
 */
export function TimezoneSelectFormatComponent({
  schema,

  label = schema.title,

  name,
  description,

  defaultValue: _defaultValue,
  value: _value,
  setValue: _setValue,

  defaultDisabled,
  disabled,
  setDisabled,

  optional,

  className,
  inputClassName: _inputClassName,

  children,

  ...props
}) {
  const state = useInputState({
    name,
    defaultValue: _defaultValue,
    value: _value,
    setValue: _setValue,
    defaultDisabled,
    disabled,
    setDisabled,
    optional,
  })

  const { inputClassName } = useContextSchema()

  return (
    <ContextItem
      {...props}
      className={clsx(className)}
      label={label}
      name={name}
      description={description}
      state={state}
    >
      <TimezoneSelect
        className={clsx('w-full', inputClassName, _inputClassName)}
        wrapperClassName="flex-1"
        value={state.value}
        setValue={state.setValue}
        disabled={state.disabled}
      />
      {children}
    </ContextItem>
  )
}

/**
 *
 */
export function BackstoryFormatComponent({
  schema,

  label = schema.title,

  name,
  description,

  defaultValue: _defaultValue = '',
  value: _value,
  setValue: _setValue,

  defaultDisabled,
  disabled,
  setDisabled,

  placeholder,

  spellCheck = true,

  optional,

  className,
  inputClassName: _inputClassName,

  children,

  ...props
}) {
  const state = useInputState({
    name,
    defaultValue: _defaultValue,
    value: _value,
    setValue: _setValue,
    defaultDisabled,
    disabled,
    setDisabled,
    optional,
  })

  const { inputClassName } = useContextSchema()

  return (
    <ContextItem
      {...props}
      className={clsx(
        'break-all hyphens-auto', // the space is small so we need to break everything
        className
      )}
      label={label}
      name={name}
      description={description}
      state={state}
    >
      <BackstoryInput
        className={clsx(
          'w-full !max-h-48 !overflow-auto',
          inputClassName,
          _inputClassName
        )}
        wrapperClassName="flex-1"
        value={state.value}
        onChange={(event) => state.setValue(event.target.value)}
        placeholder={placeholder}
        spellCheck={spellCheck}
        disabled={state.disabled}
      />
      {children}
    </ContextItem>
  )
}

/**
 *
 */
export function InstructionFormatComponent({
  schema,

  label = schema.title,

  name,
  description,

  defaultValue: _defaultValue,
  value: _value,
  setValue: _setValue,

  defaultDisabled,
  disabled,
  setDisabled,

  placeholder,

  spellCheck = false,

  optional,

  className,
  inputClassName: _inputClassName,

  children,

  ...props
}) {
  const state = useInputState({
    name,
    defaultValue: _defaultValue,
    value: _value,
    setValue: _setValue,
    defaultDisabled,
    disabled,
    setDisabled,
    optional,
    debounce: 100, // @note without debounce the UI will be slow
  })

  const { inputClassName } = useContextSchema()

  return (
    <ContextItem
      {...props}
      className={clsx(
        'break-all', // the space is small so we need to break everything
        className
      )}
      label={label}
      name={name}
      description={description}
      state={state}
    >
      <InstructionInput
        className={clsx(
          'w-full !max-h-48 !overflow-auto',
          inputClassName,
          _inputClassName
        )}
        wrapperClassName={clsx('flex-1', '[&_.tooltip]:!tooltip-above')}
        value={state.value}
        setValue={state.setValue}
        placeholder={placeholder}
        spellCheck={spellCheck}
        disabled={state.disabled}
        instructionInfo={true}
        placeholderInfo={false}
        secretsInfo={false}
        errorsInfo={false}
        fieldsInfo={false}
        actionsInfo={false}
      />
      {children}
    </ContextItem>
  )
}

/**
 * Collapsible format component for editing meta object properties.
 */
export function MetaFormatComponent({
  schema,

  label = schema.title,

  name,
  description,

  defaultValue: _defaultValue,
  value: _value,
  setValue: _setValue,

  defaultDisabled,
  disabled,
  setDisabled,

  optional,

  className,

  inputClassName: _inputClassName,

  children,

  ...props
}) {
  const state = useInputState({
    name,
    defaultValue: _defaultValue,
    value: _value,
    setValue: _setValue,
    defaultDisabled,
    disabled,
    setDisabled,
    optional,
  })

  const { inputClassName } = useContextSchema()

  return (
    <ContextFolder
      {...props}
      className={clsx(className)}
      label={label}
      name={name}
      description={description}
      state={state}
      defaultOpen={false}
    >
      <MetaInput
        className={clsx(
          'w-full !max-h-48 !overflow-auto',
          inputClassName,
          _inputClassName
        )}
        wrapperClassName="flex-1"
        meta={state.value}
        setMeta={state.setValue}
        placeholder={schema.description || 'Metadata (YAML or JSON)'}
        disabled={state.disabled}
      />
      {children}
    </ContextFolder>
  )
}

/**
 *
 */
export function ModelFormatComponent({
  schema,

  label = schema.title,

  name,
  description,

  defaultValue: _defaultValue,
  value: _value,
  setValue: _setValue,

  defaultDisabled,
  disabled,
  setDisabled,

  optional,

  className,
  inputClassName: _inputClassName,

  children,

  ...props
}) {
  const state = useInputState({
    name,
    defaultValue: _defaultValue,
    value: _value,
    setValue: _setValue,
    defaultDisabled,
    disabled,
    setDisabled,
    optional,
  })

  const { inputClassName } = useContextSchema()

  return (
    <ContextItem
      {...props}
      className={clsx(className)}
      label={label}
      name={name}
      description={description}
      state={state}
    >
      <LanguageModelSelect
        className={clsx('w-full', inputClassName, _inputClassName)}
        wrapperClassName="flex-1"
        value={state.value}
        setValue={state.setValue}
        disabled={state.disabled}
      />
      {children}
    </ContextItem>
  )
}

/**
 *
 */
export function DatasetRerankerSelectFormatComponent({
  schema,

  label = schema.title,

  name,
  description,

  defaultValue: _defaultValue = defaultRerankModel,
  value: _value,
  setValue: _setValue,

  defaultDisabled,
  disabled,
  setDisabled,

  optional,

  className,
  inputClassName: _inputClassName,

  children,

  ...props
}) {
  const state = useInputState({
    name,
    defaultValue: _defaultValue,
    value: _value,
    setValue: _setValue,
    defaultDisabled,
    disabled,
    setDisabled,
    optional,
  })

  const { inputClassName } = useContextSchema()

  return (
    <ContextItem
      {...props}
      className={clsx(className)}
      label={label}
      name={name}
      description={description}
      state={state}
    >
      <RerankerModelSelect
        className={clsx('w-full', inputClassName, _inputClassName)}
        wrapperClassName="flex-1"
        value={state.value}
        setValue={state.setValue}
        disabled={state.disabled}
      />
      {children}
    </ContextItem>
  )
}

/**
 *
 */
export function SecretValueFormatComponent({
  schema,

  label = schema.title,

  name,
  description,

  defaultValue: _defaultValue = '',
  value: _value,
  setValue: _setValue,

  defaultDisabled,
  disabled,
  setDisabled,

  placeholder,

  optional,

  className,
  inputClassName: _inputClassName,

  children,

  ...props
}) {
  const state = useInputState({
    name,
    defaultValue: _defaultValue,
    value: _value,
    setValue: _setValue,
    defaultDisabled,
    disabled,
    setDisabled,
    optional,
  })

  const { inputClassName } = useContextSchema()

  return (
    <ContextItem
      {...props}
      className={clsx(
        'break-all hyphens-auto', // the space is small so we need to break everything
        className
      )}
      label={label}
      name={name}
      description={description}
      state={state}
    >
      <RevealTextarea
        className={clsx(
          'w-full !max-h-48 !overflow-auto not-focus:max-h-8 [&:not(:focus)]:gradient-mask-b-10',
          inputClassName,
          _inputClassName
        )}
        wrapperClassName="flex-1"
        token={state.value}
        setToken={state.setValue}
        placeholder={placeholder}
        disabled={state.disabled}
      />
      {children}
    </ContextItem>
  )
}

/**
 *
 */
export function RevealTextareaFormatComponent({
  schema,

  label = schema.title,

  name,
  description,

  defaultValue: _defaultValue = '',
  value: _value,
  setValue: _setValue,

  defaultDisabled,
  disabled,
  setDisabled,

  placeholder,

  optional,

  className,
  inputClassName: _inputClassName,

  children,

  ...props
}) {
  const state = useInputState({
    name,
    defaultValue: _defaultValue,
    value: _value,
    setValue: _setValue,
    defaultDisabled,
    disabled,
    setDisabled,
    optional,
  })

  const { inputClassName } = useContextSchema()

  return (
    <ContextItem
      {...props}
      className={clsx(
        'break-all hyphens-auto', // the space is small so we need to break everything
        className
      )}
      label={label}
      name={name}
      description={description}
      state={state}
    >
      <RevealTextarea
        className={clsx(
          'w-full !max-h-48 !overflow-auto not-focus:max-h-8 [&:not(:focus)]:gradient-mask-b-10',
          inputClassName,
          _inputClassName
        )}
        wrapperClassName="flex-1"
        token={state.value}
        setToken={state.setValue}
        placeholder={placeholder}
        disabled={state.disabled}
      />
      {children}
    </ContextItem>
  )
}

/**
 *
 */
export function PortalConfigFormatComponent({
  schema,

  label = schema.title,

  name,
  description,

  defaultValue: _defaultValue,
  value: _value,
  setValue: _setValue,

  defaultDisabled,
  disabled,
  setDisabled,

  optional,

  className,

  inputClassName: _inputClassName,

  children,

  ...props
}) {
  const state = useInputState({
    name,
    defaultValue: _defaultValue,
    value: _value,
    setValue: _setValue,
    defaultDisabled,
    disabled,
    setDisabled,
    optional,
  })

  const { inputClassName } = useContextSchema()

  return (
    <ContextItem
      {...props}
      className={clsx(
        'break-all', // the space is small so we need to break everything
        className
      )}
      label={label}
      name={name}
      description={description}
      state={state}
    >
      <PortalConfigInput
        className={clsx('w-full !max-h-96 !overflow-auto')}
        tabsClassName={clsx(
          '[&_label]:!text-xs',
          '[&_input]:!text-xs [&_textarea]:!text-xs [&_select]:!text-xs',
          '[&_button]:!text-xs',
          '[&_span]:!text-xs [&_p]:!text-xs',
          '[&_h4]:!text-xs [&_h5]:!text-xs',
          '[&_.tab]:!text-xs',
          '[&_.text-sm]:!text-xs',
          inputClassName,
          _inputClassName
        )}
        wrapperClassName="flex-1"
        config={state.value}
        setConfig={state.setValue}
        placeholder={schema.description}
        disabled={state.disabled}
      />
      {children}
    </ContextItem>
  )
}

/**
 *
 */
export function PolicyConfigFormatComponent({
  schema,

  label = schema.title,

  name,
  description,

  defaultValue: _defaultValue,
  value: _value,
  setValue: _setValue,

  defaultDisabled,
  disabled,
  setDisabled,

  optional,

  className,

  inputClassName: _inputClassName,

  children,

  ...props
}) {
  const [context] = useInputContext()

  const state = useInputState({
    name,
    defaultValue: _defaultValue,
    value: _value,
    setValue: _setValue,
    defaultDisabled,
    disabled,
    setDisabled,
    optional,
  })

  const { inputClassName } = useContextSchema()

  return (
    <ContextItem
      {...props}
      className={clsx(
        'break-all', // the space is small so we need to break everything
        className
      )}
      label={label}
      name={name}
      description={description}
      state={state}
    >
      <PolicyConfigInput
        className={clsx('w-full !max-h-96 !overflow-auto')}
        tabsClassName={clsx(
          '[&_label]:!text-xs',
          '[&_input]:!text-xs [&_textarea]:!text-xs [&_select]:!text-xs',
          '[&_button]:!text-xs',
          '[&_span]:!text-xs [&_p]:!text-xs',
          '[&_h4]:!text-xs [&_h5]:!text-xs',
          '[&_.tab]:!text-xs',
          '[&_.text-sm]:!text-xs',
          inputClassName,
          _inputClassName
        )}
        inputClassName={clsx(inputClassName, _inputClassName)}
        wrapperClassName="flex-1"
        type={context?.type}
        config={state.value}
        setConfig={state.setValue}
        placeholder={schema.description}
        disabled={state.disabled}
      />
      {children}
    </ContextItem>
  )
}

/**
 *
 */
export function ExtractSchemaFormatComponent({
  schema,

  label = schema.title,

  name,
  description,

  defaultValue: _defaultValue,
  value: _value,
  setValue: _setValue,

  defaultDisabled,
  disabled,
  setDisabled,

  optional,

  className,

  inputClassName: _inputClassName,

  children,

  ...props
}) {
  const state = useInputState({
    name,
    defaultValue: _defaultValue,
    value: _value,
    setValue: _setValue,
    defaultDisabled,
    disabled,
    setDisabled,
    optional,
  })

  const { inputClassName } = useContextSchema()

  return (
    <ContextItem
      {...props}
      className={clsx(
        'break-all', // the space is small so we need to break everything
        className
      )}
      label={label}
      name={name}
      description={description}
      state={state}
    >
      <ExtractSchemaInput
        className={clsx(
          'w-full !max-h-48 !overflow-auto',
          inputClassName,
          _inputClassName
        )}
        wrapperClassName="flex-1"
        schema={state.value}
        setSchema={state.setValue}
        placeholder={schema.description}
        disabled={state.disabled}
      />
      {children}
    </ContextItem>
  )
}

// --- Warning Functions ---

/**
 * Pure warning functions. These contain the actual lint logic and return
 * structured warning objects. The corresponding hooks delegate to them so that
 * the same checks are reusable from non-hook contexts (e.g. the assistant
 * lint tool).
 */

/**
 * @param {string} description
 * @param {'suggestion' | 'warning'} [type='suggestion']
 * @returns {{description: string, type: 'suggestion' | 'warning'}}
 */
export function createWarning(description, type = 'suggestion') {
  return {
    description,
    type,
  }
}

/**
 * @param {'suggestion' | 'warning'} type
 * @returns {string}
 */
export function getWarningIconClassName(type) {
  return type === 'warning' ? 'text-red-500' : 'text-yellow-500'
}

/**
 * @param {string | {description?: string, type?: 'suggestion' | 'warning'}} warning
 * @returns {{description: string, type: 'suggestion' | 'warning'}}
 */
export function normalizeWarning(warning) {
  if (typeof warning === 'string') {
    return createWarning(warning)
  }

  return createWarning(
    warning?.description || '',
    warning?.type || 'suggestion'
  )
}

function WarningIcons({ warnings, allowedPlacements }) {
  return warnings.map((warning, index) => {
    const item = normalizeWarning(warning)

    return (
      <TooltipButton
        key={`${item.description}-${index}`}
        className="shrink-0"
        tooltip={<div className="max-w-xs">{item.description}</div>}
        allowedPlacements={allowedPlacements}
      >
        <ExclamationTriangleIcon
          className={clsx('w-4 h-4', getWarningIconClassName(item.type))}
        />
      </TooltipButton>
    )
  })
}

/**
 * @param {object} data
 * @returns {Array<{description: string, type: 'suggestion' | 'warning'}>}
 */
export function getBotWarnings(data) {
  const warnings = []

  if (!data.name) {
    warnings.push(
      createWarning(
        'Add name to this bot to help others (including other bots) understand its purpose.'
      )
    )
  }

  if (!data.description) {
    warnings.push(
      createWarning(
        'Add description to this bot to help others (including other bots) understand what it can do and how to use it.'
      )
    )
  }

  if (!data.backstory) {
    warnings.push(
      createWarning(
        'Add backstory to this bot to help others (including other bots) understand its personality and behavior.'
      )
    )
  }

  if (data.model) {
    try {
      parseLanguageModel(data.model)
    } catch {
      warnings.push(
        createWarning(
          `The model "${data.model}" is not a supported model. Update the model field to a valid model ID.`,
          'warning'
        )
      )
    }
  }

  return warnings
}

/**
 * @param {object} data
 * @returns {Array<{description: string, type: 'suggestion' | 'warning'}>}
 */
export function getDatasetWarnings(data) {
  const warnings = []

  if (!data.name) {
    warnings.push(
      createWarning(
        'Add a name to this dataset to help connecting agents understand its purpose.'
      )
    )
  }

  if (!data.description) {
    warnings.push(
      createWarning(
        'Add description to this dataset to help connecting agents understand what information it provides and how to use it.'
      )
    )
  }

  return warnings
}

/**
 * @param {object} data
 * @returns {Array<{description: string, type: 'suggestion' | 'warning'}>}
 */
export function getSkillsetWarnings(data) {
  const warnings = []

  if (!data.name) {
    warnings.push(
      createWarning(
        'Add a name to this skillset to help connecting agents understand its purpose.'
      )
    )
  }

  if (!data.description) {
    warnings.push(
      createWarning(
        'Add description to this skillset to help connecting agents understand what abilities it provides and how to use them.'
      )
    )
  }

  return warnings
}

/**
 * @param {object} data
 * @param {Record<string, object>} [abilityResources]
 * @returns {Array<{description: string, type: 'suggestion' | 'warning'}>}
 */
export function getAbilityWarnings(data, abilityResources) {
  const warnings = []

  if (!data.name) {
    warnings.push(
      createWarning(
        'Add a short name to this ability to help bots know how to use it and what it does.'
      )
    )
  }

  if (!data.description) {
    warnings.push(
      createWarning(
        'Add description to this ability to help bots know how to use it and what it does.'
      )
    )
  }

  if (!data.instruction) {
    warnings.push(
      createWarning(
        'Add an instruction to this ability that describes its core functionality.',
        'warning'
      )
    )
  }

  if (
    data.instruction &&
    abilityResources &&
    Object.keys(abilityResources).length > 0
  ) {
    const type = getInstructionType(data.instruction)

    if (type === 'template') {
      try {
        const { template } = parseTemplateInstruction(data.instruction)
        const resolved = getTemplate(template, abilityResources)

        if (!resolved) {
          warnings.push(
            createWarning(
              `The template "${template}" does not exist. Update the instruction to use a valid template or switch to a plain instruction.`,
              'warning'
            )
          )
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  if (!data.skillsetId) {
    warnings.push(
      createWarning(
        'Connect this ability to a skillset so that a bot can use it.',
        'warning'
      )
    )
  }

  return warnings
}

/**
 * @param {object} data
 * @param {Record<string, object>} [secretResources]
 * @param {{ connections?: Array }} [options]
 * @returns {Array<{description: string, type: 'suggestion' | 'warning'}>}
 */
export function getSecretWarnings(data, secretResources, { connections } = {}) {
  const warnings = []

  if (!data.name) {
    warnings.push(
      createWarning(
        'Add a name to this secret to help connecting agents understand its purpose.'
      )
    )
  }

  if (data.type === 'template') {
    if (!data.config?.template) {
      warnings.push(
        createWarning(
          'This secret is configured as a template type but has no template assigned. Select a valid template in the secret configuration.',
          'warning'
        )
      )
    } else if (secretResources && Object.keys(secretResources).length > 0) {
      const resolved = secretResources[data.config.template]

      if (!resolved) {
        warnings.push(
          createWarning(
            `The template "${data.config.template}" does not exist. Update the secret to use a valid template.`,
            'warning'
          )
        )
      }
    }
  }

  if (data.type === 'oauth') {
    const config = data.config || {}

    // MCP OAuth uses resourceUrl and doesn't require clientId/clientSecret
    const isMcpOauth = !!config.resourceUrl

    if (isMcpOauth) {
      // MCP OAuth only requires resourceUrl; clientId and clientSecret are optional
    } else if (config.grantType === 'client_credentials') {
      // Client credentials grant requires tokenUrl, clientId, clientSecret
      if (!config.tokenUrl) {
        warnings.push(
          createWarning(
            'Add a token URL to this OAuth secret. The token URL is required for client credentials authentication.',
            'warning'
          )
        )
      }

      if (!config.clientId) {
        warnings.push(
          createWarning(
            'Add a client ID to this OAuth secret. The client ID is required for client credentials authentication.',
            'warning'
          )
        )
      }

      if (!config.clientSecret) {
        warnings.push(
          createWarning(
            'Add a client secret to this OAuth secret. The client secret is required for client credentials authentication.',
            'warning'
          )
        )
      }
    } else {
      // Authorization code grant (default) requires authorizationUrl, tokenUrl, clientId, clientSecret
      if (!config.authorizationUrl) {
        warnings.push(
          createWarning(
            'Add an authorization URL to this OAuth secret. The authorization URL is required for OAuth authentication.',
            'warning'
          )
        )
      }

      if (!config.tokenUrl) {
        warnings.push(
          createWarning(
            'Add a token URL to this OAuth secret. The token URL is required for OAuth authentication.',
            'warning'
          )
        )
      }

      if (!config.clientId) {
        warnings.push(
          createWarning(
            'Add a client ID to this OAuth secret. The client ID is required for OAuth authentication.',
            'warning'
          )
        )
      }

      if (!config.clientSecret) {
        warnings.push(
          createWarning(
            'Add a client secret to this OAuth secret. The client secret is required for OAuth authentication.',
            'warning'
          )
        )
      }
    }
  }

  if (connections && connections.length === 0) {
    warnings.push(
      createWarning(
        'Connect this secret to an ability so that it can be used for authentication.',
        'warning'
      )
    )
  }

  return warnings
}

/**
 * @param {object} data
 * @returns {Array<{description: string, type: 'suggestion' | 'warning'}>}
 */
export function getTriggerIntegrationWarnings(data) {
  const warnings = []

  if (!data.name) {
    warnings.push(
      createWarning(
        'Add a name to this trigger integration to help the connected agent understand its purpose.'
      )
    )
  }

  if (!data.description) {
    warnings.push(
      createWarning(
        'Add description to this trigger integration to help the connected agent understand what it does and how to use it.'
      )
    )
  }

  return warnings
}

/**
 * @param {object} data
 * @returns {Array<{description: string, type: 'suggestion' | 'warning'}>}
 */
export function getTaskWarnings(data) {
  const warnings = []

  if (!data.name) {
    warnings.push(
      createWarning(
        'Add a name to this task to help the connected agent understand its purpose.'
      )
    )
  }

  if (!data.description) {
    warnings.push(
      createWarning(
        'Add a description to this task so the connected agent knows what to do on each run.'
      )
    )
  }

  if (!data.botId) {
    warnings.push(
      createWarning(
        'Connect this task to a bot - a task runs a bot, so without one it has nothing to execute.'
      )
    )
  }

  return warnings
}

/**
 * Integration resource types that expose an `allowFrom` access list. A wildcard
 * (`*`) entry in that list means the integration accepts messages from anyone.
 */
const integrationTypesWithAllowFrom = new Set([
  'slackIntegration',
  'discordIntegration',
  'microsoftteamsIntegration',
  'googlechatIntegration',
  'whatsappIntegration',
  'telegramIntegration',
  'twilioIntegration',
  'emailIntegration',
])

/**
 * Returns true when an `allowFrom` value contains a wildcard (`*`) entry. The
 * value is a newline- and/or comma-separated list, so each entry is inspected
 * individually - `@U123, *` is a wildcard, `*abc` is not.
 *
 * @param {unknown} allowFrom
 * @returns {boolean}
 */
export function allowFromHasWildcard(allowFrom) {
  if (typeof allowFrom !== 'string') {
    return false
  }

  return allowFrom.split(/[\n,]+/).some((entry) => entry.trim() === '*')
}

/**
 * Shared lint check for integrations that carry an `allowFrom` access list.
 * When the list contains a wildcard the integration is reachable by anyone, so
 * we surface a gentle heads-up. This is intentionally a `suggestion` rather
 * than a `warning` - a wildcard is a perfectly reasonable choice for public
 * assistants and should not look alarming.
 *
 * @param {object} data
 * @returns {Array<{description: string, type: 'suggestion' | 'warning'}>}
 */
export function getAllowFromWarnings(data) {
  const warnings = []

  if (allowFromHasWildcard(data?.allowFrom)) {
    warnings.push(
      createWarning(
        'This integration currently accepts messages from anyone because "allowFrom" is set to "*". That is fine for public assistants - to limit who can reach this bot, replace "*" with the specific users or channels you want to allow.'
      )
    )
  }

  return warnings
}

/**
 * @param {object} data
 * @returns {Array<{description: string, type: 'suggestion' | 'warning'}>}
 */
export function getSlackIntegrationWarnings(data) {
  const warnings = []

  if (!data.botToken) {
    warnings.push(
      createWarning(
        'Add a bot token to this Slack integration to help the connected agent authenticate and interact with Slack.',
        'warning'
      )
    )
  }

  if (!data.userToken) {
    warnings.push(
      createWarning(
        'Add a user token to this Slack integration to help the connected agent authenticate and interact with Slack.'
      )
    )
  }

  return warnings
}

/**
 * @param {object} data
 * @returns {Array<{description: string, type: 'suggestion' | 'warning'}>}
 */
export function getMicrosoftteamsIntegrationWarnings(data) {
  const warnings = []

  if (!data.botFrameworkAppId) {
    warnings.push(
      createWarning(
        'Add a Bot Framework App ID to this Teams integration to authenticate with Microsoft Teams.',
        'warning'
      )
    )
  }

  if (!data.botFrameworkAppSecret) {
    warnings.push(
      createWarning(
        'Add a Bot Framework App Secret to this Teams integration to authenticate with Microsoft Teams.',
        'warning'
      )
    )
  }

  return warnings
}

/**
 * Map of resource type to its warning function for use by lintBlueprintNodes.
 */
const warningFunctionsByType = {
  bot: getBotWarnings,
  dataset: getDatasetWarnings,
  skillset: getSkillsetWarnings,
  ability: getAbilityWarnings,
  secret: getSecretWarnings,
  task: getTaskWarnings,
  triggerIntegration: getTriggerIntegrationWarnings,
  slackIntegration: getSlackIntegrationWarnings,
  microsoftteamsIntegration: getMicrosoftteamsIntegrationWarnings,
}

/**
 *
 */
export function useBotWarnings(data, disabled) {
  return useMemo(() => (disabled ? [] : getBotWarnings(data)), [data, disabled])
}

/**
 *
 */
export function useDatasetWarnings(data, disabled) {
  return useMemo(
    () => (disabled ? [] : getDatasetWarnings(data)),
    [data, disabled]
  )
}

/**
 *
 */
export function useSkillsetWarnings(data, disabled) {
  return useMemo(
    () => (disabled ? [] : getSkillsetWarnings(data)),
    [data, disabled]
  )
}

/**
 *
 */
export function useAbilityWarnings(data, disabled, abilityResources) {
  return useMemo(
    () => (disabled ? [] : getAbilityWarnings(data, abilityResources)),
    [data, disabled, abilityResources]
  )
}

/**
 *
 */
export function useSecretWarnings(data, disabled, secretResources) {
  const connections = useNodeConnections({ handleType: 'target' })

  return useMemo(
    () =>
      disabled ? [] : getSecretWarnings(data, secretResources, { connections }),
    [data, disabled, secretResources, connections]
  )
}

/**
 *
 */
export function useTriggerIntegrationWarnings(data, disabled) {
  return useMemo(
    () => (disabled ? [] : getTriggerIntegrationWarnings(data)),
    [data, disabled]
  )
}

/**
 *
 */
export function useTaskWarnings(data, disabled) {
  return useMemo(
    () => (disabled ? [] : getTaskWarnings(data)),
    [data, disabled]
  )
}

/**
 *
 */
export function useSlackIntegrationWarnings(data, disabled) {
  return useMemo(
    () => (disabled ? [] : getSlackIntegrationWarnings(data)),
    [data, disabled]
  )
}

/**
 *
 */
export function useMicrosoftteamsIntegrationWarnings(data, disabled) {
  return useMemo(
    () => (disabled ? [] : getMicrosoftteamsIntegrationWarnings(data)),
    [data, disabled]
  )
}

// --- Schema Properties Functions ---

/**
 * Used to get the omit value for ${type} for the schema object properties.
 */
const type2OmitMap = {}

/**
 * Used to get the format for ${type}:${key} for the schema object properties.
 */
const typeKey2FormatMap = {
  'dataset:reranker': DatasetRerankerSelectFormatComponent,
  'dataset:matchInstruction': AutoTextareaFormatComponent,
  'dataset:mismatchInstruction': AutoTextareaFormatComponent,

  'secret:value': SecretValueFormatComponent,

  'portal:config': PortalConfigFormatComponent,

  'policy:config': PolicyConfigFormatComponent,

  'widgetIntegration:origin': CommaListFormatComponent,

  'emailIntegration:allowFrom': AutoTextareaFormatComponent,

  'triggerIntegration:schedule': ScheduleSelectFormatComponent,
  'triggerIntegration:timezone': TimezoneSelectFormatComponent,

  'task:schedule': ScheduleSelectFormatComponent,
  'task:timezone': TimezoneSelectFormatComponent,
  'task:maxTime': DurationSelectFormatComponent,

  'slackIntegration:botToken': 'password',
  'slackIntegration:userToken': 'password',
  'slackIntegration:signingSecret': 'password',
  'slackIntegration:autoRespond': AutoTextareaFormatComponent,
  'slackIntegration:allowFrom': AutoTextareaFormatComponent,

  'discordIntegration:botToken': 'password',
  'discordIntegration:publicKey': 'password',
  'discordIntegration:allowFrom': AutoTextareaFormatComponent,

  'microsoftteamsIntegration:botFrameworkAppSecret': 'password',

  'googlechatIntegration:serviceAccountKey': RevealTextareaFormatComponent,
  'googlechatIntegration:allowFrom': AutoTextareaFormatComponent,

  'whatsappIntegration:accessToken': 'password',

  'messengerIntegration:accessToken': 'password',

  'instagramIntegration:accessToken': 'password',

  'telegramIntegration:botToken': 'password',
  'telegramIntegration:allowFrom': AutoTextareaFormatComponent,

  'telegramIntegration:accountSid': 'password',
  'telegramIntegration:authToken': 'password',

  'twilioIntegration:allowFrom': AutoTextareaFormatComponent,

  'recallIntegration:apiKey': 'password',

  'anamIntegration:apiKey': 'password',

  'githubIntegration:privateKey': RevealTextareaFormatComponent,
  'githubIntegration:webhookSecret': 'password',

  'sitemapIntegration:glob': AutoTextareaFormatComponent,
  'sitemapIntegration:selectors': CommaListFormatComponent,

  'notionIntegration:token': 'password',

  'extractIntegration:schema': ExtractSchemaFormatComponent,
  'extractIntegration:request': AutoTextareaFormatComponent,

  'mcpserverIntegration:tools': CommaListFormatComponent,

  'oAuthConnection:clientSecret': 'password',
  'oAuthConnection:allowedDomains': AutoTextareaFormatComponent,
  'oAuthConnection:requiredClaims': ObjectFormatComponent,
}

/**
 * Used to get the format for ${key} for the schema object properties.
 */
const key2FormatMap = {
  name: NameFormatComponent,

  description: DescriptionFormatComponent,

  backstory: BackstoryFormatComponent,

  model: ModelFormatComponent,

  meta: MetaFormatComponent,

  sessionDuration: DurationSelectFormatComponent,

  expiresIn: DaysSelectFormatComponent,
}

/**
 *
 */
const typeKey2ReactPropsMap = {
  // pass
}

/**
 *
 */
const key2ReactPropsMap = {
  botId: {
    spellCheck: false,
  },

  datasetId: {
    spellCheck: false,
  },

  skillsetId: {
    spellCheck: false,
  },

  fileId: {
    spellCheck: false,
  },

  secretId: {
    spellCheck: false,
  },

  spaceId: {
    spellCheck: false,
  },

  linkedBotId: {
    spellCheck: false,
  },

  linkedFileId: {
    spellCheck: false,
  },

  linkedSecretId: {
    spellCheck: false,
  },

  linkedSpaceId: {
    spellCheck: false,
  },
}

/**
 * Used to get the properties value for ${type}:${key} for the schema object properties.
 */
const typeKey2PropertiesMap = {
  // @note maxTime is a per-run wall-clock cap (15 minutes–1 day), distinct from
  // sessionDuration's reuse window - so the duration picker offers 15 minutes
  // and labels the automatic value with the task's 15-minute default rather
  // than the session-reuse "1 day".
  'task:maxTime': {
    defaultCaption: '15 minutes (default)',
    minutesOptions: [15, 30, 45, 60, 90],
  },

  'widgetIntegration:sessionDuration': {
    allowNoSession: false,
  },
}

/**
 * Used to get the properties value for ${key} for the schema object properties.
 */
const key2PropertiesMap = {}

/**
 *
 */
function getSchemaPropertiesFromSchema(schema, type) {
  const { properties } = zodToJsonSchema(
    // omit some common properties that we know we don't need at the moment and
    // may not have been removed by the schema

    schema.omit(
      merge(
        // @note in the case of merge, later values will override earlier values

        // lowest priority

        {
          // @note filter common properties that we do not support at this stage
          lockId: true,
        },

        // highest priority

        type2OmitMap[`${type}`] || {}
      )
    )
  )

  // create and modify properties
  {
    for (const key in properties) {
      // merge anyOf
      {
        if (Array.isArray(properties[key].anyOf)) {
          properties[key] = merge(
            // @note in the case of merge, later values will override earlier values

            // lowest priority

            properties[key],

            // highest priority

            properties[key].anyOf[0]
          )

          delete properties[key].anyOf
        }
      }

      // set property title
      {
        properties[key].title ??= toHeadingCase(key)
      }

      // fix the type of the property
      {
        if (Array.isArray(properties[key].type)) {
          properties[key].type = properties[key].type[0]
        }
      }

      // set property format
      {
        properties[key].format ??=
          typeKey2FormatMap[`${type}:${key}`] || key2FormatMap[key]
      }

      // set property react:props
      {
        properties[key]['react:props'] = merge(
          // @note in the case of merge, later values will override earlier values

          // lowest priority

          properties[key]['react:props'] || {},

          // medium priority

          key2ReactPropsMap[key] || {},

          // highest priority

          typeKey2ReactPropsMap[`${type}:${key}`] || {},

          // extra

          { required: true }
        )
      }

      // merge specific properties
      {
        properties[key] = merge(
          // @note in the case of merge, later values will override earlier values

          // lowest priority

          properties[key],

          // medium priority

          key2PropertiesMap[`${key}`] || {},

          // highest priority

          typeKey2PropertiesMap[`${type}:${key}`] || {},

          // extra

          {}
        )
      }
    }
  }

  // reorder specific properties to appear at the end
  {
    const propertiesToMoveToEnd = ['visibility', 'alias', 'meta']

    for (const key of propertiesToMoveToEnd) {
      if (properties[key]) {
        const value = properties[key]

        delete properties[key]

        properties[key] = value

        properties[key]['react:props'] = {
          ...properties[key]['react:props'],
        }
      }
    }
  }

  return properties
}

// --- Configurator Components ---

/**
 *
 */
export function ConfiguratorSection({ className, children, ...props }) {
  return (
    <div
      {...props}
      className={clsx(
        'text-xxs',
        'mt-2 pt-2 px-1',
        'border-t auto-border-gray-200',
        'auto-text-gray-500 select-none',
        className
      )}
    >
      {children}
    </div>
  )
}

function isShallowEqualData(a, b) {
  if (Object.is(a, b)) {
    return true
  }

  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') {
    return false
  }

  const keysA = Object.keys(a)
  const keysB = Object.keys(b)

  if (keysA.length !== keysB.length) {
    return false
  }

  for (const key of keysA) {
    if (!Object.is(a[key], b[key])) {
      return false
    }
  }

  return true
}

export function resolveConfiguratorDataUpdate(currentData, incomingValue) {
  if (typeof incomingValue === 'function') {
    return {
      ...currentData,
      ...incomingValue(currentData),
    }
  }

  return {
    ...currentData,
    ...incomingValue,
  }
}

export function updateConfiguratorNodes(nodes, id, incomingValue) {
  let hasChanges = false

  const nextNodes = nodes.map((node) => {
    if (node.id !== id) {
      return node
    }

    const nextData = resolveConfiguratorDataUpdate(node.data, incomingValue)

    // @note bail out when the resulting data is shallow-equal to the previous
    // data so that no-op updates (e.g. function updaters that return the same
    // shape) do not cascade into a parent re-render.
    if (isShallowEqualData(nextData, node.data)) {
      return node
    }

    hasChanges = true

    return {
      ...node,
      data: nextData,
    }
  })

  return hasChanges ? nextNodes : nodes
}

/**
 *
 */
export function GenericConfigurator(props) {
  const { setNodes } = useReactFlow()

  const [target] = useDOMQuerySelector('#configurator-area')

  const schema = useMemo(() => {
    // @note keepKeys allows specific *Id data fields (e.g. botFrameworkAppId)
    //   to remain visible in the form even though they end in "Id"

    const keepKeys = new Set(props.keepKeys || [])

    return {
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(props.schema).filter(([key]) => {
          return !key.endsWith('Id') || keepKeys.has(key)
        })
      ),
    }
  }, [props.schema, props.keepKeys])

  const id = props.id

  const value = props.data

  const setValue = useCallback(
    (value) => {
      setNodes((nodes) => {
        return updateConfiguratorNodes(nodes, id, value)
      })
    },
    [id, setNodes]
  )

  return target
    ? createPortal(
        <SchemaPanel.Saving
          className="right-4 top-20"
          title={value.name}
          schema={schema}
          value={value}
          setValue={setValue}
        >
          {props.children}
        </SchemaPanel.Saving>,

        target
      )
    : null
}

GenericConfigurator.Memo = memo(GenericConfigurator)

/**
 *
 */
export function BotConfigurator(props) {
  const warnings = useBotWarnings(props.data)

  const confirm = useConfirm()

  const disabled = props.id.startsWith('#')

  // @note block state only exists for a persisted bot; skip the fetch for an
  // unsaved node (its id is a temporary `#`-prefixed placeholder)
  const {
    block,
    loading: blockLoading,
    unblock,
  } = useBotBlock(disabled ? null : props.id)

  async function handleUnblock() {
    const confirmed = await confirm(
      'Are you sure you want to unblock this bot? It will be able to run again immediately, even if it is still over the usage limit that blocked it.',
      {
        title: 'Unblock Bot',
      }
    )

    if (!confirmed) {
      return
    }

    await unblock()
  }

  return (
    <>
      <GenericConfigurator.Memo {...props}>
        <ConversationsButton
          disabled={disabled}
          botId={props.id}
          title={
            props.data?.name
              ? `Conversations - ${props.data.name}`
              : 'Conversations'
          }
        />
        {block ? (
          <ConfiguratorSection>
            <div className="flex flex-col gap-2">
              <div className="flex flex-row items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-red-500 shrink-0" />
                <span>{block.reason || 'This bot is blocked.'}</span>
              </div>
              {block.ttl ? (
                <p className="opacity-75">
                  Lifts automatically in {formatDuration(block.ttl * 1000)}.
                </p>
              ) : null}
              <button
                type="button"
                className="default-button tiny !text-xxs w-full"
                onClick={handleUnblock}
                disabled={blockLoading}
              >
                Unblock Bot
              </button>
            </div>
          </ConfiguratorSection>
        ) : null}
        {warnings.length > 0 ? (
          <ConfiguratorSection>
            <div className="flex flex-row gap-2 items-center">
              <div className="flex-1" />
              <WarningIcons
                warnings={warnings}
                allowedPlacements={['bottom', 'bottom-start', 'bottom-end']}
              />
            </div>
          </ConfiguratorSection>
        ) : null}
      </GenericConfigurator.Memo>
    </>
  )
}

BotConfigurator.Memo = memo(BotConfigurator)

/**
 *
 */
export function DatasetConfigurator(props) {
  const warnings = useDatasetWarnings(props.data)

  const { popup, openPopup } = usePopup({
    title: 'Manage Files',
    closePopupOnClickOutside: false,
    cancelButtonCaption: 'Close',
  })

  const { fetch } = useFetch()

  return (
    <>
      {popup}
      <GenericConfigurator.Memo {...props}>
        <button
          className="default-button tiny !text-xxs w-full"
          type="button"
          onClick={async () => {
            const { error, data } = await fetch(
              `/api/v1/dataset/${props.id}/file/list`,
              {
                loadingMessage: 'Loading files...',
                failureMessage: true,
              }
            )

            if (error) {
              return
            }

            openPopup(
              <DatasetFiles
                dataset={{
                  id: props.id,
                  files: data.items.map(({ id, name }) => {
                    // @note this sucks - we need to refactor the component

                    return {
                      fileId: id,

                      file: {
                        name,
                      },
                    }
                  }),
                }}
              />
            )
          }}
          disabled={props.id.startsWith('#')}
        >
          Manage Files
        </button>
        {warnings.length > 0 ? (
          <ConfiguratorSection>
            <div className="flex flex-row gap-2 items-center">
              <div className="flex-1" />
              <WarningIcons
                warnings={warnings}
                allowedPlacements={['bottom', 'bottom-start', 'bottom-end']}
              />
            </div>
          </ConfiguratorSection>
        ) : null}
      </GenericConfigurator.Memo>
    </>
  )
}

DatasetConfigurator.Memo = memo(DatasetConfigurator)

/**
 *
 */
export function SkillsetConfigurator(props) {
  const warnings = useSkillsetWarnings(props.data)

  return (
    <>
      <GenericConfigurator.Memo {...props}>
        {warnings.length > 0 ? (
          <ConfiguratorSection>
            <div className="flex flex-row gap-2 items-center">
              <div className="flex-1" />
              <WarningIcons
                warnings={warnings}
                allowedPlacements={['bottom', 'bottom-start', 'bottom-end']}
              />
            </div>
          </ConfiguratorSection>
        ) : null}
      </GenericConfigurator.Memo>
    </>
  )
}

SkillsetConfigurator.Memo = memo(SkillsetConfigurator)

/**
 *
 */
export function FileConfigurator(props) {
  const disabled = props.id.startsWith('#')

  return (
    <>
      <GenericConfigurator.Memo {...props}>
        <div className="space-y-2">
          <FileUploadButton
            className="default-button tiny !text-xxs w-full"
            fileId={props.id}
            disabled={disabled}
          />
          <FileDownloadButton
            className="default-button tiny !text-xxs w-full"
            fileId={props.id}
            disabled={disabled}
          />
          <FileEditButton
            className="default-button tiny !text-xxs w-full"
            fileId={props.id}
            fileName={props.data?.name}
            contentType={props.data?.meta?.contentType || props.data?.type}
            disabled={disabled}
          />
        </div>
      </GenericConfigurator.Memo>
    </>
  )
}

FileConfigurator.Memo = memo(FileConfigurator)

/**
 * Configurator for a policy resource. Schema-driven; the policy's `botId` link
 * is established via an edge to a bot rather than edited here.
 */
export function PolicyConfigurator(props) {
  return <GenericConfigurator.Memo {...props} />
}

PolicyConfigurator.Memo = memo(PolicyConfigurator)

/**
 *
 */
export function AbilityConfigurator(props) {
  const { abilityResources } = useResources()

  const warnings = useAbilityWarnings(props.data, false, abilityResources)

  const { help, schema } = useInitial(() => {
    let help =
      'Leave parameters empty to have them auto-filled at runtime by the agent.'

    const schema = { ...props.schema }

    // process instruction property
    {
      const type = getInstructionType(props.data.instruction || '')

      if (type === 'template') {
        const template = parseTemplateInstruction(props.data.instruction)

        const originalTemplate = getTemplate(
          template.template,
          abilityResources
        )

        if (originalTemplate) {
          help = [
            originalTemplate.title ? `### ${originalTemplate.title}` : '',
            originalTemplate.description || '',
            originalTemplate.commentary || '',
            originalTemplate.setup || '',
            help,
          ]
            .filter(Boolean)
            .join('\n\n')

          const originalTemplateId = template.template

          const originalTemplateProperties = Object.fromEntries(
            Object.entries(originalTemplate.properties || {}).map(
              ([name, property]) => {
                // Determine the format component based on the field name

                let format = {
                  backstory: BackstoryFormatComponent,
                  '@backstory': BackstoryFormatComponent,

                  model: ModelFormatComponent,
                  '@model': ModelFormatComponent,

                  instruction: AutoTextareaFormatComponent,
                  '@instruction': AutoTextareaFormatComponent,

                  instructions: AutoTextareaFormatComponent,
                  '@instructions': AutoTextareaFormatComponent,

                  direction: AutoTextareaFormatComponent,
                  '@direction': AutoTextareaFormatComponent,

                  directions: AutoTextareaFormatComponent,
                  '@directions': AutoTextareaFormatComponent,
                }[name]

                // Use ResourceIdFormatComponent for dynamic resource fields
                // to show connection status visually

                if (!format && isDynamicResourceField(name)) {
                  format = ResourceIdFormatComponent
                }

                return [
                  name,
                  {
                    ...property,

                    format,

                    'react:props': {
                      required: property.required ?? false,
                      placeholder: property.description,
                    },
                  },
                ]
              }
            )
          )

          schema.instruction = {
            title: 'Instruction',
            type: 'object',
            properties: {
              template: {
                title: 'Template Id',
                type: 'string',
                default: originalTemplateId,
                'react:props': {
                  required: true,
                  disabled: true,
                },
              },
              parameters: {
                title: 'Parameters',
                type: 'object',
                properties: originalTemplateProperties,
                'react:props': {
                  required: true,
                },
              },
            },
            default: {
              template: originalTemplateId,
              parameters: Object.fromEntries(
                Object.entries(originalTemplateProperties).map(
                  ([name, value]) => {
                    return [name, value.default]
                  }
                )
              ),
            },
            'react:props': {
              required: true,
              serializer: (value) => {
                // @note we trip to avoid any trailing spaces/newlines that may
                // cause the blueprint to be detected as having changes

                return buildTemplateInstruction(value).trim()
              },
              deserializer: (value) => {
                const { template, parameters } = parseTemplateInstruction(value)

                return {
                  template: template,
                  parameters: Object.fromEntries(
                    Object.entries(parameters).map(([name, value]) => {
                      return [name, isTemplateField(value) ? undefined : value]
                    })
                  ),
                }
              },
            },
          }
        } else {
          schema.instruction = {
            title: 'Instruction',
            type: 'string',
            format: InstructionFormatComponent,
            'react:props': {
              required: true,
            },
          }
        }
      } else {
        schema.instruction = {
          title: 'Instruction',
          type: 'string',
          format: InstructionFormatComponent,
          'react:props': {
            required: true,
          },
        }
      }
    }

    return { help, schema }
  })

  const { popup, openPopup } = usePopup({
    title: 'Test Ability',
  })

  return (
    <>
      <GlobalRootPortal>{popup}</GlobalRootPortal>
      <GenericConfigurator.Memo {...props} schema={schema}>
        <button
          className="default-button tiny !text-xxs w-full"
          type="button"
          onClick={() => {
            openPopup(
              <SkillsetAbilityTester
                skillset={{
                  id: props.data.skillsetId,
                  ability: {
                    ...props.data,

                    id: props.id,
                  },
                }}
              />,
              {
                title: 'Test Ability',
                description:
                  'Quickly test this ability with custom input to see how it performs.',
                cancelButtonCaption: 'Close',
                closePopupOnClickOutside: false,
              }
            )
          }}
          disabled={props.id.startsWith('#') || !props.data.skillsetId}
        >
          Test
        </button>
        {help || warnings.length > 0 ? (
          <ConfiguratorSection>
            <div className="flex flex-row gap-2 items-center">
              {help ? (
                <TooltipButton
                  className="shrink-0"
                  tooltip={
                    <Pagedown className="text-left max-w-xs [&_h3]:m-0 [&_h3]:p-0 [&_h3]:font-semibold [&_p]:mt-2">
                      {`${help}`.trim()}
                    </Pagedown>
                  }
                  allowedPlacements={['bottom', 'bottom-start', 'bottom-end']}
                >
                  <QuestionMarkCircleIcon className="w-4 h-4 text-gray-400" />
                </TooltipButton>
              ) : null}
              <div className="flex-1" />
              {warnings.length > 0 ? (
                <WarningIcons
                  warnings={warnings}
                  allowedPlacements={['bottom', 'bottom-start', 'bottom-end']}
                />
              ) : null}
            </div>
          </ConfiguratorSection>
        ) : null}
      </GenericConfigurator.Memo>
    </>
  )
}

AbilityConfigurator.Memo = memo(AbilityConfigurator)

/**
 *
 */
export function SecretConfigurator(props) {
  // @todo investigate what's wrong with the template rendering

  const { secretResources } = useResources()

  const warnings = useSecretWarnings(props.data, false, secretResources)

  const { help } = useMemo(() => {
    let help = ''

    if (props.data.config?.template) {
      const templateResource = secretResources[props.data.config.template]

      if (templateResource) {
        help = [
          templateResource.title ? `### ${templateResource.title}` : '',
          templateResource.description || '',
          templateResource.commentary || '',
          templateResource.setup || '',
        ]
          .filter(Boolean)
          .join('\n\n')
      }
    }

    return { help }
  }, [secretResources, props.data.config?.template])

  const schema = useMemo(() => {
    const schema = { ...props.schema }

    switch (props.data.kind) {
      case 'personal': {
        schema.value = {
          ...schema.value,

          'react:props': {
            ...schema.value['react:props'],

            disabled: true,
          },
        }

        break
      }

      case 'shared': {
        schema.value = {
          ...schema.value,

          'react:props': {
            ...schema.value['react:props'],

            disabled: false,
          },
        }

        break
      }
    }

    switch (props.data.type) {
      case 'oauth': {
        delete schema.value

        schema.config = {
          title: 'OAuth Config',
          type: 'object',
          properties: {
            resourceUrl: {
              title: 'Resource URL',
              type: 'string',
              description:
                'Protected resource URL for OAuth discovery (RFC 9728). When provided, endpoints can be discovered automatically.',
              'react:props': {
                spellCheck: false,
              },
            },
            clientId: {
              title: 'Client Id',
              type: 'string',
              'react:props': {
                spellCheck: false,
              },
            },
            clientSecret: {
              title: 'Client Secret',
              type: 'string',
              format: 'password',
              'react:props': {
                spellCheck: false,
              },
            },
            authorizationUrl: {
              title: 'Authorization URL',
              type: 'string',
              'react:props': {
                spellCheck: false,
              },
            },
            tokenUrl: {
              title: 'Token URL',
              type: 'string',
              'react:props': {
                spellCheck: false,
              },
            },
            revokeUrl: {
              title: 'Revoke URL',
              type: 'string',
              'react:props': {
                spellCheck: false,
              },
            },
            validateUrl: {
              title: 'Validate URL',
              type: 'string',
              'react:props': {
                spellCheck: false,
              },
            },
            grantType: {
              title: 'Grant Type',
              type: 'string',
              enum: ['authorization_code', 'client_credentials'],
              'react:props': {
                spellCheck: false,
              },
            },
            scope: {
              title: 'Scope',
              type: 'string',
              format: AutoTextareaFormatComponent,
              'react:props': {
                spellCheck: false,
              },
            },
          },
          'react:props': {
            required: true,
          },
        }

        break
      }

      case 'jwt': {
        // @note value is kept - it holds the PEM private key

        schema.config = {
          title: 'JWT Config',
          type: 'object',
          properties: {
            algorithm: {
              title: 'Algorithm',
              type: 'string',
              enum: ['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512'],
              description: 'Signing algorithm. Defaults to RS256.',
              'react:props': {
                spellCheck: false,
              },
            },
            claims: {
              title: 'Claims',
              type: 'object',
              description: 'JWT payload claims (e.g. { "iss": "app-id-123" }).',
              format: ObjectFormatComponent,
              'react:props': {
                spellCheck: false,
              },
            },
            expiresInSeconds: {
              title: 'Expires In (seconds)',
              type: 'number',
              description: 'Token lifetime in seconds. Defaults to 600.',
            },
            schema: {
              title: 'Auth Schema',
              type: 'string',
              description: 'HTTP Authorization prefix. Defaults to Bearer.',
              'react:props': {
                spellCheck: false,
              },
            },
          },
        }

        break
      }

      case 'template': {
        delete schema.value

        schema.config = {
          title: 'Template Config',
          type: 'object',
          properties: {
            template: {
              title: 'Template',
              type: 'string',
              'react:props': {
                required: true,
                disabled: true,
              },
            },
          },
          'react:props': {
            required: true,
          },
        }

        break
      }

      case 'reference': {
        delete schema.value

        schema.config = {
          title: 'Reference Config',
          type: 'object',
          properties: {
            secretId: {
              title: 'Secret Id',
              type: 'string',
              'react:props': {
                required: true,
              },
            },
          },
          'react:props': {
            required: true,
          },
        }

        break
      }

      default: {
        delete schema.config

        break
      }
    }

    return schema
  }, [props.data.kind, props.data.type, props.schema])

  const { fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  async function handleAuthenticate(event) {
    event.preventDefault()

    const { error, data } = await fetch(
      `/api/v1/secret/${props.id}/authenticate`,
      {
        data: {},
      }
    )

    if (error) {
      return
    }

    if (event.metaKey || event.ctrlKey) {
      copyTextToClipboard(
        new URL(data.url, window.location.origin).toString(),
        'Authentication URL copied to clipboard.'
      )

      return
    }

    const handle = window.open(data.url, '_blank')

    function handleMessage(event) {
      if (event.source !== handle) {
        return
      }

      if (event.data.type === 'oauth') {
        const { error, error_description } = event.data.params || {}

        if (error_description || error) {
          toast.error(error_description || error)
        } else {
          toast.success('Authentication successful.')
        }
      }

      window.removeEventListener('message', handleMessage)
    }

    window.addEventListener('message', handleMessage)
  }

  // @note a temporary block has no saved secret to authenticate yet - otherwise
  // the reason mirrors the Authenticate button on the secret page
  const authenticationBlockReason = props.id.startsWith('#')
    ? 'Save this secret before you can authenticate it.'
    : getSecretAuthenticationBlockReason(props.data)

  const authenticateButton = (
    <button
      className={clsx('default-button tiny !text-xxs w-full', {
        // @note a disabled button swallows its own pointer events - let the
        // hover fall through to the tooltip container behind it
        'pointer-events-none': !!authenticationBlockReason,
      })}
      type="button"
      onClick={handleAuthenticate}
      disabled={!!authenticationBlockReason}
    >
      Authenticate
    </button>
  )

  return (
    <>
      <GenericConfigurator.Memo {...props} schema={schema}>
        {/* @todo make sure we can also copy the link so that it can be authenticated outside of the current session - i.e. an admin authenticating it */}
        {authenticationBlockReason ? (
          <div className="relative group/tooltip flex w-full">
            {authenticateButton}
            {/* @note font-sans escapes the font-mono the schema panel sets */}
            <div className="tooltip above w-64 font-sans">
              {authenticationBlockReason}
            </div>
          </div>
        ) : (
          authenticateButton
        )}
        {help || warnings.length > 0 ? (
          <ConfiguratorSection>
            <div className="flex flex-row gap-2 items-center">
              {help ? (
                <TooltipButton
                  className="shrink-0"
                  tooltip={
                    <Pagedown className="text-left max-w-xs [&_h3]:m-0 [&_h3]:p-0 [&_h3]:font-semibold [&_p]:mt-2">
                      {`${help}`.trim()}
                    </Pagedown>
                  }
                  allowedPlacements={['bottom', 'bottom-start', 'bottom-end']}
                >
                  <QuestionMarkCircleIcon className="w-4 h-4 text-gray-400" />
                </TooltipButton>
              ) : null}
              <div className="flex-1" />
              {warnings.length > 0 ? (
                <WarningIcons
                  warnings={warnings}
                  allowedPlacements={['bottom', 'bottom-start', 'bottom-end']}
                />
              ) : null}
            </div>
          </ConfiguratorSection>
        ) : null}
      </GenericConfigurator.Memo>
    </>
  )
}

SecretConfigurator.Memo = memo(SecretConfigurator)

/**
 *
 */
export function PortalConfigurator(props) {
  const disabled = props.id.startsWith('#')

  return (
    <>
      <GenericConfigurator.Memo {...props}>
        <button
          className="default-button tiny !text-xxs w-full"
          type="button"
          onClick={async () => {
            // @note the portal's URL follows the deployment's topology (portal
            // apex or custom domain), which only the server knows - the
            // Portal object resolves it

            const client = createClient({
              endpoint: new URL('/api/v1/graphql', window.location.origin).href,
            })

            const data = await client.portalUrl({ portalIds: [props.id] })

            const url = data?.portals?.edges?.[0]?.node?.url

            if (url) {
              window.open(url, '_blank', 'noreferrer,noopener')
            }
          }}
          disabled={disabled || !props.data?.slug}
        >
          Open Portal
        </button>
      </GenericConfigurator.Memo>
    </>
  )
}

PortalConfigurator.Memo = memo(PortalConfigurator)

/**
 *
 */
export function SpaceConfigurator(props) {
  const disabled = props.id.startsWith('#')

  const { popup, openPopup } = usePopup()

  return (
    <>
      {popup}
      <GenericConfigurator.Memo {...props}>
        <button
          className="default-button tiny !text-xxs w-full"
          type="button"
          disabled={disabled}
          onClick={() => {
            openPopup(
              <SpaceStorageList
                spaceId={props.id}
                uploadEnabled={true}
                createEnabled={true}
                deleteEnabled={true}
              />,
              {
                title: props.data?.name
                  ? `Files - ${props.data.name}`
                  : 'Space Files',
                noActions: true,
                cancelButtonCaption: 'Close',
                dialogClassName: 'sm:max-w-3xl',
              }
            )
          }}
        >
          Browse Files
        </button>
        <button
          className="default-button tiny !text-xxs w-full"
          type="button"
          disabled={disabled}
          onClick={() => {
            openPopup(<SpaceSiteList spaceId={props.id} />, {
              title: props.data?.name
                ? `Sites - ${props.data.name}`
                : 'Space Sites',
              noActions: true,
              cancelButtonCaption: 'Close',
              dialogClassName: 'sm:max-w-3xl',
            })
          }}
        >
          Manage Sites
        </button>
      </GenericConfigurator.Memo>
    </>
  )
}

SpaceConfigurator.Memo = memo(SpaceConfigurator)

/**
 *
 */
export function WidgetIntegrationConfigurator(props) {
  const disabled = props.id.startsWith('#')

  return (
    <>
      <GenericConfigurator.Memo {...props}>
        <Link
          className="default-button tiny !text-xxs w-full"
          href={`/integrations/widget/${props.id}`}
          target="_blank"
          disabled={disabled}
        >
          Design Theme
        </Link>
        <Link
          className="default-button tiny !text-xxs w-full"
          href={`/integrations/widget/${props.id}/test`}
          target="_blank"
          disabled={disabled}
        >
          Test
        </Link>
        <ConversationsButton
          disabled={disabled}
          widgetIntegrationId={props.id}
          title={
            props.data?.name
              ? `Conversations - ${props.data.name}`
              : 'Conversations'
          }
        />
      </GenericConfigurator.Memo>
    </>
  )
}

WidgetIntegrationConfigurator.Memo = memo(WidgetIntegrationConfigurator)

/**
 * Renders a hosted realtime integration frame inside a popup so the avatar can
 * be tested directly from the designer. Both the avatar and anam integrations
 * expose a `/frame` route that hosts an interactive session, and the frame
 * needs microphone/camera access to talk with the avatar.
 */
function IntegrationTestFrame({ src }) {
  return (
    <div className="mx-auto w-full max-w-xs overflow-hidden rounded-xl border auto-border-gray-200 bg-black">
      <iframe
        title="Integration test frame"
        className="block w-full aspect-[3/4] border-0"
        src={src}
        allow="microphone; camera; autoplay; fullscreen"
      />
    </div>
  )
}

/**
 * Shared configurator for the realtime avatar integrations (avatar + anam). It
 * extends the generic configurator with a Test button that opens the hosted
 * integration frame in a popup so the user can talk to the avatar without
 * leaving the designer. The button is disabled until the node is saved because
 * the frame is served from the persisted integration id.
 */
function SharedAvatarIntegrationConfigurator({ integrationType, ...props }) {
  const disabled = props.id.startsWith('#')

  const { popup, openPopup } = usePopup({
    closePopupOnClickOutside: false,
    cancelButtonCaption: 'Close',
  })

  return (
    <>
      {popup}
      <GenericConfigurator.Memo {...props}>
        <button
          className="default-button tiny !text-xxs w-full"
          type="button"
          onClick={() => {
            openPopup(
              <IntegrationTestFrame
                src={`/integrations/${integrationType}/${props.id}/frame`}
              />,
              {
                title: props.data?.name
                  ? `Test - ${props.data.name}`
                  : 'Test Avatar',
                description:
                  'Talk to the avatar in real time. Allow microphone access when prompted.',
                dialogClassName: 'sm:max-w-md',
                animateContentHeight: false,
                closePopupOnClickOutside: false,
                cancelButtonCaption: 'Close',
              }
            )
          }}
          disabled={disabled}
        >
          Test
        </button>
      </GenericConfigurator.Memo>
    </>
  )
}

/**
 *
 */
export function AvatarIntegrationConfigurator(props) {
  return (
    <SharedAvatarIntegrationConfigurator {...props} integrationType="avatar" />
  )
}

AvatarIntegrationConfigurator.Memo = memo(AvatarIntegrationConfigurator)

/**
 *
 */
export function AnamIntegrationConfigurator(props) {
  return (
    <SharedAvatarIntegrationConfigurator {...props} integrationType="anam" />
  )
}

AnamIntegrationConfigurator.Memo = memo(AnamIntegrationConfigurator)

/**
 *
 */
export function EmailIntegrationConfigurator(props) {
  const disabled = props.id.startsWith('#')

  const { emailIntegrationDomain } = useContext(DeploymentConfigContext)

  return (
    <>
      <GenericConfigurator.Memo {...props}>
        {/* @todo implement a standard popup where the user can copy the values that are required for setup - it should be a setup popup of sort */}
        <button
          className="default-button tiny !text-xxs w-full"
          type="button"
          onClick={async () => {
            try {
              await window.navigator.clipboard.writeText(
                `${props.id}@${emailIntegrationDomain}`
              )

              toast.success('Email copied to clipboard')
            } catch {
              // @note clipboard API may be blocked by permissions policy

              toast.error('Failed to copy to clipboard')
            }
          }}
          disabled={disabled}
        >
          Copy Email
        </button>
        <ConversationsButton
          disabled={disabled}
          emailIntegrationId={props.id}
          title={
            props.data?.name
              ? `Conversations - ${props.data.name}`
              : 'Conversations'
          }
        />
      </GenericConfigurator.Memo>
    </>
  )
}

EmailIntegrationConfigurator.Memo = memo(EmailIntegrationConfigurator)

/**
 *
 */
export function WhatsappIntegrationConfigurator(props) {
  const getAPIURL = useExternalAPIURL()

  const disabled = props.id.startsWith('#')

  const { fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  return (
    <>
      <GenericConfigurator.Memo {...props}>
        {/* @todo implement a standard popup where the user can copy the values that are required for setup - it should be a setup popup of sort */}
        <button
          className="default-button tiny !text-xxs w-full"
          type="button"
          onClick={async () => {
            try {
              await window.navigator.clipboard.writeText(
                getAPIURL(`/v1/integration/whatsapp/${props.id}/callback`)
              )

              toast.success('Callback URL copied to clipboard')
            } catch {
              toast.error('Failed to copy to clipboard')
            }
          }}
          disabled={disabled}
        >
          Copy Callback URL
        </button>
        <button
          className="default-button tiny !text-xxs w-full"
          type="button"
          onClick={async () => {
            await fetch(`/api/v1/integration/whatsapp/${props.id}/setup`, {
              data: {},
              loadingMessage: 'Setting up the integration...',
            })
          }}
          disabled={disabled}
        >
          Setup
        </button>
        <ConversationsButton
          disabled={disabled}
          whatsappIntegrationId={props.id}
          title={
            props.data?.name
              ? `Conversations - ${props.data.name}`
              : 'Conversations'
          }
        />
      </GenericConfigurator.Memo>
    </>
  )
}

WhatsappIntegrationConfigurator.Memo = memo(WhatsappIntegrationConfigurator)

/**
 *
 */
export function MessengerIntegrationConfigurator(props) {
  const disabled = props.id.startsWith('#')

  const { fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  return (
    <>
      <GenericConfigurator.Memo {...props}>
        <button
          className="default-button tiny !text-xxs w-full"
          type="button"
          onClick={async () => {
            await fetch(`/api/v1/integration/messenger/${props.id}/setup`, {
              data: {},
              loadingMessage: 'Setting up the integration...',
            })
          }}
          disabled={disabled}
        >
          Setup
        </button>
        <ConversationsButton
          disabled={disabled}
          messengerIntegrationId={props.id}
          title={
            props.data?.name
              ? `Conversations - ${props.data.name}`
              : 'Conversations'
          }
        />
      </GenericConfigurator.Memo>
    </>
  )
}

MessengerIntegrationConfigurator.Memo = memo(MessengerIntegrationConfigurator)

/**
 *
 */
export function InstagramIntegrationConfigurator(props) {
  const disabled = props.id.startsWith('#')

  const { fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  return (
    <>
      <GenericConfigurator.Memo {...props}>
        <button
          className="default-button tiny !text-xxs w-full"
          type="button"
          onClick={async () => {
            await fetch(`/api/v1/integration/instagram/${props.id}/setup`, {
              data: {},
              loadingMessage: 'Setting up the integration...',
            })
          }}
          disabled={disabled}
        >
          Setup
        </button>
        <ConversationsButton
          disabled={disabled}
          instagramIntegrationId={props.id}
          title={
            props.data?.name
              ? `Conversations - ${props.data.name}`
              : 'Conversations'
          }
        />
      </GenericConfigurator.Memo>
    </>
  )
}

InstagramIntegrationConfigurator.Memo = memo(InstagramIntegrationConfigurator)

/**
 *
 */
export function SlackIntegrationConfigurator(props) {
  const disabled = props.id.startsWith('#')

  const { fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  function handleInstall() {
    // @note use current window origin as base URL for the manifest
    const baseUrl = window.location.origin

    const config = {
      id: props.id,
      name: props.data.name || 'ChatBotKit',
      description: props.data.description,
    }

    const installUrl = buildSlackManifestInstallUrl(config, baseUrl)

    const a = document.createElement('a')

    a.href = installUrl
    a.target = '_blank'
    a.click()
  }

  return (
    <>
      <GenericConfigurator.Memo {...props}>
        <button
          className="default-button tiny !text-xxs w-full"
          type="button"
          onClick={handleInstall}
          disabled={disabled}
        >
          Install
        </button>
        <button
          className="default-button tiny !text-xxs w-full"
          type="button"
          onClick={async () => {
            await fetch(`/api/v1/integration/slack/${props.id}/setup`, {
              data: {},
              loadingMessage: 'Setting up the integration...',
            })
          }}
          disabled={disabled}
        >
          Setup
        </button>
        <ConversationsButton
          disabled={disabled}
          slackIntegrationId={props.id}
          title={
            props.data?.name
              ? `Conversations - ${props.data.name}`
              : 'Conversations'
          }
        />
      </GenericConfigurator.Memo>
    </>
  )
}

SlackIntegrationConfigurator.Memo = memo(SlackIntegrationConfigurator)

/**
 *
 */
export function MicrosoftteamsIntegrationConfigurator(props) {
  const disabled = props.id.startsWith('#')

  const { fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  return (
    <>
      <GenericConfigurator.Memo
        {...props}
        keepKeys={['botFrameworkAppId', 'tenantId']}
      >
        <button
          className="default-button tiny !text-xxs w-full"
          type="button"
          onClick={async () => {
            await fetch(
              `/api/v1/integration/microsoftteams/${props.id}/setup`,
              {
                data: {},
                loadingMessage: 'Setting up the integration...',
              }
            )
          }}
          disabled={disabled}
        >
          Setup
        </button>
        <ConversationsButton
          disabled={disabled}
          microsoftteamsIntegrationId={props.id}
          title={
            props.data?.name
              ? `Conversations - ${props.data.name}`
              : 'Conversations'
          }
        />
      </GenericConfigurator.Memo>
    </>
  )
}

MicrosoftteamsIntegrationConfigurator.Memo = memo(
  MicrosoftteamsIntegrationConfigurator
)

/**
 *
 */
export function GooglechatIntegrationConfigurator(props) {
  const disabled = props.id.startsWith('#')

  const { fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  return (
    <>
      <GenericConfigurator.Memo {...props} keepKeys={['projectNumber']}>
        <button
          className="default-button tiny !text-xxs w-full"
          type="button"
          onClick={async () => {
            await fetch(`/api/v1/integration/googlechat/${props.id}/setup`, {
              data: {},
              loadingMessage: 'Setting up the integration...',
            })
          }}
          disabled={disabled}
        >
          Setup
        </button>
        <ConversationsButton
          disabled={disabled}
          googlechatIntegrationId={props.id}
          title={
            props.data?.name
              ? `Conversations - ${props.data.name}`
              : 'Conversations'
          }
        />
      </GenericConfigurator.Memo>
    </>
  )
}

GooglechatIntegrationConfigurator.Memo = memo(GooglechatIntegrationConfigurator)

/**
 *
 */
export function TelegramIntegrationConfigurator(props) {
  const disabled = props.id.startsWith('#')

  const { fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  return (
    <>
      <GenericConfigurator.Memo {...props}>
        <button
          className="default-button tiny !text-xxs w-full"
          type="button"
          onClick={async () => {
            await fetch(`/api/v1/integration/telegram/${props.id}/setup`, {
              data: {},
              loadingMessage: 'Setting up the integration...',
            })
          }}
          disabled={disabled}
        >
          Setup
        </button>
        <ConversationsButton
          disabled={disabled}
          telegramIntegrationId={props.id}
          title={
            props.data?.name
              ? `Conversations - ${props.data.name}`
              : 'Conversations'
          }
        />
      </GenericConfigurator.Memo>
    </>
  )
}

TelegramIntegrationConfigurator.Memo = memo(TelegramIntegrationConfigurator)

/**
 *
 */
export function GithubIntegrationConfigurator(props) {
  const disabled = props.id.startsWith('#')

  const { fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  return (
    <>
      <GenericConfigurator.Memo {...props} keepKeys={['appId']}>
        <button
          className="default-button tiny !text-xxs w-full"
          type="button"
          onClick={async () => {
            await fetch(`/api/v1/integration/github/${props.id}/setup`, {
              data: {},
              loadingMessage: 'Checking the GitHub App credentials...',
              successMessage: 'GitHub App credentials are valid.',
            })
          }}
          disabled={disabled}
        >
          Setup
        </button>
        <ConversationsButton
          disabled={disabled}
          githubIntegrationId={props.id}
          title={
            props.data?.name
              ? `Conversations - ${props.data.name}`
              : 'Conversations'
          }
        />
      </GenericConfigurator.Memo>
    </>
  )
}

GithubIntegrationConfigurator.Memo = memo(GithubIntegrationConfigurator)

/**
 *
 */
export function TriggerIntegrationConfigurator(props) {
  const getAPIURL = useExternalAPIURL()

  const warnings = useTriggerIntegrationWarnings(props.data)

  const disabled = props.id.startsWith('#')

  const confirm = useConfirm()

  const { fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  return (
    <>
      <GenericConfigurator.Memo {...props}>
        <button
          className="default-button tiny !text-xxs w-full"
          type="button"
          onClick={async () => {
            if (
              !(await confirm('Are you sure you want to invoke this trigger?'))
            ) {
              return
            }

            await fetch(`/api/v1/integration/trigger/${props.id}/invoke`, {
              data: {},
              loadingMessage: 'Invoking trigger...',
            })
          }}
          disabled={disabled}
        >
          Invoke
        </button>
        <button
          className="default-button tiny !text-xxs w-full"
          type="button"
          onClick={async () => {
            try {
              await window.navigator.clipboard.writeText(
                getAPIURL(`/v1/integration/trigger/${props.id}/event`)
              )

              toast.success('URL copied to clipboard')
            } catch {
              toast.error('URL to copy to clipboard')
            }
          }}
          disabled={disabled}
        >
          Copy URL
        </button>
        <ConversationsButton
          disabled={disabled}
          triggerIntegrationId={props.id}
          title={
            props.data?.name
              ? `Conversations - ${props.data.name}`
              : 'Conversations'
          }
        />
        {warnings.length > 0 ? (
          <ConfiguratorSection>
            <div className="flex flex-row gap-2 items-center">
              <div className="flex-1" />
              <WarningIcons
                warnings={warnings}
                allowedPlacements={['bottom', 'bottom-start', 'bottom-end']}
              />
            </div>
          </ConfiguratorSection>
        ) : null}
      </GenericConfigurator.Memo>
    </>
  )
}

TriggerIntegrationConfigurator.Memo = memo(TriggerIntegrationConfigurator)

/**
 *
 */
export function TaskConfigurator(props) {
  const warnings = useTaskWarnings(props.data)

  const disabled = props.id.startsWith('#')

  const confirm = useConfirm()

  const { fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  return (
    <>
      <GenericConfigurator.Memo {...props}>
        <button
          className="default-button tiny !text-xxs w-full"
          type="button"
          onClick={async () => {
            if (
              !(await confirm('Are you sure you want to run this task now?'))
            ) {
              return
            }

            await fetch(`/api/v1/task/${props.id}/trigger`, {
              data: {},
              loadingMessage: 'Running task...',
            })
          }}
          disabled={disabled}
        >
          Run now
        </button>
        <ConversationsButton
          disabled={disabled}
          taskId={props.id}
          title={
            props.data?.name
              ? `Conversations - ${props.data.name}`
              : 'Conversations'
          }
        />
        {warnings.length > 0 ? (
          <ConfiguratorSection>
            <div className="flex flex-row gap-2 items-center">
              <div className="flex-1" />
              <WarningIcons
                warnings={warnings}
                allowedPlacements={['bottom', 'bottom-start', 'bottom-end']}
              />
            </div>
          </ConfiguratorSection>
        ) : null}
      </GenericConfigurator.Memo>
    </>
  )
}

TaskConfigurator.Memo = memo(TaskConfigurator)

/**
 *
 */
export function DatasetImporterIntegrationConfigurator(props) {
  const disabled = props.id.startsWith('#')

  const { fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  return (
    <>
      <GenericConfigurator.Memo {...props}>
        <button
          className="default-button tiny !text-xxs w-full"
          type="button"
          onClick={async () => {
            await fetch(
              `/api/v1/integration/${props.type.replace('Integration', '')}/${
                props.id
              }/sync`,
              {
                data: {},
                loadingMessage: 'Syncing the integration...',
              }
            )
          }}
          disabled={disabled}
        >
          Sync
        </button>
      </GenericConfigurator.Memo>
    </>
  )
}

DatasetImporterIntegrationConfigurator.Memo = memo(
  DatasetImporterIntegrationConfigurator
)

/**
 *
 */
export function McpserverIntegrationConfigurator(props) {
  const getAPIURL = useExternalAPIURL()

  const disabled = props.id.startsWith('#')

  const { fetch } = useFetch({
    loadingMessage: 'Fetching MCP URL...',
    failureMessage: true,
  })

  return (
    <>
      <GenericConfigurator.Memo {...props}>
        <button
          className="default-button tiny !text-xxs w-full"
          type="button"
          onClick={async () => {
            try {
              const { data, error } = await fetch(
                `/api/v1/integration/mcpserver/${props.id}/fetch`
              )

              if (error || !data?.accessToken) {
                toast.error('Failed to retrieve MCP URL')

                return
              }

              await window.navigator.clipboard.writeText(
                `${getAPIURL(
                  `/v1/integration/mcpserver/${props.id}/mcp`
                )}?authorization=${data.accessToken}`
              )

              toast.success('MCP URL copied to clipboard')
            } catch {
              toast.error('Failed to copy to clipboard')
            }
          }}
          disabled={disabled}
        >
          Copy MCP URL
        </button>
      </GenericConfigurator.Memo>
    </>
  )
}

McpserverIntegrationConfigurator.Memo = memo(McpserverIntegrationConfigurator)

/**
 *
 */
export function OAuthConnectionConfigurator(props) {
  const getAPIURL = useExternalAPIURL()

  return (
    <>
      <GenericConfigurator.Memo {...props} keepKeys={['clientId']}>
        <button
          className="default-button tiny !text-xxs w-full"
          type="button"
          onClick={async () => {
            try {
              const callbackUrl = getAPIURL(`/oauth/connection/callback`)

              await window.navigator.clipboard.writeText(callbackUrl)

              toast.success('Callback URL copied to clipboard')
            } catch {
              toast.error('Failed to copy to clipboard')
            }
          }}
        >
          Copy Callback URL
        </button>
      </GenericConfigurator.Memo>
    </>
  )
}

OAuthConnectionConfigurator.Memo = memo(OAuthConnectionConfigurator)

/**
 * The catalogue of all basic resources.
 */
export const basicResources = {
  bot: {
    icon: ThinBotMessageSquareIcon,
    barIcon: '@lucide/bot',
    title: 'Bot',
    description: 'An AI bot that can interact with users and perform tasks.',
    commentary:
      'Bots are the central component of any conversational AI. They process user messages, generate responses using an AI model, and can leverage skillsets for additional capabilities. A bot needs a backstory (system prompt) to define its personality and behavior.',
    setup:
      'Create a bot with a name, backstory (system prompt), and optionally connect it to a skillset for abilities and a dataset for knowledge retrieval.',
    schema: getSchemaPropertiesFromSchema(BotType, 'bot'),
    Configurator: BotConfigurator.Memo,
    Frame: memo(IconBox),
    width: DEFAULT_ICONBOX_WIDTH,
    height: DEFAULT_ICONBOX_HEIGHT,
  },

  dataset: {
    icon: ThinDatabaseZapIcon,
    title: 'Dataset',
    description:
      'A collection of records that can be used to provide context to the bot.',
    commentary:
      'Datasets provide knowledge retrieval (RAG) capabilities. They store records that can be searched semantically to provide relevant context to the bot. Connect a dataset to a bot via the datasetId field.',
    setup:
      'Create a dataset and connect it to a bot. Records can be imported via sitemap or notion integrations, or added manually.',
    schema: getSchemaPropertiesFromSchema(DatasetType, 'dataset'),
    Configurator: DatasetConfigurator.Memo,
    Frame: memo(VerticalBox),
    width: DEFAULT_VERTICALBOX_WIDTH,
    height: DEFAULT_VERTICALBOX_HEIGHT,
  },

  skillset: {
    icon: ThinPackageIcon,
    barIcon: '@lucide/package',
    title: 'Skillset',
    description: 'A tool belt that can be used by the bot to perform tasks.',
    commentary:
      'Skillsets are containers for abilities (tools/functions). A bot can only use abilities that are attached to its skillset. Think of a skillset as a toolbox that gives the bot specific capabilities.',
    setup:
      'Create a skillset, add abilities to it, then connect the skillset to a bot.',
    schema: getSchemaPropertiesFromSchema(SkillsetType, 'skillset'),
    Configurator: SkillsetConfigurator.Memo,
    Frame: memo(IconBox),
    width: DEFAULT_ICONBOX_WIDTH,
    height: DEFAULT_ICONBOX_HEIGHT,
  },

  file: {
    icon: '@lucide/file',
    barIcon: '@lucide/file',
    title: 'File',
    description:
      'A file that can be used to provide context to the bot or store data.',
    commentary:
      'Files store documents, images, or data that can be used by bots and abilities. They can be attached to abilities for context or used for file-based operations.',
    setup:
      'Create a file node and optionally connect it to abilities that need file access via linkedFileId.',
    schema: getSchemaPropertiesFromSchema(FileType, 'file'),
    Configurator: FileConfigurator.Memo,
    Frame: memo(VerticalBox),
    width: DEFAULT_VERTICALBOX_WIDTH,
    height: DEFAULT_VERTICALBOX_HEIGHT,
  },

  space: {
    icon: ThinOrbitIcon,
    barIcon: '@lucide/orbit',
    title: 'Space',
    description:
      'A space for organizing conversations and resources associated with a specific contact.',
    commentary:
      'Spaces organize conversations and resources for specific contacts or contexts. They enable multi-tenant scenarios where different users have isolated environments.',
    setup:
      'Create a space and associate conversations or resources with it for organization.',
    schema: getSchemaPropertiesFromSchema(SpaceType, 'space'),
    Configurator: SpaceConfigurator.Memo,
    Frame: memo(IconBox),
    width: DEFAULT_ICONBOX_WIDTH,
    height: DEFAULT_ICONBOX_HEIGHT,
  },

  portal: {
    icon: '@lucide/panels-top-left',
    barIcon: '@lucide/panels-top-left',
    title: 'Portal',
    description:
      'A portal that can be used to provide a user interface to your end-users.',
    commentary:
      'Portals provide a hosted web interface for end-users to interact with your bots. They can be customized with apps (chat, connect) and user access controls.',
    setup:
      'Create a portal with a slug (URL path) and configure which apps and users have access.',
    schema: getSchemaPropertiesFromSchema(PortalType, 'portal'),
    Configurator: PortalConfigurator.Memo,
    Frame: memo(PortalBox),
    width: DEFAULT_PORTALBOX_WIDTH,
    height: DEFAULT_PORTALBOX_HEIGHT,
    data: {
      config: {
        apps: {
          chat: {
            save: true,
            models: true,
            sources: true,
          },
          connect: {},
        },
        users: {
          [`@example.com`]: {},
          [`user@example.com`]: {},
        },
      },
    },
  },
}

/**
 * The catalogue of advanced resources. These are resources that require
 * templates and should not be created via free-form generation. Use the
 * resource-query function pack to search for ability and secret templates.
 */
export const advancedResources = {
  ability: {
    icon: '@lucide/sparkles',
    barIcon: '@lucide/sparkles',
    title: 'Ability',
    description: 'A specific skill or action that the bot can perform.',
    commentary:
      'Abilities are tools/functions that bots can invoke. They should be created from platform templates for pre-built functionality like web search, file operations, or API calls. Abilities must be attached to a skillset. Use the ability catalogue to find and add abilities.',
    schema: getSchemaPropertiesFromSchema(AbilityType, 'ability'),
    Configurator: AbilityConfigurator.Memo,
  },

  secret: {
    icon: ThinKeyRoundIcon,
    barIcon: '@lucide/key-round',
    title: 'Secret',
    description:
      'A secret that can be used to authenticate with external services or store sensitive information.',
    commentary:
      'Secrets store credentials and API keys securely. They should be created from platform templates for OAuth (Google, Slack, etc.) or other pre-configured secret types. Abilities that need authentication should connect to a secret.',
    schema: getSchemaPropertiesFromSchema(SecretType, 'secret'),
    Configurator: SecretConfigurator.Memo,
    // @note used for the icon box
    Frame: memo(IconBox),
    width: DEFAULT_ICONBOX_WIDTH,
    height: DEFAULT_ICONBOX_HEIGHT,
  },

  task: {
    icon: ThinListTodoIcon,
    barIcon: '@lucide/list-todo',
    title: 'Task',
    description:
      'A long-running autonomous job that drives a bot on a schedule or on demand.',
    commentary:
      'A task is a long-running autonomous job: it drives a connected bot toward a goal across many iterations and can keep working for a long time - a single run lasts up to a day, and on a recurring schedule it runs indefinitely. A trigger integration fires one quick bot interaction per inbound event; a task carries out sustained, repeating work. Run it on a schedule (interval, cron, or one-off date) or on demand, and bound each run with optional caps on iterations, time, and tool calls. Connect a task to a bot via botId.',
    setup:
      'Create a task, connect it to a bot, set a schedule (or leave it empty for on-demand only), and optionally cap its iterations, time, and calls.',
    schema: getSchemaPropertiesFromSchema(TaskType, 'task'),
    Configurator: TaskConfigurator.Memo,
    Frame: memo(IconBox),
    width: DEFAULT_ICONBOX_WIDTH,
    height: DEFAULT_ICONBOX_HEIGHT,
    // @note seed a new task node with the platform default execution caps so
    // the limits start at sensible values rather than empty/unbounded
    data: {
      maxIterations: DEFAULT_LIMITS.maxIterations,
      maxTime: DEFAULT_LIMITS.maxTime,
      maxCalls: DEFAULT_LIMITS.maxCalls,
    },
  },

  oAuthConnection: {
    icon: '@lucide/shield-check',
    barIcon: '@lucide/shield-check',
    title: 'OAuth Connection',
    description:
      'An OAuth 2.0 / OpenID Connect identity provider connection for MCP server authentication.',
    commentary:
      'OAuth connections configure an external identity provider (e.g., Okta, Auth0, Azure AD) to authenticate MCP clients. Each connection stores the issuer URL, client credentials, and allowed scopes. Connect to an MCP server integration to enable IdP-based access control.',
    setup:
      'Create an OAuth connection with your IdP issuer URL and client credentials, then attach it to an MCP server integration.',
    schema: getSchemaPropertiesFromSchema(
      OAuthConnectionType,
      'oAuthConnection'
    ),
    Configurator: OAuthConnectionConfigurator.Memo,
    // @note used for the icon box
    Frame: memo(IconBox),
    width: DEFAULT_ICONBOX_WIDTH,
    height: DEFAULT_ICONBOX_HEIGHT,
  },
}

export const complianceResources = {
  policy: {
    icon: '@lucide/shield',
    barIcon: '@lucide/shield',
    title: 'Policy',
    description:
      'A governance rule applied to a bot, such as conversation retention or usage limits.',
    commentary:
      "Policies enforce governance on bots. Retention policies expire conversations after a period; usage policies block the bot or notify when it exceeds a usage threshold within a window. Connect a policy to a bot via the botId field; a policy with no bot applies globally to all of the owner's bots.",
    setup:
      'Create a policy, choose its type (retention or usage) and config, then connect it to a bot. Leave it unconnected to apply it globally.',
    schema: getSchemaPropertiesFromSchema(PolicyType, 'policy'),
    Configurator: PolicyConfigurator.Memo,
    Frame: memo(VerticalBox),
    width: DEFAULT_VERTICALBOX_WIDTH,
    height: DEFAULT_VERTICALBOX_HEIGHT,
  },
}

/**
 * The catalogue of all integration resources.
 */
export const integrationResources = {
  widgetIntegration: {
    icon: items.widget.Icon,
    title: items.widget.title,
    description: 'A web widget that can be embedded on websites.',
    commentary:
      'Widget integrations provide an embeddable chat interface for websites. They support theming, custom layouts, and can be configured with specific bots and behaviors.',
    setup:
      'Create a widget integration, connect it to a bot, then embed the widget code on your website.',
    schema: getSchemaPropertiesFromSchema(
      WidgetIntegrationType,
      'widgetIntegration'
    ),
    Configurator: WidgetIntegrationConfigurator.Memo,
    // @note seed a new node with the platform default session duration
    data: {
      sessionDuration: null,
    },
    // @note used for the icon box
    Frame: memo(IconBox),
    width: DEFAULT_ICONBOX_WIDTH,
    height: DEFAULT_ICONBOX_HEIGHT,
  },

  slackIntegration: {
    icon: items.slack.Icon,
    title: items.slack.title,
    description: 'Connect your bot to Slack workspaces.',
    commentary:
      'Slack integrations allow bots to interact with users in Slack channels and direct messages. Requires Slack app credentials (bot token, signing secret).',
    setup:
      'Create a Slack app, get the bot token and signing secret, then connect to a bot.',
    schema: getSchemaPropertiesFromSchema(
      SlackIntegrationType,
      'slackIntegration'
    ),
    Configurator: SlackIntegrationConfigurator.Memo,
    // @note seed a new node with the platform defaults
    data: {
      attachments: true,
      sessionDuration: ONE_DAY_IN_MILLISECONDS,
    },
    // @note used for the icon box
    Frame: memo(IconBox),
    width: DEFAULT_ICONBOX_WIDTH,
    height: DEFAULT_ICONBOX_HEIGHT,
  },

  discordIntegration: {
    icon: items.discord.Icon,
    title: items.discord.title,
    description: 'Connect your bot to Discord servers.',
    commentary:
      'Discord integrations allow bots to interact with users in Discord servers. Requires Discord bot credentials (bot token, public key).',
    setup:
      'Create a Discord application, get the bot token and public key, then connect to a bot.',
    schema: getSchemaPropertiesFromSchema(
      DiscordIntegrationType,
      'discordIntegration'
    ),
    Configurator: GenericConfigurator.Memo,
    // @note seed a new node with the platform defaults
    data: {
      attachments: true,
      sessionDuration: ONE_DAY_IN_MILLISECONDS,
    },
    // @note used for the icon box
    Frame: memo(IconBox),
    width: DEFAULT_ICONBOX_WIDTH,
    height: DEFAULT_ICONBOX_HEIGHT,
  },

  microsoftteamsIntegration: {
    icon: items.microsoftteams.Icon,
    title: items.microsoftteams.title,
    description: 'Connect your bot to Microsoft Teams.',
    commentary:
      'Teams integrations allow bots to interact with users in Microsoft Teams channels and direct messages. Requires Azure Bot Framework credentials (App ID, App Secret).',
    setup:
      'Register a Bot Framework app in Azure, get the App ID and Secret, then connect to a bot.',
    schema: getSchemaPropertiesFromSchema(
      MicrosoftteamsIntegrationType,
      'microsoftteamsIntegration'
    ),
    Configurator: MicrosoftteamsIntegrationConfigurator.Memo,
    // @note seed a new node with the platform defaults
    data: {
      attachments: true,
      sessionDuration: ONE_DAY_IN_MILLISECONDS,
    },
    // @note used for the icon box
    Frame: memo(IconBox),
    width: DEFAULT_ICONBOX_WIDTH,
    height: DEFAULT_ICONBOX_HEIGHT,
  },

  googlechatIntegration: {
    icon: items.googlechat.Icon,
    title: items.googlechat.title,
    description: 'Connect your bot to Google Chat.',
    commentary:
      'Google Chat integrations allow bots to interact with users in Google Chat spaces and direct messages. Uses a service account for sending replies and JWT verification for incoming events.',
    setup:
      'Create a Google Cloud project, enable the Chat API, create a service account with chat.messages.create scope, then connect to a bot.',
    schema: getSchemaPropertiesFromSchema(
      GooglechatIntegrationType,
      'googlechatIntegration'
    ),
    Configurator: GooglechatIntegrationConfigurator.Memo,
    // @note seed a new node with the platform defaults
    data: {
      attachments: true,
      sessionDuration: ONE_DAY_IN_MILLISECONDS,
    },
    // @note used for the icon box
    Frame: memo(IconBox),
    width: DEFAULT_ICONBOX_WIDTH,
    height: DEFAULT_ICONBOX_HEIGHT,
  },

  whatsappIntegration: {
    icon: items.whatsapp.Icon,
    title: items.whatsapp.title,
    description: 'Connect your bot to WhatsApp Business.',
    commentary:
      'WhatsApp integrations allow bots to interact with users via WhatsApp Business API. Requires Meta Business credentials and access token.',
    setup:
      'Set up WhatsApp Business API access, get the access token, then connect to a bot.',
    schema: getSchemaPropertiesFromSchema(
      WhatsappIntegrationType,
      'whatsappIntegration'
    ),
    Configurator: WhatsappIntegrationConfigurator.Memo,
    // @note seed a new node with the platform defaults
    data: {
      attachments: true,
      sessionDuration: ONE_DAY_IN_MILLISECONDS,
    },
    // @note used for the icon box
    Frame: memo(IconBox),
    width: DEFAULT_ICONBOX_WIDTH,
    height: DEFAULT_ICONBOX_HEIGHT,
  },

  messengerIntegration: {
    icon: items.messenger.Icon,
    title: items.messenger.title,
    description: 'Connect your bot to Facebook Messenger.',
    commentary:
      'Messenger integrations allow bots to interact with users via Facebook Messenger. Requires Meta app credentials and page access token.',
    setup:
      'Create a Facebook app, get page access token, then connect to a bot.',
    schema: getSchemaPropertiesFromSchema(
      MessengerIntegrationType,
      'messengerIntegration'
    ),
    Configurator: MessengerIntegrationConfigurator.Memo,
    // @note seed a new node with the platform defaults
    data: {
      attachments: true,
      sessionDuration: ONE_DAY_IN_MILLISECONDS,
    },
    // @note used for the icon box
    Frame: memo(IconBox),
    width: DEFAULT_ICONBOX_WIDTH,
    height: DEFAULT_ICONBOX_HEIGHT,
  },

  instagramIntegration: {
    icon: items.instagram.Icon,
    title: items.instagram.title,
    description: 'Connect your bot to Instagram Direct.',
    commentary:
      'Instagram integrations allow bots to interact with users via Instagram Direct Messages. Requires Meta app credentials and page access token.',
    setup:
      'Create a Facebook app with Instagram messaging, get page access token, then connect to a bot.',
    schema: getSchemaPropertiesFromSchema(
      InstagramIntegrationType,
      'instagramIntegration'
    ),
    Configurator: InstagramIntegrationConfigurator.Memo,
    // @note seed a new node with the platform defaults
    data: {
      attachments: true,
      sessionDuration: ONE_DAY_IN_MILLISECONDS,
    },
    // @note used for the icon box
    Frame: memo(IconBox),
    width: DEFAULT_ICONBOX_WIDTH,
    height: DEFAULT_ICONBOX_HEIGHT,
  },

  telegramIntegration: {
    icon: items.telegram.Icon,
    title: items.telegram.title,
    description: 'Connect your bot to Telegram.',
    commentary:
      'Telegram integrations allow bots to interact with users via Telegram. Requires a Telegram bot token from BotFather.',
    setup:
      'Create a bot via @BotFather on Telegram, get the bot token, then connect to a bot.',
    schema: getSchemaPropertiesFromSchema(
      TelegramIntegrationType,
      'telegramIntegration'
    ),
    Configurator: TelegramIntegrationConfigurator.Memo,
    // @note seed a new node with the platform defaults
    data: {
      attachments: true,
      sessionDuration: ONE_DAY_IN_MILLISECONDS,
    },
    // @note used for the icon box
    Frame: memo(IconBox),
    width: DEFAULT_ICONBOX_WIDTH,
    height: DEFAULT_ICONBOX_HEIGHT,
  },

  twilioIntegration: {
    icon: items.twilio.Icon,
    title: items.twilio.title,
    description: 'Connect your bot to Twilio SMS.',
    commentary:
      'Twilio integrations allow bots to interact with users via SMS. Requires Twilio account credentials.',
    setup:
      'Set up a Twilio account, configure a phone number, then connect to a bot.',
    schema: getSchemaPropertiesFromSchema(
      TwilioIntegrationType,
      'twilioIntegration'
    ),
    Configurator: GenericConfigurator.Memo,
    // @note seed a new node with the platform default session duration
    data: {
      sessionDuration: ONE_DAY_IN_MILLISECONDS,
    },
    // @note used for the icon box
    Frame: memo(IconBox),
    width: DEFAULT_ICONBOX_WIDTH,
    height: DEFAULT_ICONBOX_HEIGHT,
  },

  emailIntegration: {
    icon: items.email.Icon,
    title: items.email.title,
    description:
      'An inbound email channel that allows users to chat with your bot via email.',
    commentary:
      'Email integrations provide an INBOUND communication channel - users send emails TO the bot, and the bot responds. Each integration gets a unique email address. This is NOT for sending outbound/outreach emails - use email abilities instead.',
    setup:
      'Create an email integration, connect it to a bot, then share the generated email address with users who want to interact with your bot.',
    schema: getSchemaPropertiesFromSchema(
      EmailIntegrationType,
      'emailIntegration'
    ),
    Configurator: EmailIntegrationConfigurator.Memo,
    // @note seed a new node with the platform defaults
    data: {
      attachments: true,
      sessionDuration: ONE_DAY_IN_MILLISECONDS,
    },
    // @note used for the icon box
    Frame: memo(IconBox),
    width: DEFAULT_ICONBOX_WIDTH,
    height: DEFAULT_ICONBOX_HEIGHT,
  },

  triggerIntegration: {
    icon: items.trigger.Icon,
    title: items.trigger.title,
    description: 'Trigger bot conversations via webhooks or schedules.',
    commentary:
      'Trigger integrations allow starting bot conversations programmatically via webhooks or on scheduled intervals. Useful for automated workflows and scheduled tasks.',
    setup:
      'Create a trigger integration, connect it to a bot, then use the webhook URL or configure a schedule.',
    schema: getSchemaPropertiesFromSchema(
      TriggerIntegrationType,
      'triggerIntegration'
    ),
    Configurator: TriggerIntegrationConfigurator.Memo,
    // @note seed a new node with the platform default session duration
    data: {
      sessionDuration: ONE_DAY_IN_MILLISECONDS,
    },
    // @note used for the icon box
    Frame: memo(IconBox),
    width: DEFAULT_ICONBOX_WIDTH,
    height: DEFAULT_ICONBOX_HEIGHT,
  },

  avatarIntegration: {
    icon: items.avatar.Icon,
    title: items.avatar.title,
    description: 'A realtime avatar that can talk to users using your bot.',
    commentary:
      'Avatar integrations provide a hosted video avatar experience for realtime conversations. Connect an avatar integration to a bot, then use its public frame or test page to talk with the avatar.',
    setup:
      'Create an avatar integration, connect it to a bot, configure its visibility, then open the integration page to test or share the avatar frame.',
    schema: getSchemaPropertiesFromSchema(
      AvatarIntegrationType,
      'avatarIntegration'
    ),
    Configurator: AvatarIntegrationConfigurator.Memo,
    Frame: memo(AvatarBox),
    width: DEFAULT_VERTICALBOX_WIDTH,
    height: DEFAULT_VERTICALBOX_HEIGHT,
  },

  anamIntegration: {
    icon: items.anam.Icon,
    title: items.anam.title,
    description:
      'A realtime Anam avatar that can talk to users using your bot.',
    commentary:
      'Anam integrations provide a realtime avatar experience for bot conversations. Connect an Anam integration to a bot, add your Anam API key and persona, then use its hosted frame or test page to talk with the avatar.',
    setup:
      'Create an Anam integration, connect it to a bot, add your Anam API key and persona ID, configure visibility, then open the integration page to test or share the avatar frame.',
    schema: getSchemaPropertiesFromSchema(
      AnamIntegrationType,
      'anamIntegration'
    ),
    Configurator: AnamIntegrationConfigurator.Memo,
    Frame: memo(AnamBox),
    width: DEFAULT_VERTICALBOX_WIDTH,
    height: DEFAULT_VERTICALBOX_HEIGHT,
  },

  recallIntegration: {
    icon: items.recall.Icon,
    title: items.recall.title,
    description: 'Connect your bot to meetings through Recall.',
    commentary:
      'Recall integrations allow bots to join meetings and interact with meeting participants. They require a Recall API key and can optionally be configured for a specific region.',
    setup:
      'Create a Recall integration, connect it to a bot, add your Recall API key, and use Recall abilities to join or manage meetings.',
    schema: getSchemaPropertiesFromSchema(
      RecallIntegrationType,
      'recallIntegration'
    ),
    Configurator: GenericConfigurator.Memo,
    // @note used for the icon box
    Frame: memo(IconBox),
    width: DEFAULT_ICONBOX_WIDTH,
    height: DEFAULT_ICONBOX_HEIGHT,
  },

  githubIntegration: {
    icon: items.github.Icon,
    title: items.github.title,
    description: 'Connect your bot to GitHub repositories.',
    commentary:
      'GitHub integrations let bots reply in issues and pull requests when @mentioned. Requires a GitHub App (App ID, private key, webhook secret).',
    setup:
      'Register a GitHub App, point its webhook at the integration event URL, add the App ID, private key, and webhook secret, then connect to a bot.',
    schema: getSchemaPropertiesFromSchema(
      GithubIntegrationType,
      'githubIntegration'
    ),
    Configurator: GithubIntegrationConfigurator.Memo,
    // @note seed a new node with the platform default session duration
    data: {
      sessionDuration: ONE_DAY_IN_MILLISECONDS,
    },
    // @note used for the icon box
    Frame: memo(IconBox),
    width: DEFAULT_ICONBOX_WIDTH,
    height: DEFAULT_ICONBOX_HEIGHT,
  },

  sitemapIntegration: {
    icon: items.sitemap.Icon,
    title: items.sitemap.title,
    description: 'Import website content into a dataset.',
    commentary:
      'Sitemap integrations crawl websites and import content into datasets for knowledge retrieval. Configure URL patterns and selectors to control what gets imported.',
    setup:
      'Create a sitemap integration, connect it to a dataset, configure the URL and selectors, then sync.',
    schema: getSchemaPropertiesFromSchema(
      SitemapIntegrationType,
      'sitemapIntegration'
    ),
    Configurator: DatasetImporterIntegrationConfigurator.Memo,
    // @note used for the icon box
    Frame: memo(IconBox),
    width: DEFAULT_ICONBOX_WIDTH,
    height: DEFAULT_ICONBOX_HEIGHT,
  },

  notionIntegration: {
    icon: items.notion.Icon,
    title: items.notion.title,
    description: 'Import Notion pages into a dataset.',
    commentary:
      'Notion integrations sync Notion workspace content into datasets for knowledge retrieval. Requires a Notion integration token.',
    setup:
      'Create a Notion integration in your Notion workspace, get the token, connect to a dataset then sync.',
    schema: getSchemaPropertiesFromSchema(
      NotionIntegrationType,
      'notionIntegration'
    ),
    Configurator: DatasetImporterIntegrationConfigurator.Memo,
    // @note used for the icon box
    Frame: memo(IconBox),
    width: DEFAULT_ICONBOX_WIDTH,
    height: DEFAULT_ICONBOX_HEIGHT,
  },

  supportIntegration: {
    icon: items.support.Icon,
    title: items.support.title,
    description: 'Provide customer support escalation capabilities.',
    commentary:
      'Support integrations enable human handoff and escalation workflows. Bots can transfer conversations to human agents when needed.',
    setup:
      'Create a support integration and connect it to a bot to enable escalation.',
    schema: getSchemaPropertiesFromSchema(
      supportIntegrationType,
      'supportIntegration'
    ),
    Configurator: GenericConfigurator.Memo,
    // @note used for the icon box
    Frame: memo(IconBox),
    width: DEFAULT_ICONBOX_WIDTH,
    height: DEFAULT_ICONBOX_HEIGHT,
  },

  extractIntegration: {
    icon: items.extract.Icon,
    title: items.extract.title,
    description: 'Extract structured data from conversations.',
    commentary:
      'Extract integrations define schemas for extracting structured data from conversations. Useful for collecting form-like data through natural conversation.',
    setup:
      'Create an extract integration with a JSON schema defining the data to extract, then connect to a bot.',
    schema: getSchemaPropertiesFromSchema(
      ExtractIntegrationType,
      'extractIntegration'
    ),
    Configurator: GenericConfigurator.Memo,
    // @note used for the icon box
    Frame: memo(IconBox),
    width: DEFAULT_ICONBOX_WIDTH,
    height: DEFAULT_ICONBOX_HEIGHT,
  },

  mcpserverIntegration: {
    icon: items.mcpserver.Icon,
    title: items.mcpserver.title,
    description: 'Expose bot capabilities as an MCP server.',
    commentary:
      'MCP Server integrations expose bot capabilities via the Model Context Protocol, allowing external AI tools to use your bot as a tool provider.',
    setup:
      'Create an MCP server integration, connect it to a skillset, and configure which tools to expose.',
    schema: getSchemaPropertiesFromSchema(
      McpserverIntegrationType,
      'mcpserverIntegration'
    ),
    Configurator: McpserverIntegrationConfigurator.Memo,
    // @note used for the icon box
    Frame: memo(IconBox),
    width: DEFAULT_ICONBOX_WIDTH,
    height: DEFAULT_ICONBOX_HEIGHT,
  },

  skillserverIntegration: {
    icon: items.skillserver.Icon,
    title: items.skillserver.title,
    description: 'Expose a skillset as a text-first HTTP API.',
    commentary:
      'Skill Server integrations expose a skillset over a simple, self-describing HTTP endpoint - an agent reads a manual (GET) and invokes abilities (POST) directly, with no MCP client required.',
    setup:
      'Create a skill server integration and connect it to a skillset. Consumers authenticate with the static access token.',
    schema: getSchemaPropertiesFromSchema(
      SkillserverIntegrationType,
      'skillserverIntegration'
    ),
    Configurator: GenericConfigurator.Memo,
    // @note used for the icon box
    Frame: memo(IconBox),
    width: DEFAULT_ICONBOX_WIDTH,
    height: DEFAULT_ICONBOX_HEIGHT,
  },
}

/**
 * Prefix used to distinguish instruction parameters from schema fields.
 * This allows fields like `skillsetId` to exist both as a schema field
 * (ability belongs to skillset) and as an instruction parameter
 * (ability references another skillset dynamically).
 */
const INSTRUCTION_PARAM_PREFIX = 'instruction:'

/**
 * Suffixes that identify dynamic resource reference fields in ability
 * instructions. These are used to create connection handles in the blueprint
 * designer and to determine how to persist connection values.
 *
 * @note IntegrationId is a suffix pattern (e.g., slackIntegrationId,
 * discordIntegrationId). The exact field names below are matched separately.
 */
const DYNAMIC_RESOURCE_ID_SUFFIXES = ['IntegrationId']

/**
 * Exact field names that identify resource references in ability instructions.
 * These are matched exactly (case-sensitive) rather than as suffixes.
 */
const DYNAMIC_RESOURCE_ID_FIELDS = [
  'botId',
  'datasetId',
  'skillsetId',
  'fileId',
  'secretId',
  'portalId',
  'spaceId',
  'oAuthConnectionId',
]

/**
 * Checks if a field name (without prefix) is a dynamic resource reference field.
 */
function isDynamicResourceField(fieldName) {
  return (
    DYNAMIC_RESOURCE_ID_SUFFIXES.some((suffix) => fieldName.endsWith(suffix)) ||
    DYNAMIC_RESOURCE_ID_FIELDS.includes(fieldName)
  )
}

/**
 * Checks if a handle ID is an instruction parameter (has the prefix).
 */
function isInstructionParamHandle(handleId) {
  return handleId.startsWith(INSTRUCTION_PARAM_PREFIX)
}

/**
 * Extracts the actual parameter name from a prefixed handle ID.
 */
function getParamNameFromHandle(handleId) {
  if (isInstructionParamHandle(handleId)) {
    return handleId.slice(INSTRUCTION_PARAM_PREFIX.length)
  }

  return handleId
}

/**
 * Builds a human-readable tooltip for connection handles.
 */
function getHandleTooltip(handleId, handleType) {
  if (!handleId) {
    return 'Connection handle'
  }

  const isInstructionHandle = isInstructionParamHandle(handleId)
  const baseHandleId = isInstructionHandle
    ? getParamNameFromHandle(handleId)
    : handleId

  const normalizedHandleName =
    baseHandleId === 'skillsetForAbility'
      ? 'ability skillset'
      : getReferenceFieldType(baseHandleId) || baseHandleId

  const label = toHeadingCase(
    normalizedHandleName.replace(/([a-z])([A-Z])/g, '$1 $2')
  )

  if (isInstructionHandle) {
    return `Instruction field: ${label}`
  }

  return handleType === 'source' ? `Connect to ${label}` : `Accepts ${label}`
}

/**
 * Creates a prefixed handle ID for an instruction parameter.
 */
function createInstructionParamHandle(paramName) {
  return `${INSTRUCTION_PARAM_PREFIX}${paramName}`
}

/**
 * Extracts resource reference fields from an ability instruction.
 *
 * @note This function parses the instruction to find fields that reference
 * other resources by their ID (e.g., slackIntegrationId, discordIntegrationId).
 * These are used to create dynamic connection handles in the blueprint
 * designer.
 *
 * @note Returns prefixed handle IDs (e.g., instruction:skillsetId) to
 * distinguish from schema-level fields.
 */
function extractInstructionReferenceFields(instruction) {
  if (!instruction) {
    return []
  }

  try {
    const { parameters } = parseTemplateInstruction(instruction)

    // Find keys that match resource ID patterns and prefix them

    return Object.keys(parameters)
      .filter(isDynamicResourceField)
      .map(createInstructionParamHandle)
  } catch {
    return []
  }
}

/**
 * Updates an instruction parameter value and returns the new instruction
 * string.
 *
 * @note This is used to persist connection values in the instruction YAML when
 * connecting/disconnecting dynamic handles.
 *
 * @note The handleId may be prefixed (e.g., instruction:skillsetId) - the
 * prefix is stripped before updating the actual instruction parameter.
 *
 * @note only updates parameters that already exist in the instruction to avoid
 * injecting parameters that the template doesn't define
 */
function updateInstructionParameter(instruction, handleId, value) {
  if (!instruction) {
    return instruction
  }

  // Strip the prefix to get the actual parameter name

  const paramName = getParamNameFromHandle(handleId)

  try {
    const { template, parameters } = parseTemplateInstruction(instruction)

    // @note only update parameters that already exist in the instruction

    if (!(paramName in parameters)) {
      return instruction
    }

    // Update the parameter

    const updatedParameters = {
      ...parameters,

      [paramName]: value ?? '',
    }

    // Rebuild the instruction string

    return buildTemplateInstruction({
      template: template,
      params: updatedParameters,
    })
  } catch {
    return instruction
  }
}

/**
 * Applies a connected reference edge to the source node data.
 *
 * @param {object} node
 * @param {{sourceHandle?: string, target?: string}} edge
 * @returns {object}
 */
export function applyConnectionEdgeToNode(node, edge) {
  if (
    node?.type === 'tool:errorLog' &&
    isErrorLogToolResourceHandle(edge?.sourceHandle)
  ) {
    const nextResource = {
      type: edge.targetHandle,
      id: edge.target,
    }

    if (
      !isErrorLogToolResourceType(nextResource.type) ||
      typeof nextResource.id !== 'string' ||
      !nextResource.id
    ) {
      return node
    }

    const resources = Array.isArray(
      node.data?.[ERROR_LOG_TOOL_RESOURCE_DATA_KEY]
    )
      ? node.data[ERROR_LOG_TOOL_RESOURCE_DATA_KEY]
      : []

    if (
      resources.some(
        (resource) =>
          resource?.type === nextResource.type &&
          resource?.id === nextResource.id
      )
    ) {
      return node
    }

    return {
      ...node,

      data: {
        ...node.data,

        [ERROR_LOG_TOOL_RESOURCE_DATA_KEY]: [...resources, nextResource],
      },
    }
  }

  if (
    !node ||
    !edge?.sourceHandle ||
    !isDataDrivenReferenceHandle(edge.sourceHandle)
  ) {
    return node
  }

  if (node.type === 'ability' && isInstructionParamHandle(edge.sourceHandle)) {
    const updatedInstruction = updateInstructionParameter(
      node.data?.instruction,
      edge.sourceHandle,
      edge.target
    )

    if (updatedInstruction === node.data?.instruction) {
      return node
    }

    return {
      ...node,

      data: {
        ...node.data,

        instruction: updatedInstruction,
      },
    }
  }

  if (node.data?.[edge.sourceHandle] === edge.target) {
    return node
  }

  return {
    ...node,

    data: {
      ...node.data,

      [edge.sourceHandle]: edge.target,
    },
  }
}

/**
 * Clears a disconnected reference edge from the source node data.
 *
 * @param {object} node
 * @param {{sourceHandle?: string}} edge
 * @returns {object}
 */
export function clearConnectionEdgeFromNode(node, edge) {
  if (
    node?.type === 'tool:errorLog' &&
    isErrorLogToolResourceHandle(edge?.sourceHandle)
  ) {
    const resources = Array.isArray(
      node.data?.[ERROR_LOG_TOOL_RESOURCE_DATA_KEY]
    )
      ? node.data[ERROR_LOG_TOOL_RESOURCE_DATA_KEY]
      : []

    const nextResources = resources.filter(
      (resource) =>
        resource?.type !== edge.targetHandle || resource?.id !== edge.target
    )

    if (nextResources.length === resources.length) {
      return node
    }

    return {
      ...node,

      data: {
        ...node.data,

        [ERROR_LOG_TOOL_RESOURCE_DATA_KEY]: nextResources,
      },
    }
  }

  if (
    !node ||
    !edge?.sourceHandle ||
    !isDataDrivenReferenceHandle(edge.sourceHandle)
  ) {
    return node
  }

  if (node.type === 'ability' && isInstructionParamHandle(edge.sourceHandle)) {
    const updatedInstruction = updateInstructionParameter(
      node.data?.instruction,
      edge.sourceHandle,
      ''
    )

    if (updatedInstruction === node.data?.instruction) {
      return node
    }

    return {
      ...node,

      data: {
        ...node.data,

        instruction: updatedInstruction,
      },
    }
  }

  if (node.data?.[edge.sourceHandle] == null) {
    return node
  }

  return {
    ...node,

    data: {
      ...node.data,

      [edge.sourceHandle]: null,
    },
  }
}

/**
 * Remaps resource reference values inside an ability template instruction.
 * Only dynamic resource reference fields are considered.
 *
 * @param {string} instruction
 * @param {Record<string, string>} referenceMap
 * @returns {string}
 */
export function remapInstructionParameterReferences(
  instruction,
  referenceMap = {}
) {
  if (!instruction || typeof instruction !== 'string') {
    return instruction
  }

  try {
    const { template, parameters } = parseTemplateInstruction(instruction)
    const updatedParameters = { ...parameters }

    let hasUpdates = false

    for (const [key, value] of Object.entries(updatedParameters)) {
      if (!isDynamicResourceField(key) || typeof value !== 'string') {
        continue
      }

      const remappedValue = referenceMap[value]

      if (!remappedValue || remappedValue === value) {
        continue
      }

      updatedParameters[key] = remappedValue
      hasUpdates = true
    }

    if (!hasUpdates) {
      return instruction
    }

    return buildTemplateInstruction({
      template,
      params: updatedParameters,
    })
  } catch {
    return instruction
  }
}

/**
 * Collects all resource reference entries from node data, including ability
 * template parameters that point at other resources.
 *
 * @param {Record<string, any>} data
 * @returns {Array<{key: string, value: string, sourceHandle: string, targetHandle: string}>}
 */
export function getResourceReferenceEntries(data = {}) {
  const entries = []

  for (const [key, value] of Object.entries(data)) {
    if (!key.endsWith('Id') || typeof value !== 'string' || !value) {
      continue
    }

    entries.push({
      key,
      value,
      sourceHandle: key,
      targetHandle: getReferenceFieldType(key),
    })
  }

  if (!data.instruction || typeof data.instruction !== 'string') {
    return entries
  }

  try {
    const { parameters } = parseTemplateInstruction(data.instruction)

    for (const [key, value] of Object.entries(parameters)) {
      if (!isDynamicResourceField(key) || typeof value !== 'string' || !value) {
        continue
      }

      entries.push({
        key,
        value,
        sourceHandle: createInstructionParamHandle(key),
        targetHandle: getReferenceFieldType(key),
      })
    }
  } catch {
    return entries
  }

  return entries
}

/**
 * Returns the target handle used for a reference edge.
 */
function getReferenceEdgeTargetHandle(nodeType, sourceHandle, targetHandle) {
  if (
    nodeType === 'ability' &&
    sourceHandle === 'skillsetId' &&
    targetHandle === 'skillset'
  ) {
    return 'skillsetForAbility'
  }

  return targetHandle
}

/**
 * Returns whether a node type manages reference edges from its data.
 */
function hasDataDrivenReferenceEdges(nodeType) {
  return !isAnnotationNodeType(nodeType)
}

/**
 * Returns whether an edge handle is managed by reference-edge sync.
 */
function isDataDrivenReferenceHandle(handleId) {
  if (isErrorLogToolResourceHandle(handleId)) {
    return true
  }

  const baseHandleId = isInstructionParamHandle(handleId)
    ? getParamNameFromHandle(handleId)
    : handleId

  return baseHandleId.endsWith('Id')
}

// @note Integration type lists for auto-connect logic

export const BOT_INTEGRATION_TYPES = [
  'widgetIntegration',
  'slackIntegration',
  'discordIntegration',
  'microsoftteamsIntegration',
  'googlechatIntegration',
  'whatsappIntegration',
  'messengerIntegration',
  'instagramIntegration',
  'telegramIntegration',
  'twilioIntegration',
  'emailIntegration',
  'triggerIntegration',
  'supportIntegration',
  'extractIntegration',
]

export const DATASET_INTEGRATION_TYPES = [
  'sitemapIntegration',
  'notionIntegration',
]

export const SKILLSET_INTEGRATION_TYPES = [
  'mcpserverIntegration',
  'skillserverIntegration',
]

// @note Maximum distance threshold for automatic node connections

export const MAX_AUTO_CONNECT_DISTANCE = 1000

/**
 * Computes the auto-connections that should be made when a new node is dropped.
 *
 * This is a pure function that returns what node updates and edges should be
 * created, without performing any mutations.
 *
 * @param {Object} options
 * @param {Object} options.newNode - The newly dropped node
 * @param {Array} options.existingNodes - Nodes already in the graph
 * @param {Array} options.existingEdges - Edges already in the graph
 * @param {string} options.resourceType - The type of resource being dropped
 * @param {Object} options.allResources - Resource definitions (for custom ability types)
 * @param {Function} [options.generateEdgeId] - Optional function to generate edge IDs
 * @returns {{ nodeUpdates: Array, edgesToCreate: Array }}
 */
export function computeAutoConnections({
  newNode,
  existingNodes,
  existingEdges,
  resourceType,
  allResources,
  generateEdgeId = () => getRandomId('#edge:::'),
}) {
  const nodeUpdates = []
  const edgesToCreate = []

  // Helper to calculate distance between two nodes
  const getDistance = (nodeA, nodeB) => {
    const dx = nodeA.position.x - nodeB.position.x
    const dy = nodeA.position.y - nodeB.position.y

    return Math.sqrt(dx * dx + dy * dy)
  }

  // Helper to sort nodes by proximity to newNode
  const sortByProximity = (a, b) => {
    return getDistance(a, newNode) - getDistance(b, newNode)
  }

  // Dataset dropped: connect to nearest bot without existing dataset connection
  if (resourceType === 'dataset') {
    const botNodes = existingNodes.filter(({ type }) => type === 'bot')
    const datasetNodes = existingNodes.filter(({ type }) => type === 'dataset')

    const botNodeIds = new Set(botNodes.map(({ id }) => id))
    const datasetNodeIds = new Set(datasetNodes.map(({ id }) => id))

    const botNodeIdsWithDatasetEdges = new Set(
      existingEdges
        .filter(
          ({ source, target, sourceHandle }) =>
            botNodeIds.has(source) &&
            datasetNodeIds.has(target) &&
            sourceHandle === 'datasetId'
        )
        .map(({ source }) => source)
    )

    const availableBotNode = botNodes
      .filter(({ id }) => !botNodeIdsWithDatasetEdges.has(id))
      .sort(sortByProximity)
      .shift()

    if (
      availableBotNode &&
      getDistance(availableBotNode, newNode) <= MAX_AUTO_CONNECT_DISTANCE
    ) {
      nodeUpdates.push({
        nodeId: availableBotNode.id,
        field: 'datasetId',
        value: newNode.id,
        isNewNode: false, // updating existing bot node
      })

      edgesToCreate.push({
        id: generateEdgeId(),
        source: availableBotNode.id,
        sourceHandle: 'datasetId',
        target: newNode.id,
        targetHandle: 'dataset',
        type: 'default',
      })
    }
  }

  // Skillset dropped: connect to nearest bot without existing skillset connection
  if (resourceType === 'skillset') {
    const botNodes = existingNodes.filter(({ type }) => type === 'bot')
    const skillsetNodes = existingNodes.filter(
      ({ type }) => type === 'skillset'
    )

    const botNodeIds = new Set(botNodes.map(({ id }) => id))
    const skillsetNodeIds = new Set(skillsetNodes.map(({ id }) => id))

    const botNodeIdsWithSkillsetEdges = new Set(
      existingEdges
        .filter(
          ({ source, target, sourceHandle }) =>
            botNodeIds.has(source) &&
            skillsetNodeIds.has(target) &&
            sourceHandle === 'skillsetId'
        )
        .map(({ source }) => source)
    )

    const availableBotNode = botNodes
      .filter(({ id }) => !botNodeIdsWithSkillsetEdges.has(id))
      .sort(sortByProximity)
      .shift()

    if (
      availableBotNode &&
      getDistance(availableBotNode, newNode) <= MAX_AUTO_CONNECT_DISTANCE
    ) {
      nodeUpdates.push({
        nodeId: availableBotNode.id,
        field: 'skillsetId',
        value: newNode.id,
        isNewNode: false, // updating existing bot node
      })

      edgesToCreate.push({
        id: generateEdgeId(),
        source: availableBotNode.id,
        sourceHandle: 'skillsetId',
        target: newNode.id,
        targetHandle: 'skillset',
        type: 'default',
      })
    }
  }

  // Ability dropped: connect to nearest skillset
  const isAbilityType =
    resourceType === 'ability' || allResources[resourceType]?.type === 'ability'

  if (isAbilityType) {
    const skillsetNode = existingNodes
      .filter(({ type }) => type === 'skillset')
      .sort(sortByProximity)
      .shift()

    if (
      skillsetNode &&
      getDistance(skillsetNode, newNode) <= MAX_AUTO_CONNECT_DISTANCE
    ) {
      nodeUpdates.push({
        nodeId: newNode.id,
        field: 'skillsetId',
        value: skillsetNode.id,
        isNewNode: true, // updating the newly added node
      })

      edgesToCreate.push({
        id: generateEdgeId(),
        source: newNode.id,
        sourceHandle: 'skillsetId',
        target: skillsetNode.id,
        targetHandle: 'skillset',
        type: 'default',
      })
    }
  }

  // Bot integration dropped: connect to nearest bot
  if (BOT_INTEGRATION_TYPES.includes(resourceType)) {
    const botNode = existingNodes
      .filter(({ type }) => type === 'bot')
      .sort(sortByProximity)
      .shift()

    if (botNode && getDistance(botNode, newNode) <= MAX_AUTO_CONNECT_DISTANCE) {
      nodeUpdates.push({
        nodeId: newNode.id,
        field: 'botId',
        value: botNode.id,
        isNewNode: true, // updating the newly added node
      })

      edgesToCreate.push({
        id: generateEdgeId(),
        source: newNode.id,
        sourceHandle: 'botId',
        target: botNode.id,
        targetHandle: 'bot',
        type: 'default',
      })
    }
  }

  // Dataset integration dropped: connect to nearest dataset
  if (DATASET_INTEGRATION_TYPES.includes(resourceType)) {
    const datasetNode = existingNodes
      .filter(({ type }) => type === 'dataset')
      .sort(sortByProximity)
      .shift()

    if (
      datasetNode &&
      getDistance(datasetNode, newNode) <= MAX_AUTO_CONNECT_DISTANCE
    ) {
      nodeUpdates.push({
        nodeId: newNode.id,
        field: 'datasetId',
        value: datasetNode.id,
        isNewNode: true, // updating the newly added node
      })

      edgesToCreate.push({
        id: generateEdgeId(),
        source: newNode.id,
        sourceHandle: 'datasetId',
        target: datasetNode.id,
        targetHandle: 'dataset',
        type: 'default',
      })
    }
  }

  // Skillset integration dropped: connect to nearest skillset
  if (SKILLSET_INTEGRATION_TYPES.includes(resourceType)) {
    const skillsetNode = existingNodes
      .filter(({ type }) => type === 'skillset')
      .sort(sortByProximity)
      .shift()

    if (
      skillsetNode &&
      getDistance(skillsetNode, newNode) <= MAX_AUTO_CONNECT_DISTANCE
    ) {
      nodeUpdates.push({
        nodeId: newNode.id,
        field: 'skillsetId',
        value: skillsetNode.id,
        isNewNode: true, // updating the newly added node
      })

      edgesToCreate.push({
        id: generateEdgeId(),
        source: newNode.id,
        sourceHandle: 'skillsetId',
        target: skillsetNode.id,
        targetHandle: 'skillset',
        type: 'default',
      })
    }
  }

  return { nodeUpdates, edgesToCreate }
}

/**
 * Syncs graph edges to match top-level and instruction-derived references in
 * node data.
 */
export function syncEdgesWithNodeReferences({ nodes, edges }) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const nodeIds = new Set(nodeMap.keys())

  const managedEdgeMap = new Map()

  edges.forEach((edge) => {
    const sourceNode = nodeMap.get(edge.source)

    if (
      !sourceNode ||
      !hasDataDrivenReferenceEdges(sourceNode.type) ||
      !isDataDrivenReferenceHandle(edge.sourceHandle)
    ) {
      return
    }

    managedEdgeMap.set(
      `${edge.source}:::${edge.sourceHandle}:::${edge.target}:::${edge.targetHandle}`,
      edge
    )
  })

  const syncedEdges = edges.filter((edge) => {
    const sourceNode = nodeMap.get(edge.source)

    return !(
      sourceNode &&
      hasDataDrivenReferenceEdges(sourceNode.type) &&
      isDataDrivenReferenceHandle(edge.sourceHandle)
    )
  })

  nodes.forEach((node) => {
    if (!hasDataDrivenReferenceEdges(node.type)) {
      return
    }

    const referenceEntries =
      node.type === 'tool:errorLog'
        ? getErrorLogToolResourceEntries(node.data || {})
        : getResourceReferenceEntries(node.data || {})

    referenceEntries.forEach(({ value, sourceHandle, targetHandle }) => {
      if (typeof value !== 'string' || !value || !nodeIds.has(value)) {
        return
      }

      const resolvedTargetHandle = getReferenceEdgeTargetHandle(
        node.type,
        sourceHandle,
        targetHandle
      )

      const edgeKey = `${node.id}:::${sourceHandle}:::${value}:::${resolvedTargetHandle}`
      const existingEdge = managedEdgeMap.get(edgeKey)

      syncedEdges.push(
        existingEdge || {
          id: getRandomId('#'),
          source: node.id,
          sourceHandle,
          target: value,
          targetHandle: resolvedTargetHandle,
          type: 'default',
          animated: true,
        }
      )
    })
  })

  return syncedEdges
}

/**
 * Build ability resources from platform abilities data.
 */
export function buildAbilityResources(abilitiesData, secretsData) {
  return {
    ...Object.fromEntries(
      Object.entries(abilitiesData)
        // @note we do the filtering inside the toolbar to ensure blueprints work
        // even when the resource is in alpha state
        // .filter(([, { tags }]) => {
        //   if (isProduction) {
        //     return !tags?.includes('alpha')
        //   }

        //   return !tags?.includes('hidden')
        // })
        .sort(([, a], [, b]) => {
          // @note examples must be shown last

          if (a.example && !b.example) {
            return 1
          }

          if (!a.example && b.example) {
            return -1
          }

          return 0
        })
        .map(
          ([
            id,
            {
              icon,

              name,
              description,

              instruction,

              properties,

              commentary,

              setup,

              tags,

              secret,
              file,
              space,
              bot,

              ...rest
            },
          ]) => {
            let thisInstruction = instruction

            let thisSecret

            {
              if (secret) {
                // @note placeholder references (e.g., #secret) are used to create
                // connection handles in the designer but don't need to link to
                // actual resource templates - set truthy value to show handle
                if (secret.startsWith('#')) {
                  thisSecret = true
                } else {
                  // @note the icon is only used for the template, the rest of the
                  // properties should be compatible with the data structure

                  // @note platform-hosted secret templates exist only when the
                  // platform secrets catalogue is installed - fall back to the
                  // standard variant, or to no secret at all, so the ability
                  // remains usable without it; catalogue shape is guarded by
                  // unit tests rather than at runtime

                  const template =
                    getTemplate(secret, secretsData) ||
                    (secret.startsWith('@platform/')
                      ? getTemplate(
                          secret.replace(/^@platform\//, '@'),
                          secretsData
                        )
                      : null)

                  if (template) {
                    thisSecret = omit(template, [
                      'icon',
                      'tags',
                      'setup',
                      'commentary',
                      'hidden',
                    ])
                  }
                }
              }
            }

            let thisFile

            {
              if (file) {
                // @note placeholder references (e.g., #file) are used to create
                // connection handles in the designer but don't need to link to
                // actual resource templates - set truthy value to show handle
                if (file.startsWith('#')) {
                  thisFile = true
                } else {
                  // @note the icon is only used for the template, the rest of the
                  // properties should be compatible with the data structure

                  const template = getTemplate(file, filesData)

                  thisFile = omit(template, ['icon'])

                  // @note ensure that the file has the correct configuration at
                  // compile-time

                  assert(
                    FileType.strict().safeParse(thisFile).success,
                    `File ${file} has the correct configuration`
                  )
                }
              }
            }

            let thisSpace

            {
              if (space) {
                // @note placeholder references (e.g., #space) are used to create
                // connection handles in the designer but don't need to link to
                // actual resource templates - set truthy value to show handle
                if (space.startsWith('#')) {
                  thisSpace = true
                } else {
                  // @note the icon is only used for the template, the rest of the
                  // properties should be compatible with the data structure

                  const template = getTemplate(space, spacesData)

                  thisSpace = omit(template, ['icon'])

                  // @note ensure that the space has the correct configuration at
                  // compile-time

                  assert(
                    SpaceType.strict().safeParse(thisSpace).success,
                    `Space ${space} has the correct configuration`
                  )
                }
              }
            }

            let thisBot

            {
              if (bot) {
                // @note placeholder references (e.g., #bot) are used to create
                // connection handles in the designer but don't need to link to
                // actual resource templates - set truthy value to show handle
                if (bot.startsWith('#') || bot.startsWith('@')) {
                  thisBot = true
                } else {
                  // @note for bot references that are not placeholders, we just
                  // set truthy value as bots don't have a catalogue like secrets
                  thisBot = true
                }
              }
            }

            return [
              id,
              {
                ...rest,

                icon: toThemeAwareIcon(icon) || advancedResources.ability.icon,

                title: name,
                description: description,

                instruction: thisInstruction,

                properties: properties,

                keywords: tags,

                commentary: commentary,

                setup: setup,

                schema: advancedResources.ability.schema,

                Configurator: advancedResources.ability.Configurator,

                type: 'ability',

                // @note extract fields from instruction that reference other
                // resources (e.g., slackIntegrationId) to create dynamic
                // connection handles

                additionalSourceConnections:
                  extractInstructionReferenceFields(thisInstruction),

                data: {
                  name: name,
                  description: description,
                  instruction: thisInstruction,
                },

                secret: thisSecret,

                file: thisFile,

                space: thisSpace,

                bot: thisBot,

                tags: [
                  ...[...id.matchAll(/\[(.*?)\]/g)].map((m) =>
                    m[1].replace(/\W+/g, ' ')
                  ),
                  ...(tags?.includes('features') ? ['★'] : []),
                  ...(tags?.includes('new') ? ['new'] : []),
                  ...(tags?.includes('alpha') ? ['alpha'] : []),
                  ...(tags?.includes('beta') ? ['beta'] : []),
                  ...(id.startsWith('example/') ? ['example'] : []),
                  // ...(id.startsWith('mock/') ? ['mock'] : []),
                  // ...(id.startsWith('pack/') ? ['pack'] : []),
                ],
              },
            ]
          }
        )
    ),
  }
}

/**
 * Build secret resources from platform secrets data.
 */
export function buildSecretResources(secretsData) {
  return {
    ...Object.fromEntries(
      Object.entries(secretsData)
        // @note we do the filtering inside the toolbar to ensure blueprints work
        // even when the resource is in alpha state
        // .filter(([, { tags }]) => {
        //   if (isProduction) {
        //     return !tags?.includes('alpha')
        //   }

        //   return !tags?.includes('hidden')
        // })
        .sort(([idA], [idB]) => {
          // @note keep platform templates first, then MCP templates, then all others

          const getSecretSortRank = (id) => {
            if (id.startsWith('platform/')) {
              return 0
            }

            if (id.endsWith('[mcp]')) {
              return 1
            }

            return 2
          }

          return getSecretSortRank(idA) - getSecretSortRank(idB)
        })
        .map(
          ([
            id,
            {
              icon,

              name,
              description,

              commentary,

              setup,

              type,

              kind,

              config,

              tags,

              ...rest
            },
          ]) => {
            return [
              id,
              {
                ...rest,

                icon: toThemeAwareIcon(icon) || advancedResources.secret.icon,

                barIcon: advancedResources.secret.barIcon,

                title: name,

                description: description,

                keywords: tags,

                commentary: commentary,

                setup: setup,

                schema: advancedResources.secret.schema,

                Configurator: advancedResources.secret.Configurator,

                Frame: advancedResources.secret.Frame,

                width: advancedResources.secret.width,
                height: advancedResources.secret.height,

                type: 'secret',

                data: {
                  name: name,
                  description: description,
                  type: type,
                  kind: kind,
                  config: config,
                },

                tags: [
                  ...[...id.matchAll(/\[(.*?)\]/g)].map((m) =>
                    m[1].replace(/\W+/g, ' ')
                  ),
                  ...(tags?.includes('features') ? ['★'] : []),
                  ...(tags?.includes('new') ? ['new'] : []),
                  ...(tags?.includes('alpha') ? ['alpha'] : []),
                  ...(tags?.includes('beta') ? ['beta'] : []),
                  ...(id.startsWith('example/') ? ['example'] : []),
                  ...(id.startsWith('platform/') ? ['platform'] : []),
                ],
              },
            ]
          }
        )
    ),
  }
}

/**
 * Build all resources from platform data.
 */
export function buildAllResources(abilityResources, secretResources) {
  return {
    ...basicResources,
    ...advancedResources,
    ...complianceResources,
    ...integrationResources,
    ...abilityResources,
    ...secretResources,
  }
}

/**
 * Maps a resource type name to its API URL segment.
 *
 * @param {string} type - camelCase resource type (e.g. 'oAuthConnection', 'widgetIntegration')
 * @returns {string}
 */
export function getTypeApiPath(type) {
  const lower = type.toLowerCase()

  // @note oAuthConnection -> oauth/connection (does not follow the *Integration pattern)
  if (lower === 'oauthconnection') {
    return 'oauth/connection'
  }

  return lower.replace(/^(.*?)integration$/, 'integration/$1')
}

/**
 *
 */
export function normalizeBlueprintResourceData(type, data) {
  const normalizedData = {
    ...omit(data || {}, [/^(_|[A-Z]|.*\s+.*)/]),
  }

  if (
    type === 'secret' &&
    ['oauth', 'template'].includes(normalizedData.type)
  ) {
    delete normalizedData.value
  }

  if (type === 'ability') {
    const { properties } = zodToJsonSchema(AbilityType)
    const keys = Object.keys(properties)

    for (const key of Object.keys(normalizedData)) {
      if (!keys.includes(key)) {
        delete normalizedData[key]
      }
    }
  }

  return normalizedData
}

/**
 *
 */
export function normalizeBlueprintChangeNodes(nodes) {
  return nodes
    .map(({ id, type, data, position, width, height }) => ({
      id,
      data: isNonResourceNodeType(type)
        ? data
        : normalizeBlueprintResourceData(type, data),
      position,
      // @note only include width/height for notes, images, frames, and tools
      // since they're user-resizable and persisted. For regular resource nodes,
      // width/height are computed from constants and ReactFlow may modify them
      // internally, causing false positives in change detection.
      ...(isNonResourceNodeType(type) ? { width, height } : {}),
    }))
    .sort(({ id: a }, { id: b }) => a.localeCompare(b))
}

/**
 * Filters out edges whose source or target node no longer exists.
 */
export function filterEdgesWithExistingNodes(edges, nodes) {
  const nodeIds = new Set(nodes.map((node) => node.id))

  return edges.filter(
    (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)
  )
}

/**
 *
 */
export function normalizeBlueprintChangeEdges(edges) {
  function normalizeTargetHandle(sourceHandle, targetHandle) {
    // @note skillsetForAbility is a routing-only variant of the same
    // skillsetId relationship used for ability edges
    if (
      sourceHandle === 'skillsetId' &&
      (targetHandle === 'skillset' || targetHandle === 'skillsetForAbility')
    ) {
      return 'skillset'
    }

    return targetHandle
  }

  function makeObjectId(object) {
    let id = ''

    for (const key of Object.keys(object).sort()) {
      id += key + object[key]
    }

    return id
  }

  return edges
    .map(({ source, sourceHandle, target, targetHandle }) => ({
      source,
      sourceHandle,
      target,
      targetHandle: normalizeTargetHandle(sourceHandle, targetHandle),
    }))
    .sort((a, b) => makeObjectId(a).localeCompare(makeObjectId(b)))
}

/**
 *
 */
export function getBlueprintGraphChangeDiagnostics({
  blueprintNodes,
  changedNodes,
  blueprintEdges,
  changedEdges,
}) {
  const normalizedBlueprintNodes = normalizeBlueprintChangeNodes(blueprintNodes)
  const normalizedChangedNodes = normalizeBlueprintChangeNodes(changedNodes)
  const normalizedBlueprintEdges = normalizeBlueprintChangeEdges(blueprintEdges)
  const normalizedChangedEdges = normalizeBlueprintChangeEdges(changedEdges)

  const hasNodeChanges = !equal(
    normalizedBlueprintNodes,
    normalizedChangedNodes
  )
  const hasEdgeChanges = !equal(
    normalizedBlueprintEdges,
    normalizedChangedEdges
  )

  const blueprintNodeMap = new Map(
    normalizedBlueprintNodes.map((node) => [node.id, node])
  )
  const changedNodeMap = new Map(
    normalizedChangedNodes.map((node) => [node.id, node])
  )

  const onlyInBlueprint = normalizedBlueprintNodes.filter(
    (node) => !changedNodeMap.has(node.id)
  )
  const onlyInChanged = normalizedChangedNodes.filter(
    (node) => !blueprintNodeMap.has(node.id)
  )

  const fieldDiffs = normalizedBlueprintNodes
    .filter((node) => changedNodeMap.has(node.id))
    .map((blueprintNode) => {
      const changedNode = changedNodeMap.get(blueprintNode.id)
      const diff = { id: blueprintNode.id }

      if (!equal(blueprintNode.data, changedNode.data)) {
        diff.data = {
          blueprint: blueprintNode.data,
          changed: changedNode.data,
        }
      }

      if (!equal(blueprintNode.position, changedNode.position)) {
        diff.position = {
          blueprint: blueprintNode.position,
          changed: changedNode.position,
        }
      }

      if (
        !equal(
          {
            width: blueprintNode.width,
            height: blueprintNode.height,
          },
          {
            width: changedNode.width,
            height: changedNode.height,
          }
        )
      ) {
        diff.size = {
          blueprint: {
            width: blueprintNode.width,
            height: blueprintNode.height,
          },
          changed: {
            width: changedNode.width,
            height: changedNode.height,
          },
        }
      }

      return Object.keys(diff).length > 1 ? diff : null
    })
    .filter(Boolean)

  return {
    hasChanges: hasNodeChanges || hasEdgeChanges,
    hasNodeChanges,
    hasEdgeChanges,
    nodeDiff: {
      onlyInBlueprint,
      onlyInChanged,
      fieldDiffs,
    },
    edgeDiff: {
      blueprintEdges: normalizedBlueprintEdges,
      changedEdges: normalizedChangedEdges,
    },
  }
}

/**
 *
 */
export function hasBlueprintGraphChanges({
  blueprintNodes,
  changedNodes,
  blueprintEdges,
  changedEdges,
}) {
  return getBlueprintGraphChangeDiagnostics({
    blueprintNodes,
    changedNodes,
    blueprintEdges,
    changedEdges,
  }).hasChanges
}

/**
 *
 */
export const ResourcesContext = createContext({
  allResources: {},
  abilityResources: {},
  secretResources: {},
  nodeTypes: {},
  mode: null,
})

/**
 *
 */
function useResources() {
  return useContext(ResourcesContext)
}

/**
 * Returns whether canvas-level keyboard shortcuts should be ignored because
 * focus or selection is inside an editable area.
 *
 * @param {object} options
 * @param {Element | null} [options.activeElement]
 * @param {Selection | null} [options.selection]
 * @param {boolean} [options.checkSelection=false]
 * @returns {boolean}
 */
export function shouldSkipCanvasKeyboardShortcut({
  activeElement = typeof document !== 'undefined'
    ? document.activeElement
    : null,
  selection = typeof window !== 'undefined' ? window.getSelection() : null,
  checkSelection = false,
} = {}) {
  const isEditableElement = (element) => {
    if (!element) {
      return false
    }

    const tagName = element.tagName?.toLowerCase?.()

    if (['textarea', 'input'].includes(tagName)) {
      return true
    }

    return (
      element.isContentEditable ||
      element.contentEditable === 'true' ||
      element.getAttribute?.('contenteditable') === 'true'
    )
  }

  if (activeElement) {
    if (isEditableElement(activeElement)) {
      return true
    }
  }

  if (!checkSelection || !selection || selection.toString().length === 0) {
    return false
  }

  let currentElement = selection.anchorNode?.parentElement || null

  while (currentElement) {
    if (isEditableElement(currentElement)) {
      return true
    }

    currentElement = currentElement.parentElement
  }

  return false
}

// --- Blueprint Context and Provider ---

/** @type {Record<string,File>} */
const fileMap = {}

/**
 *
 */
const BlueprintContext = createContext([null, (_) => {}])

export function getBlueprintGraph({ blueprint, allResources, nodeTypes }) {
  const nodes = []
  const edges = []

  const allResourceTypes = Object.keys(allResources)

  allResourceTypes.forEach((type) => {
    const collection = getCollection(type)

    blueprint[collection]?.forEach(({ id, ...data }) => {
      const node = {
        id: id,
        type: type,
        position: blueprint.config?.positions?.[id] || { x: 0, y: 0 },
        data: data,
        width: nodeTypes[type].dimensions.width || DEFAULT_BASEBOX_WIDTH,
        height: nodeTypes[type].dimensions.height || DEFAULT_BASEBOX_HEIGHT,
      }

      nodes.push(node)
    })

    blueprint[collection]?.forEach(({ id, ...data }) => {
      Object.keys(data).forEach((key) => {
        if (key.endsWith('Id')) {
          if (data[key]) {
            // @note abilities connect to the skillsetForAbility target
            // handle so edges route to the bottom of the skillset node
            const targetHandle =
              type === 'ability' && key === 'skillsetId'
                ? 'skillsetForAbility'
                : getReferenceFieldType(key)

            const edge = {
              id: getRandomId('#'),
              source: id,
              sourceHandle: key,
              target: data[key],
              targetHandle,
              type: 'default',
              animated: true,
            }

            edges.push(edge)
          }
        }
      })

      // @note for abilities, also create edges from instruction parameters
      // that reference other resources (e.g., slackIntegrationId)

      if (type === 'ability' && data.instruction) {
        try {
          const { parameters } = parseTemplateInstruction(data.instruction)

          Object.entries(parameters).forEach(([key, value]) => {
            // Only process dynamic resource fields that have values

            if (
              value &&
              typeof value === 'string' &&
              isDynamicResourceField(key)
            ) {
              // @note use prefixed sourceHandle to distinguish instruction
              // parameters from schema-level fields (e.g., skillsetId can be
              // both a schema field and an instruction parameter)

              const edge = {
                id: getRandomId('#'),
                source: id,
                sourceHandle: createInstructionParamHandle(key),
                target: value,
                targetHandle: getReferenceFieldType(key),
                type: 'default',
                animated: true,
              }

              edges.push(edge)
            }
          })
        } catch {
          // Ignore parsing errors
        }
      }
    })
  })

  for (const [id, note] of Object.entries(blueprint?.config?.notes || {})) {
    // @note handle both flat format (x, y, text, color) and nested format
    // (position, data)

    const position = note.position || { x: note.x ?? 0, y: note.y ?? 0 }
    const data = note.data || { text: note.text, color: note.color }

    const node = {
      id: id,
      type: 'note',
      position,
      data,
      width: note.width || DEFAULT_BASEBOX_WIDTH,
      height: note.height || DEFAULT_BASEBOX_HEIGHT,
      selected: false,
      zIndex: -1, // @note ensure notes are always behind other nodes
    }

    nodes.push(node)
  }

  for (const [id, image] of Object.entries(blueprint?.config?.images || {})) {
    const position = image.position || { x: 0, y: 0 }
    const data = image.data || { url: image.url }

    const node = {
      id: id,
      type: 'image',
      position,
      data,
      width: image.width || DEFAULT_BASEBOX_WIDTH,
      height: image.height || DEFAULT_BASEBOX_HEIGHT,
      zIndex: -1, // @note zIndex -1 ensures images render below other nodes
      selected: false,
    }

    nodes.push(node)
  }

  for (const [id, frame] of Object.entries(blueprint?.config?.frames || {})) {
    const node = {
      id: id,
      type: 'frame',
      position: frame.position || { x: 0, y: 0 },
      data: frame.data || {},
      width: frame.width || DEFAULT_FRAME_WIDTH,
      height: frame.height || DEFAULT_FRAME_HEIGHT,
      zIndex: -2, // @note frames render behind other annotations (notes, images)
      selected: false,
      // @note wrapper is pass-through; only border strips inside FrameNode capture clicks
      style: { pointerEvents: 'none' },
    }

    nodes.push(node)
  }

  for (const [id, tool] of Object.entries(blueprint?.config?.tools || {})) {
    const type = tool.type

    const node = {
      id: id,
      type: type,
      position: tool.position || { x: 0, y: 0 },
      data: tool.data || {},
      width: tool.width || DEFAULT_TOOL_WIDTH,
      height: tool.height || DEFAULT_TOOL_HEIGHT,
      selected: false,
    }

    nodes.push(node)

    // @note create edges for tool nodes that have *Id properties (e.g., fileId)
    const toolData = tool.data || {}

    Object.keys(toolData).forEach((key) => {
      if (key.endsWith('Id')) {
        if (toolData[key]) {
          const edge = {
            id: getRandomId('#'),
            source: id,
            sourceHandle: key,
            target: toolData[key],
            targetHandle: getReferenceFieldType(key),
            type: 'default',
            animated: true,
          }

          edges.push(edge)
        }
      }
    })

    if (type === 'tool:errorLog') {
      getErrorLogToolResourceEntries(toolData).forEach(
        ({ value, sourceHandle, targetHandle }) => {
          edges.push({
            id: getRandomId('#'),
            source: id,
            sourceHandle,
            target: value,
            targetHandle,
            type: 'default',
            animated: true,
          })
        }
      )
    }
  }

  if (!blueprint.config?.positions) {
    const direction = 'LR'

    const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(
      () => ({})
    )

    dagreGraph.setGraph({ rankdir: direction, nodesep: 20, ranksep: 60 })

    nodes.forEach((node) => {
      dagreGraph.setNode(node.id, {
        width: node.width,
        height: node.height,
      })
    })

    edges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target)
    })

    dagre.layout(dagreGraph)

    nodes.forEach((node) => {
      const position = dagreGraph.node(node.id)

      node.position = {
        // We are shifting the dagre node position (anchor=center center) to the top left
        // so it matches the React Flow node anchor point (top left).
        x: position.x - node.width / 2,
        y: position.y - node.height / 2,
      }
    })
  }

  // @note filter out orphan edges that point to non-existent nodes

  // This can happen when instruction parameters reference deleted resources
  // or unsaved temporary IDs (starting with #).

  const validEdges = filterEdgesWithExistingNodes(edges, nodes)

  return [nodes, validEdges]
}

/**
 *
 */
export function BlueprintProvider({
  blueprint: _blueprint,

  disabled,

  children,
}) {
  const { allResources, nodeTypes } = useResources()

  const { loading, fetch } = useFetch({
    failureMessage: true,
  })

  const [blueprint, setBlueprint] = useState(_blueprint)

  const id = blueprint.id
  const name = blueprint.name

  const setName = useCallback(
    (name) => {
      setBlueprint((blueprint) => {
        return {
          ...blueprint,

          name,
        }
      })
    },
    [setBlueprint]
  )

  const updateName = useCallback(
    async (name) => {
      setName(name)

      await fetch(`/api/v1/blueprint/${id}/update`, {
        data: {
          name,
        },

        loadingMessage: 'Updating blueprint name...',
        failureMessage: true,
      })
    },
    [id, setName, fetch]
  )

  const getQuotedName = (node) => {
    return (node.data.name ? `"${node.data.name}"` : node.id) || ''
  }

  const [blueprintNodes, blueprintEdges] = useMemo(
    () => getBlueprintGraph({ blueprint, allResources, nodeTypes }),
    [blueprint, allResources, nodeTypes]
  )

  useReadyNotification()

  const [nodes, setNodes, onNodesChangeOriginal] = useNodesState(blueprintNodes)
  const [edges, setEdges, onEdgesChangeOriginal] = useEdgesState(blueprintEdges)

  // @note history management for undo/redo functionality

  const history = useHistory({ maxHistoryLength: MAX_HISTORY_LENGTH })

  // @note ref to track whether we're currently performing an undo/redo operation

  const isUndoRedoRef = useRef(false)

  // @note ref to store the current state for undo/redo

  const lastStateRef = useRef({ nodes, edges })

  // @note ref to store state before node drag starts

  const preDragStateRef = useRef(null)

  // @note update the ref when nodes/edges change (except during undo/redo)

  useEffect(() => {
    if (!isUndoRedoRef.current) {
      lastStateRef.current = { nodes, edges }
    }
  }, [nodes, edges])

  // @note handler for node drag start - capture state before drag

  const onNodeDragStart = useCallback(() => {
    if (!disabled) {
      preDragStateRef.current = {
        nodes: lastStateRef.current.nodes,
        edges: lastStateRef.current.edges,
      }
    }
  }, [disabled])

  // @note handler for node drag stop - push pre-drag state to history

  const onNodeDragStop = useCallback(() => {
    if (!disabled && preDragStateRef.current && !isUndoRedoRef.current) {
      history.pushState(preDragStateRef.current)
      preDragStateRef.current = null
    }
  }, [disabled, history])

  // @note wrapper for onNodesChange that saves history for undo

  const onNodesChange = useCallback(
    (changes) => {
      // @note only save history for structural changes, not position updates

      const hasStructuralChange = changes.some(
        (change) =>
          change.type === 'remove' ||
          change.type === 'add' ||
          change.type === 'reset'
      )

      if (hasStructuralChange && !isUndoRedoRef.current && !disabled) {
        history.pushState({
          nodes: lastStateRef.current.nodes,
          edges: lastStateRef.current.edges,
        })
      }

      onNodesChangeOriginal(changes)
    },
    [onNodesChangeOriginal, history, disabled]
  )

  // @note wrapper for onEdgesChange that saves history for undo

  const onEdgesChange = useCallback(
    (changes) => {
      // @note only save history for structural changes

      const hasStructuralChange = changes.some(
        (change) =>
          change.type === 'remove' ||
          change.type === 'add' ||
          change.type === 'reset'
      )

      if (hasStructuralChange && !isUndoRedoRef.current && !disabled) {
        history.pushState({
          nodes: lastStateRef.current.nodes,
          edges: lastStateRef.current.edges,
        })
      }

      onEdgesChangeOriginal(changes)
    },
    [onEdgesChangeOriginal, history, disabled]
  )

  // @note undo function restores previous state

  const undo = useCallback(() => {
    if (!history.canUndo || disabled) {
      return
    }

    isUndoRedoRef.current = true

    try {
      // @note save current state to future for redo

      history.pushToFuture({
        nodes: lastStateRef.current.nodes,
        edges: lastStateRef.current.edges,
      })

      // @note get previous state from history

      const previousState = history.undo()

      if (previousState) {
        setNodes(previousState.nodes)
        setEdges(previousState.edges)
        lastStateRef.current = previousState
      }
    } finally {
      isUndoRedoRef.current = false
    }
  }, [history, disabled, setNodes, setEdges])

  // @note redo function restores next state

  const redo = useCallback(() => {
    if (!history.canRedo || disabled) {
      return
    }

    isUndoRedoRef.current = true

    try {
      // @note save current state to history

      history.pushState({
        nodes: lastStateRef.current.nodes,
        edges: lastStateRef.current.edges,
      })

      // @note get next state from future
      const nextState = history.redo()

      if (nextState) {
        setNodes(nextState.nodes)
        setEdges(nextState.edges)
        lastStateRef.current = nextState
      }
    } finally {
      isUndoRedoRef.current = false
    }
  }, [history, disabled, setNodes, setEdges])

  const canUndo = history.canUndo && !disabled
  const canRedo = history.canRedo && !disabled

  // @note Auto-layout should be undoable, so we push current state before
  // applying node position changes.
  const autoLayout = useCallback(() => {
    if (disabled || isUndoRedoRef.current) {
      return
    }

    history.pushState({
      nodes: lastStateRef.current.nodes,
      edges: lastStateRef.current.edges,
    })

    const selectedNodes = nodes.filter((node) => node.selected)

    // @note if nodes are selected, only layout the selected non-annotation nodes
    // otherwise, layout all non-annotation nodes
    const nodesToLayout = selectedNodes.length > 0 ? selectedNodes : nodes

    // @note exclude annotation nodes (notes, images, frames) from auto-layout
    // since they are user-positioned visual groupings that shouldn't move
    const layoutableNodes = nodesToLayout
      .filter((node) => !isAnnotationNodeType(node.type))
      .map((node) => ({
        ...node,
        position: { ...node.position },
      }))

    if (layoutableNodes.length === 0) {
      return
    }

    // @note calculate the center of the original positions before layout
    const originalCenterX =
      layoutableNodes.reduce(
        (sum, node) =>
          sum + node.position.x + (node.width || DEFAULT_BASEBOX_WIDTH) / 2,
        0
      ) / layoutableNodes.length

    const originalCenterY =
      layoutableNodes.reduce(
        (sum, node) =>
          sum + node.position.y + (node.height || DEFAULT_BASEBOX_HEIGHT) / 2,
        0
      ) / layoutableNodes.length

    // @note get IDs of nodes being laid out so we can replace only those
    const layoutableIds = new Set(layoutableNodes.map((node) => node.id))

    // @note filter edges to only include those connecting layoutable nodes
    const layoutableEdges = edges.filter(
      (edge) => layoutableIds.has(edge.source) && layoutableIds.has(edge.target)
    )

    const laidOutNodes = layoutNodes(layoutableNodes, layoutableEdges)

    // @note calculate the center of the new layout positions
    const newCenterX =
      laidOutNodes.reduce(
        (sum, node) =>
          sum + node.position.x + (node.width || DEFAULT_BASEBOX_WIDTH) / 2,
        0
      ) / laidOutNodes.length

    const newCenterY =
      laidOutNodes.reduce(
        (sum, node) =>
          sum + node.position.y + (node.height || DEFAULT_BASEBOX_HEIGHT) / 2,
        0
      ) / laidOutNodes.length

    // @note offset to shift new layout to original center
    const offsetX = originalCenterX - newCenterX
    const offsetY = originalCenterY - newCenterY

    // @note create a map of laid out positions with offset applied
    const laidOutPositions = new Map(
      laidOutNodes.map((node) => [
        node.id,
        {
          x: node.position.x + offsetX,
          y: node.position.y + offsetY,
        },
      ])
    )

    // @note update only the laid out nodes, preserve all others in place
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        const newPosition = laidOutPositions.get(node.id)

        if (newPosition) {
          return { ...node, position: newPosition }
        }

        return node
      })
    )
  }, [disabled, history, nodes, edges, setNodes])

  const {
    updateNode,
    updateEdge,

    getNodes,
    getEdges,

    addNodes,
    addEdges,
  } = useReactFlow()

  // @note ref to suppress edge sync during build. The build function remaps
  // node IDs and edge source/target in a specific order. If the edge sync
  // effect fires between awaited API calls it can see instruction parameters
  // that still reference old temporary IDs (for nodes already remapped) and
  // incorrectly remove the corresponding edges before the build has a chance
  // to update their source. Setting this ref during build prevents the race.

  const isBuildingRef = useRef(false)

  // @note ref to suppress edge sync during auto-connect operations. When
  // dropping a node, we add edges AND update node data, but these are separate
  // state updates. If edge sync runs between them, it can see stale data and
  // incorrectly remove/recreate edges, causing onConnect/onDisconnect to fire
  // and create an infinite loop.

  const suppressEdgeSyncRef = useRef(false)

  // @note Sync edges with all data-driven references when node data changes.
  // This covers top-level *Id fields, tool data references, and ability
  // instruction parameters edited directly in the configurator.

  useEffect(() => {
    if (isBuildingRef.current || suppressEdgeSyncRef.current) {
      return
    }

    const currentNodes = getNodes()
    const currentEdges = getEdges()
    const syncedEdges = syncEdgesWithNodeReferences({
      nodes: currentNodes,
      edges: currentEdges,
    })

    if (
      !equal(
        normalizeBlueprintChangeEdges(currentEdges),
        normalizeBlueprintChangeEdges(syncedEdges)
      )
    ) {
      setEdges(syncedEdges)
    }
  }, [nodes, getNodes, getEdges, setEdges])

  const [hasChanges, setHasChanges] = useState(false)

  {
    const changedNodes = useDebounce(nodes, 1000)
    const changedEdges = useDebounce(edges, 1000)

    useEffect(() => {
      if (disabled) {
        return
      }

      const result = hasBlueprintGraphChanges({
        blueprintNodes,
        changedNodes,
        blueprintEdges,
        changedEdges,
      })

      setHasChanges(result)
    }, [disabled, blueprintNodes, changedNodes, blueprintEdges, changedEdges])

    usePreventLeave(
      hasChanges,

      isDevelopment // @note disabled in development to avoid annoyance
    )
  }

  const [consoleIframeReady, setConsoleIframeReady] = useState(false)

  // @note the chat console iframe is rendered by SuperTools with id="console-chat"
  const [consoleIframe] = useDOMQuerySelector('iframe#console-chat', {
    waitForElements: true,
  })

  useReadyNotificationHandler(() => {
    setConsoleIframeReady(true)
  }, consoleIframe)

  const chatIframeWindow = consoleIframe?.contentWindow

  const refreshChatBots = useCallback(
    (blueprint) => {
      if (!Array.isArray(blueprint?.bots)) {
        return
      }

      const bots = blueprint.bots
      const defaultBotId = bots[0]?.id

      chatIframeWindow?.postMessage(
        {
          type: 'refreshBots',
          props: {
            defaultBotId,
          },
        },
        '*'
      )
    },
    [chatIframeWindow]
  )

  useEffect(() => {
    if (!consoleIframeReady) {
      return
    }

    refreshChatBots(blueprint)
  }, [blueprint, consoleIframeReady, refreshChatBots])

  // @note when the chat app signals that a bot backstory was written via the
  // reprogramming feature, fetch the latest backstory from the API and update
  // all backstory tool nodes connected to that bot in the canvas
  usePostMessageHandler(
    'botBackstoryUpdated',
    async ({ botId }) => {
      if (!botId) {
        return
      }

      const { error, data } = await fetch(`/api/v1/bot/${botId}/fetch`)

      if (error) {
        return
      }

      const newBackstory = data.backstory ?? ''

      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (node.type === 'bot' && node.id === botId) {
            return {
              ...node,
              data: {
                ...node.data,
                backstory: newBackstory,
              },
            }
          }

          return node
        })
      )

      toast.success(
        data.name
          ? `Backstory updated for "${data.name}".`
          : 'Backstory updated.'
      )
    },
    [setNodes]
  )

  const confirm = useConfirm()

  const build = useCallback(
    async function () {
      isBuildingRef.current = true

      try {
        const toastId = getRandomId('toast-')

        const hashToIdMap = {}

        const newBlueprint = { ...blueprint }

        const thisFileMap = {}

        let disconnectHook

        // disconnect resources
        {
          const nodes = getNodes()

          const originalNodes = Object.entries(blueprint)
            .map(([type, resources]) => [pluralize(type, 1), resources])
            .filter(([type]) => type in allResources)
            .flatMap(([type, resources]) => {
              return resources.map(({ id, ...data }) => {
                return {
                  id: id,
                  type: type,
                  data: data,
                }
              })
            })

          const nodesToDisconnect = originalNodes.filter(
            (node) =>
              !nodes.some(
                ({ type, id }) => type === node.type && id === node.id
              )
          )

          if (nodesToDisconnect.length) {
            const result = await confirm(
              'Do you want to delete disconnected resources?',
              {
                actions: {
                  Keep: { result: 'keep' },
                  Delete: { danger: true, result: 'delete' },
                },
              }
            )

            if (!result) {
              return
            }

            // @note the reason we want to do this at the very end before we do
            // the resource updates is to ensure that resources are not auto
            // deleted when the primary resource is deleted as well, which is
            // something that can happen at database level

            disconnectHook = async () => {
              let disconnectFn

              if (result === 'delete') {
                disconnectFn = async (node) => {
                  const type = getTypeApiPath(
                    allResources[node.type]?.type || node.type
                  )

                  const path = `/api/v1/${type}/${node.id}/delete`

                  const { error } = await fetch(path, {
                    toastId: toastId,

                    loadingMessage: 'Deleting blueprint resources...',

                    data: {},
                  })

                  if (error) {
                    toast.error(
                      `Cannot delete ${type} ${getQuotedName(node)} - ${error}`
                    )

                    return
                  }
                }
              } else {
                disconnectFn = async (node) => {
                  const type = getTypeApiPath(
                    allResources[node.type]?.type || node.type
                  )

                  const path = `/api/v1/${type}/${node.id}/update`

                  const { error } = await fetch(path, {
                    toastId: toastId,

                    loadingMessage: 'Disconnecting blueprint resources...',

                    data: {
                      blueprintId: null,

                      // set to null any keys that end with Id

                      ...Object.fromEntries(
                        Object.entries(node.data).map(([key, value]) => {
                          if (key.endsWith('Id')) {
                            return [key, null]
                          }

                          return [key, value]
                        })
                      ),
                    },
                  })

                  if (error) {
                    toast.error(
                      `Cannot update ${type} ${getQuotedName(node)} - ${error}`
                    )

                    return
                  }
                }
              }

              for (const node of nodesToDisconnect) {
                const type = allResources[node.type]?.type || node.type

                await disconnectFn(node)

                const collection = getCollection(type)

                let resources = newBlueprint[collection]

                if (resources) {
                  resources = resources.filter(
                    (resource) => resource.id !== node.id
                  )
                }

                newBlueprint[collection] = resources
              }
            }
          }

          // @note clear stale *Id references on surviving canvas nodes that point
          // to disconnected resources. When a node is deleted, React Flow removes
          // the edges synchronously, but the useNodeConnections onDisconnect
          // callback fires asynchronously in a useEffect (after the next render).
          // If build() runs before that effect fires, getNodes() returns stale
          // data where *Id fields still reference deleted nodes. This causes
          // newBlueprint to persist stale references, and after onDisconnect
          // finally fires and clears the canvas data, the blueprint and canvas
          // diverge - making hasChanges report false positives permanently until
          // the next save.

          if (nodesToDisconnect.length) {
            const disconnectedIds = new Set(
              nodesToDisconnect.map((node) => node.id)
            )

            const currentNodes = getNodes()

            for (const node of currentNodes) {
              if (isNonResourceNodeType(node.type)) {
                continue
              }

              let hasStaleRefs = false
              let hasStaleInstructionRefs = false

              for (const key of Object.keys(node.data)) {
                if (
                  key.endsWith('Id') &&
                  typeof node.data[key] === 'string' &&
                  disconnectedIds.has(node.data[key])
                ) {
                  hasStaleRefs = true

                  break
                }
              }

              // @note also check instruction parameters for stale references
              if (
                node.type === 'ability' &&
                node.data.instruction &&
                typeof node.data.instruction === 'string'
              ) {
                try {
                  const { parameters } = parseTemplateInstruction(
                    node.data.instruction
                  )

                  for (const value of Object.values(parameters)) {
                    if (
                      typeof value === 'string' &&
                      disconnectedIds.has(value)
                    ) {
                      hasStaleInstructionRefs = true

                      break
                    }
                  }
                } catch {
                  // Not a template instruction, ignore
                }
              }

              if (hasStaleRefs || hasStaleInstructionRefs) {
                updateNode(node.id, (n) => {
                  let updatedData = n.data

                  if (hasStaleRefs) {
                    updatedData = Object.fromEntries(
                      Object.entries(updatedData).map(([key, value]) => {
                        if (
                          key.endsWith('Id') &&
                          typeof value === 'string' &&
                          disconnectedIds.has(value)
                        ) {
                          return [key, null]
                        }

                        return [key, value]
                      })
                    )
                  }

                  if (hasStaleInstructionRefs && updatedData.instruction) {
                    try {
                      const { template, parameters } = parseTemplateInstruction(
                        updatedData.instruction
                      )

                      const updatedParams = { ...parameters }

                      for (const [key, value] of Object.entries(
                        updatedParams
                      )) {
                        if (
                          typeof value === 'string' &&
                          disconnectedIds.has(value)
                        ) {
                          updatedParams[key] = ''
                        }
                      }

                      updatedData = {
                        ...updatedData,
                        instruction: buildTemplateInstruction({
                          template,
                          params: updatedParams,
                        }),
                      }
                    } catch {
                      // Not a template instruction, ignore
                    }
                  }

                  return { ...n, data: updatedData }
                })
              }
            }
          }
        }

        let upsertHook

        // upsert resources
        {
          function getDependencies(nodes) {
            const dependencies = {}

            nodes.forEach((node) => {
              const nodeDependencies = getResourceReferenceEntries(node.data)
                .map(({ value }) => value)
                .filter((value) => value.startsWith('#'))

              dependencies[node.id] = nodeDependencies
            })

            return dependencies
          }

          const nodes = getNodes()

          const dependencies = getDependencies(nodes)

          const sortedNodeIds = topologicalSort(dependencies)

          for (const nodeId of sortedNodeIds) {
            const node = nodes.find((n) => n.id === nodeId)

            if (!node) {
              continue // @note this should not happen, but just in case
            }

            // @note there are times this code is not performing well, so as a
            // temporary measure here we print as much information as possible
            {
              if (process.env.NODE_ENV !== 'production') {
                if (!node) {
                  // eslint-disable-next-line no-console
                  console.error('Node not found', { nodeId, nodes })
                }
              }
            }

            if (isNonResourceNodeType(node.type)) {
              continue
            }

            const resolvedType = allResources[node.type]?.type || node.type

            const resolvedData = normalizeBlueprintResourceData(
              resolvedType,
              node.data
            )

            const previousData = blueprint[pluralize(resolvedType, 2)].find(
              (resource) => resource.id === node.id
            )

            if (
              previousData &&
              equal(previousData, { ...resolvedData, id: nodeId })
            ) {
              continue
            }

            for (const key in resolvedData) {
              if (
                typeof resolvedData[key] === 'string' &&
                resolvedData[key].startsWith('#')
              ) {
                const referenceId = resolvedData[key]

                resolvedData[key] =
                  hashToIdMap[referenceId] || resolvedData[key]
              }
            }

            // @note For abilities, remap temporary IDs in instruction parameters
            // (e.g., skillsetId inside the instruction template)

            if (
              resolvedType === 'ability' &&
              resolvedData.instruction &&
              typeof resolvedData.instruction === 'string'
            ) {
              try {
                const { template, parameters } = parseTemplateInstruction(
                  resolvedData.instruction
                )

                let hasUpdates = false

                const updatedParameters = { ...parameters }

                for (const key in updatedParameters) {
                  const value = updatedParameters[key]

                  if (
                    typeof value === 'string' &&
                    value.startsWith('#') &&
                    hashToIdMap[value]
                  ) {
                    updatedParameters[key] = hashToIdMap[value]
                    hasUpdates = true
                  }
                }

                if (hasUpdates) {
                  resolvedData.instruction = buildTemplateInstruction({
                    template,
                    params: updatedParameters,
                  })
                }
              } catch {
                // Ignore parsing errors - not a template instruction
              }
            }

            const isCreating = node.id.startsWith('#')

            const path = isCreating
              ? `/api/v1/${getTypeApiPath(resolvedType)}/create`
              : `/api/v1/${getTypeApiPath(resolvedType)}/${node.id}/update`

            const { error, data } = await fetch(path, {
              toastId: toastId,

              loadingMessage: 'Updating blueprint resources...',

              data: {
                ...resolvedData,

                blueprintId: blueprint.id,
              },
            })

            if (error) {
              toast.error(
                `Cannot create ${resolvedType} ${getQuotedName(
                  node
                )} - ${error}`
              )

              return
            }

            if (resolvedType === 'file') {
              if (fileMap[node.id]) {
                thisFileMap[data.id] = fileMap[node.id]

                delete fileMap[node.id]
              }
            }

            if (isCreating) {
              hashToIdMap[node.id] = data.id

              // @note Update node with new ID and resolved data (including remapped
              // instruction with real IDs instead of temporary ones)

              updateNode(node.id, (n) => ({
                ...n,
                id: data.id,
                data: { ...n.data, ...resolvedData },
              }))

              const collection = pluralize(resolvedType, 2)

              newBlueprint[collection].push({
                ...resolvedData,

                id: data.id,
              })
            } else {
              // @note Also update existing node's data with resolved data (including
              // remapped instruction with real IDs)

              updateNode(node.id, (n) => ({
                ...n,
                data: { ...n.data, ...resolvedData },
              }))

              const collection = pluralize(resolvedType, 2)

              const itemIndex = newBlueprint[collection].findIndex(
                (resource) => resource.id === node.id
              )

              if (itemIndex >= 0) {
                newBlueprint[collection] = newBlueprint[collection].slice()

                newBlueprint[collection][itemIndex] = {
                  ...newBlueprint[collection][itemIndex],

                  ...resolvedData,
                }
              } else {
                newBlueprint[collection] = newBlueprint[collection].slice()

                newBlueprint[collection].push({
                  ...resolvedData,

                  id: node.id,
                })
              }
            }

            const edges = getEdges().filter(
              ({ source, target }) => source === node.id || target === node.id
            )

            edges.forEach((edge) => {
              updateEdge(edge.id, (edge) => {
                edge = { ...edge }

                if (edge.source === node.id) {
                  edge.source = data.id
                }

                if (edge.target === node.id) {
                  edge.target = data.id
                }

                return edge
              })
            })
          }
        }

        await disconnectHook?.()
        await upsertHook?.()

        // upload files
        {
          try {
            await Promise.all(
              Object.entries(thisFileMap).map(async ([id, file]) => {
                const { error: uploadError, data: uploadData } = await fetch(
                  `/api/v1/file/${id}/upload`,
                  {
                    data: {
                      file: {
                        size: file.size,
                        type: file.type || nameToType(file.name),
                        name: file.name,
                      },
                    },

                    toastId: toastId,
                    loadingMessage: 'Creating file upload...',
                  }
                )

                if (uploadError) {
                  return
                }

                await fetch(uploadData.uploadRequest.url, {
                  method: uploadData.uploadRequest.method,

                  headers: uploadData.uploadRequest.headers,

                  body: await file.arrayBuffer(),

                  dataType: 'body',

                  toastId: toastId,
                  loadingMessage: 'Uploading file...',
                })
              })
            )
          } finally {
            Object.keys(fileMap).forEach((key) => delete fileMap[key])
          }
        }

        // update tool nodes' data to remap temporary IDs to real IDs
        {
          const nodes = getNodes()

          for (const node of nodes) {
            if (!isToolNodeType(node.type)) {
              continue
            }

            let hasChanges = false
            const remappedData = { ...node.data }

            for (const key of Object.keys(remappedData)) {
              if (
                key.endsWith('Id') &&
                typeof remappedData[key] === 'string' &&
                hashToIdMap[remappedData[key]]
              ) {
                remappedData[key] = hashToIdMap[remappedData[key]]
                hasChanges = true
              }
            }

            if (hasChanges) {
              updateNode(node.id, (n) => ({ ...n, data: remappedData }))
            }
          }
        }

        // @note prune orphan edges left behind by temporary IDs. The exact
        // regression here is stale `#import:::` instruction:fileId edges showing
        // up in post-build diagnostics after the source nodes have already been
        // remapped to persisted IDs.
        {
          const currentNodes = getNodes()
          const validEdges = filterEdgesWithExistingNodes(
            getEdges(),
            currentNodes
          )

          setEdges(validEdges)
        }

        // update positions, notes, images, frames, and tools
        {
          const positions = getNodes().reduce((acc, { id, type, position }) => {
            if (isNonResourceNodeType(type)) {
              return acc
            }

            return {
              ...acc,

              [hashToIdMap[id] || id]: position,
            }
          }, {})

          const notes = getNodes().reduce(
            (acc, { id, type, data, position, width, height }) => {
              if (type !== 'note') {
                return acc
              }

              return {
                ...acc,

                [id]: {
                  data,
                  position,
                  width,
                  height,
                },
              }
            },
            {}
          )

          const images = getNodes().reduce(
            (acc, { id, type, data, position, width, height }) => {
              if (type !== 'image') {
                return acc
              }

              return {
                ...acc,

                [id]: {
                  data,
                  position,
                  width,
                  height,
                },
              }
            },
            {}
          )

          const frames = getNodes().reduce(
            (acc, { id, type, data, position, width, height }) => {
              if (type !== 'frame') {
                return acc
              }

              return {
                ...acc,

                [id]: {
                  data,
                  position,
                  width,
                  height,
                },
              }
            },
            {}
          )

          const tools = getNodes().reduce(
            (acc, { id, type, data, position, width, height }) => {
              if (!isToolNodeType(type)) {
                return acc
              }

              // @note remap any reference IDs in tool data (e.g., fileId, spaceId)
              // that point to temporary node IDs to their real persisted IDs
              const remappedData = { ...data }

              for (const key of Object.keys(remappedData)) {
                if (
                  key.endsWith('Id') &&
                  typeof remappedData[key] === 'string' &&
                  hashToIdMap[remappedData[key]]
                ) {
                  remappedData[key] = hashToIdMap[remappedData[key]]
                }
              }

              if (
                type === 'tool:errorLog' &&
                Array.isArray(remappedData[ERROR_LOG_TOOL_RESOURCE_DATA_KEY])
              ) {
                remappedData[ERROR_LOG_TOOL_RESOURCE_DATA_KEY] = remappedData[
                  ERROR_LOG_TOOL_RESOURCE_DATA_KEY
                ].map((resource) => ({
                  ...resource,
                  id: hashToIdMap[resource?.id] || resource?.id,
                }))
              }

              return {
                ...acc,

                [id]: {
                  type,
                  data: remappedData,
                  position,
                  width,
                  height,
                },
              }
            },
            {}
          )

          newBlueprint.config = {
            ...newBlueprint.config,

            positions: positions,
            notes: notes,
            images: images,
            frames: frames,
            tools: tools,
          }

          await fetch(`/api/v1/blueprint/${blueprint.id}/update`, {
            toastId: toastId,

            loadingMessage: 'Saving blueprint...',

            data: {
              config: {
                $update: {
                  positions,
                  notes,
                  images,
                  frames,
                  tools,
                },
              },
            },
          })
        }

        // update blueprint
        {
          const currentNodes = getNodes()
          const validEdges = filterEdgesWithExistingNodes(
            getEdges(),
            currentNodes
          )

          const [nextBlueprintNodes, nextBlueprintEdges] = getBlueprintGraph({
            blueprint: newBlueprint,
            allResources,
            nodeTypes,
          })

          const diagnostics = getBlueprintGraphChangeDiagnostics({
            blueprintNodes: nextBlueprintNodes,
            changedNodes: currentNodes,
            blueprintEdges: nextBlueprintEdges,
            changedEdges: validEdges,
          })

          // @todo remove diagnostic logging once the false hasChanges bug is resolved
          if (diagnostics.hasChanges) {
            if (diagnostics.hasNodeChanges) {
              warn('[designer:postBuildHasChanges] node diff', {
                ...diagnostics.nodeDiff,
              }).log('temp.blueprint')
            }

            if (diagnostics.hasEdgeChanges) {
              warn('[designer:postBuildHasChanges] edge diff', {
                ...diagnostics.edgeDiff,
              }).log('temp.blueprint')
            }
          }

          setBlueprint(newBlueprint)
        }

        // refresh bots
        {
          refreshChatBots(newBlueprint)
        }
      } finally {
        isBuildingRef.current = false
      }
    },
    [
      blueprint,

      fetch,

      getNodes,
      getEdges,
      setEdges,
      updateNode,
      updateEdge,

      confirm,

      refreshChatBots,

      allResources,
      nodeTypes,
    ]
  )

  const exportBlueprint = useCallback(
    async function () {
      const idToHasMap = {}

      let nodes = getNodes()

      const selectedNodes = nodes.filter((node) => node.selected)

      if (selectedNodes.length) {
        nodes = selectedNodes
      }

      const resources = nodes.reduce((acc, { id, type, data }) => {
        if (isNonResourceNodeType(type)) {
          return acc
        }

        idToHasMap[id] = getRandomId(`#${type}:::`)

        return {
          ...acc,

          [id]: {
            type,
            data,
          },
        }
      }, {})

      for (const resource of Object.values(resources)) {
        if (
          resource.type !== 'ability' ||
          !resource.data?.instruction ||
          typeof resource.data.instruction !== 'string'
        ) {
          continue
        }

        resource.data = {
          ...resource.data,
          instruction: remapInstructionParameterReferences(
            resource.data.instruction,
            idToHasMap
          ),
        }
      }

      const positions = nodes.reduce((acc, { id, position }) => {
        return {
          ...acc,

          [id]: position,
        }
      }, {})

      const notes = nodes.reduce(
        (acc, { id, type, data, position, width, height }) => {
          if (type !== 'note') {
            return acc
          }

          return {
            ...acc,

            [id]: {
              data,
              position,
              width,
              height,
            },
          }
        },
        {}
      )

      const images = nodes.reduce(
        (acc, { id, type, data, position, width, height }) => {
          if (type !== 'image') {
            return acc
          }

          return {
            ...acc,

            [id]: {
              data,
              position,
              width,
              height,
            },
          }
        },
        {}
      )

      const frames = nodes.reduce(
        (acc, { id, type, data, position, width, height }) => {
          if (type !== 'frame') {
            return acc
          }

          return {
            ...acc,

            [id]: {
              data,
              position,
              width,
              height,
            },
          }
        },
        {}
      )

      const tools = nodes.reduce(
        (acc, { id, type, data, position, width, height }) => {
          if (!isToolNodeType(type)) {
            return acc
          }

          return {
            ...acc,

            [id]: {
              type,
              data,
              position,
              width,
              height,
            },
          }
        },
        {}
      )

      let exportedBlueprint = {
        resources,
        positions,
        notes,
        images,
        frames,
        tools,
      }

      for (const [oldKey, newKey] of Object.entries(idToHasMap)) {
        exportedBlueprint = rename(
          revalue(exportedBlueprint, oldKey, newKey),
          oldKey,
          newKey
        )
      }

      const text = stringifyYaml(exportedBlueprint)

      return text
    },
    [getNodes]
  )

  const importBlueprint = useCallback(
    async function importBlueprint(text, { relativePosition, selected } = {}) {
      let {
        resources = {},
        positions = {},
        notes = {},
        images = {},
        frames = {},
        tools = {},
      } = tryParseYaml(text) || {}

      // deselect selected nodes
      {
        const selectedNodes = getNodes().filter((node) => node.selected)

        if (selectedNodes.length) {
          setNodes((nodes) =>
            nodes.map((node) => ({
              ...node,

              selected: false,
            }))
          )
        }
      }

      // normalize the ids, by replacing the old ids with new ones
      {
        const idToHasMap = {}

        for (const key of Object.keys(resources)) {
          const newKey = getRandomId(`#import:::`)

          idToHasMap[key] = newKey
        }

        // @note also remap annotation and tool IDs
        for (const key of Object.keys(notes)) {
          idToHasMap[key] = getRandomId(`#note:::`)
        }

        for (const key of Object.keys(images)) {
          idToHasMap[key] = getRandomId(`#image:::`)
        }

        for (const key of Object.keys(frames)) {
          idToHasMap[key] = getRandomId(`#frame:::`)
        }

        for (const key of Object.keys(tools)) {
          idToHasMap[key] = getRandomId(`#tool:::`)
        }

        for (const [oldKey, newKey] of Object.entries(idToHasMap)) {
          resources = rename(revalue(resources, oldKey, newKey), oldKey, newKey)
          positions = rename(revalue(positions, oldKey, newKey), oldKey, newKey)
          notes = rename(revalue(notes, oldKey, newKey), oldKey, newKey)
          images = rename(revalue(images, oldKey, newKey), oldKey, newKey)
          frames = rename(revalue(frames, oldKey, newKey), oldKey, newKey)
          tools = rename(revalue(tools, oldKey, newKey), oldKey, newKey)
        }

        for (const resource of Object.values(resources)) {
          if (
            resource.type !== 'ability' ||
            !resource.data?.instruction ||
            typeof resource.data.instruction !== 'string'
          ) {
            continue
          }

          resource.data = {
            ...resource.data,
            instruction: remapInstructionParameterReferences(
              resource.data.instruction,
              idToHasMap
            ),
          }
        }
      }

      // @note collect all positions from resources and annotations for normalization
      const allPositions = {
        ...positions,
        ...Object.fromEntries(
          Object.entries(notes).map(([id, n]) => [id, n.position])
        ),
        ...Object.fromEntries(
          Object.entries(images).map(([id, n]) => [id, n.position])
        ),
        ...Object.fromEntries(
          Object.entries(frames).map(([id, n]) => [id, n.position])
        ),
        ...Object.fromEntries(
          Object.entries(tools).map(([id, n]) => [id, n.position])
        ),
      }

      // normalize positions relative to zero
      {
        const positionValues = Object.values(allPositions).filter(Boolean)

        if (positionValues.length > 0) {
          const minX = Math.min(...positionValues.map((pos) => pos.x || 0))
          const minY = Math.min(...positionValues.map((pos) => pos.y || 0))

          for (const id in positions) {
            // @note snap final positions to grid to prevent visual jump when node is clicked
            positions[id] = snapPositionToGrid({
              x: positions[id].x - minX + (relativePosition?.x || 0),
              y: positions[id].y - minY + (relativePosition?.y || 0),
            })
          }

          // @note also normalize annotation positions
          for (const id in notes) {
            if (notes[id].position) {
              notes[id].position = snapPositionToGrid({
                x: notes[id].position.x - minX + (relativePosition?.x || 0),
                y: notes[id].position.y - minY + (relativePosition?.y || 0),
              })
            }
          }

          for (const id in images) {
            if (images[id].position) {
              images[id].position = snapPositionToGrid({
                x: images[id].position.x - minX + (relativePosition?.x || 0),
                y: images[id].position.y - minY + (relativePosition?.y || 0),
              })
            }
          }

          for (const id in frames) {
            if (frames[id].position) {
              frames[id].position = snapPositionToGrid({
                x: frames[id].position.x - minX + (relativePosition?.x || 0),
                y: frames[id].position.y - minY + (relativePosition?.y || 0),
              })
            }
          }

          for (const id in tools) {
            if (tools[id].position) {
              tools[id].position = snapPositionToGrid({
                x: tools[id].position.x - minX + (relativePosition?.x || 0),
                y: tools[id].position.y - minY + (relativePosition?.y || 0),
              })
            }
          }
        }
      }

      // add the resource nodes

      for (const [id, { type, data }] of Object.entries(resources)) {
        const node = getNodes().find((node) => node.id === id)

        if (node) {
          updateNode(id, (n) => {
            return {
              ...n,

              type: type,
              data: data,

              selected: selected ?? true,
            }
          })
        } else {
          addNodes([
            {
              id: id,

              type: type,
              data: data,

              width: nodeTypes[type].dimensions.width || DEFAULT_BASEBOX_WIDTH,
              height:
                nodeTypes[type].dimensions.height || DEFAULT_BASEBOX_HEIGHT,

              // @note use SNAP_GRID_SIZE instead of hardcoded offset to stay on the grid
              position: {
                x: (positions[id]?.x || 0) + SNAP_GRID_SIZE,
                y: (positions[id]?.y || 0) + SNAP_GRID_SIZE,
              },

              selected: selected ?? true,
            },
          ])
        }
      }

      // @note add annotation nodes (notes, images, frames)
      for (const [id, note] of Object.entries(notes)) {
        addNodes([
          {
            id,
            type: 'note',
            data: note.data || {},
            position: note.position || { x: 0, y: 0 },
            width: note.width || DEFAULT_BASEBOX_WIDTH,
            height: note.height || DEFAULT_BASEBOX_HEIGHT,
            zIndex: -1,
            selected: selected ?? true,
          },
        ])
      }

      for (const [id, image] of Object.entries(images)) {
        addNodes([
          {
            id,
            type: 'image',
            data: image.data || {},
            position: image.position || { x: 0, y: 0 },
            width: image.width || DEFAULT_BASEBOX_WIDTH,
            height: image.height || DEFAULT_BASEBOX_HEIGHT,
            zIndex: -1,
            selected: selected ?? true,
          },
        ])
      }

      for (const [id, frame] of Object.entries(frames)) {
        addNodes([
          {
            id,
            type: 'frame',
            data: frame.data || {},
            position: frame.position || { x: 0, y: 0 },
            width: frame.width || DEFAULT_FRAME_WIDTH,
            height: frame.height || DEFAULT_FRAME_HEIGHT,
            zIndex: -2, // @note frames render behind other annotations
            selected: selected ?? true,
            // @note wrapper is pass-through; only border strips inside FrameNode capture clicks
            style: { pointerEvents: 'none' },
          },
        ])
      }

      // @note add tool nodes
      for (const [id, tool] of Object.entries(tools)) {
        addNodes([
          {
            id,
            type: tool.type,
            data: tool.data || {},
            position: tool.position || { x: 0, y: 0 },
            width: tool.width || DEFAULT_TOOL_WIDTH,
            height: tool.height || DEFAULT_TOOL_HEIGHT,
            selected: selected ?? true,
          },
        ])
      }

      // add the edges

      for (const [id, { data }] of Object.entries(resources)) {
        for (const {
          value,
          sourceHandle,
          targetHandle,
        } of getResourceReferenceEntries(data)) {
          const source = id
          const target = value

          const edge = getEdges().find(
            (edge) =>
              edge.source === source &&
              edge.target === target &&
              edge.sourceHandle === sourceHandle
          )

          if (!edge) {
            addEdges([
              {
                id: getRandomId(`#edge:::`),
                source,
                sourceHandle,
                target,
                targetHandle,
                type: 'default',
              },
            ])
          }
        }
      }

      // @note add edges for tool nodes (e.g., filePreview tools referencing
      // file resources via fileId). Without this, getBlueprintGraph generates
      // tool edges but the React Flow state never has them, causing a
      // permanent edge diff after build.

      for (const [id, tool] of Object.entries(tools)) {
        const toolData = tool.data || {}

        for (const key of Object.keys(toolData)) {
          if (!key.endsWith('Id') || !toolData[key]) {
            continue
          }

          const edge = getEdges().find(
            (edge) =>
              edge.source === id &&
              edge.target === toolData[key] &&
              edge.sourceHandle === key
          )

          if (!edge) {
            addEdges([
              {
                id: getRandomId(`#edge:::`),
                source: id,
                sourceHandle: key,
                target: toolData[key],
                targetHandle: getReferenceFieldType(key),
                type: 'default',
                animated: true,
              },
            ])
          }
        }

        if (tool.type === 'tool:errorLog') {
          for (const {
            value,
            sourceHandle,
            targetHandle,
          } of getErrorLogToolResourceEntries(toolData)) {
            const edge = getEdges().find(
              (edge) =>
                edge.source === id &&
                edge.target === value &&
                edge.sourceHandle === sourceHandle
            )

            if (!edge) {
              addEdges([
                {
                  id: getRandomId(`#edge:::`),
                  source: id,
                  sourceHandle,
                  target: value,
                  targetHandle,
                  type: 'default',
                  animated: true,
                },
              ])
            }
          }
        }
      }
    },
    [addEdges, addNodes, getEdges, getNodes, setNodes, updateNode, nodeTypes]
  )

  const download = useCallback(
    async function download() {
      const code = await exportBlueprint()

      if (code) {
        saveBlob(new Blob([code], { type: 'application/yaml' }), {
          name: `${blueprint.name || 'blueprint'}.yaml`,
        })
      }
    },
    [blueprint.name, exportBlueprint]
  )

  const { copyToClipboard, pasteFromClipboard } = useClipboardContainer(
    'text/plain' // @note we cannot use custom ones
  )

  // @note keyboard shortcut for copy (Cmd/Ctrl+C)
  // @note we use a manual useEffect instead of useComboKeybinding so that we
  // can defer e.preventDefault() until after all guard checks pass. This
  // ensures the browser's native copy behaviour is preserved whenever the user
  // is copying ordinary text (e.g. inside a popup or a contenteditable area).
  useEffect(() => {
    async function onKeydown(e) {
      if (e.key !== 'c') {
        return
      }

      const isMac = navigator.platform.match('Mac')
      const isCtrlOrMeta = isMac ? e.metaKey : e.ctrlKey

      if (!isCtrlOrMeta) {
        return
      }

      if (shouldSkipCanvasKeyboardShortcut({ checkSelection: true })) {
        return
      }

      // @note only copy if there are selected canvas nodes
      const selectedNodes = getNodes().filter((node) => node.selected)

      if (!selectedNodes.length) {
        return
      }

      e.preventDefault()
      e.stopPropagation()

      const code = await exportBlueprint()

      if (code) {
        await copyToClipboard(code)

        toast.success('Blueprint exported from clipboard')
      }
    }

    window.addEventListener('keydown', onKeydown)

    return () => {
      window.removeEventListener('keydown', onKeydown)
    }
  }, [copyToClipboard, exportBlueprint, getNodes])

  // @note keyboard shortcut for select all (Cmd/Ctrl+A)
  // @note same guard as copy so text-editing contexts keep native select-all.
  useEffect(() => {
    function onKeydown(e) {
      if (e.key !== 'a') {
        return
      }

      const isMac = navigator.platform.match('Mac')
      const isCtrlOrMeta = isMac ? e.metaKey : e.ctrlKey

      if (!isCtrlOrMeta) {
        return
      }

      if (shouldSkipCanvasKeyboardShortcut()) {
        return
      }

      const currentNodes = getNodes()

      if (!currentNodes.length) {
        return
      }

      e.preventDefault()
      e.stopPropagation()

      setNodes((nodes) =>
        nodes.map((node) => ({
          ...node,
          selected: true,
        }))
      )
    }

    window.addEventListener('keydown', onKeydown)

    return () => {
      window.removeEventListener('keydown', onKeydown)
    }
  }, [getNodes, setNodes])

  // @note keyboard shortcut for paste (Cmd/Ctrl+V)
  // @note same rationale as above – guard checks run before e.preventDefault()
  // so that paste into focused inputs / contenteditable areas is not blocked.
  useEffect(() => {
    async function onKeydown(e) {
      if (e.key !== 'v') {
        return
      }

      const isMac = navigator.platform.match('Mac')
      const isCtrlOrMeta = isMac ? e.metaKey : e.ctrlKey

      if (!isCtrlOrMeta) {
        return
      }

      if (shouldSkipCanvasKeyboardShortcut()) {
        return
      }

      e.preventDefault()
      e.stopPropagation()

      const data = await pasteFromClipboard()

      if (data) {
        const code = await data.text()

        let relativePosition

        const blueprintData = tryParseYaml(code) || {}

        const {
          positions = {},
          notes = {},
          images = {},
          frames = {},
          tools = {},
        } = blueprintData

        const allPositions = [
          ...Object.values(positions),
          ...Object.values(notes).map((item) => item?.position),
          ...Object.values(images).map((item) => item?.position),
          ...Object.values(frames).map((item) => item?.position),
          ...Object.values(tools).map((item) => item?.position),
        ].filter(
          (position) =>
            position &&
            typeof position.x === 'number' &&
            typeof position.y === 'number'
        )

        if (allPositions.length) {
          const minX = Math.min(...allPositions.map((position) => position.x))
          const minY = Math.min(...allPositions.map((position) => position.y))

          relativePosition = {
            x: minX + 100,
            y: minY + 100,
          }
        }

        await importBlueprint(code, { relativePosition })

        toast.success('Blueprint imported from clipboard')
      }
    }

    window.addEventListener('keydown', onKeydown)

    return () => {
      window.removeEventListener('keydown', onKeydown)
    }
  }, [importBlueprint, pasteFromClipboard])

  useComboKeybinding(
    's',
    useCallback(async () => {
      if (!hasChanges) {
        return
      }

      await build()

      toast.success('Blueprint saved')
    }, [build, hasChanges])
  )

  useComboKeybinding(
    'e',
    useCallback(async () => {
      download()
    }, [download])
  )

  // @note keyboard shortcut for undo (Cmd/Ctrl+Z)
  useComboKeybinding('z', undo)

  // @note keyboard shortcut for redo (Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y)
  useEffect(() => {
    function onKeydown(e) {
      const isMac = navigator.platform.match('Mac')
      const isCtrlOrMeta = isMac ? e.metaKey : e.ctrlKey

      // @note handle Cmd/Ctrl+Shift+Z for redo
      if (e.key === 'z' && isCtrlOrMeta && e.shiftKey) {
        // @note skip if focus is in textarea or input
        if (
          document.activeElement &&
          ['textarea', 'input'].includes(
            document.activeElement.tagName.toLowerCase()
          )
        ) {
          return
        }

        e.preventDefault()
        e.stopPropagation()
        redo()
      }

      // @note handle Cmd/Ctrl+Y for redo (common on Windows)
      if (e.key === 'y' && isCtrlOrMeta && !e.shiftKey) {
        if (
          document.activeElement &&
          ['textarea', 'input'].includes(
            document.activeElement.tagName.toLowerCase()
          )
        ) {
          return
        }

        e.preventDefault()
        e.stopPropagation()
        redo()
      }
    }

    window.addEventListener('keydown', onKeydown)

    return () => {
      window.removeEventListener('keydown', onKeydown)
    }
  }, [redo])

  return (
    <BlueprintContext.Provider
      value={{
        name,
        setName,
        updateName,

        nodes,
        setNodes,

        edges,
        setEdges,

        onNodesChange,
        onEdgesChange,

        onNodeDragStart,
        onNodeDragStop,

        build,

        importBlueprint,
        exportBlueprint,

        download,

        hasChanges,

        loading,

        undo,
        redo,
        canUndo,
        canRedo,
        autoLayout,

        suppressEdgeSyncRef,
      }}
    >
      {children}
    </BlueprintContext.Provider>
  )
}

/**
 *
 */
export function useBlueprint() {
  return useContext(BlueprintContext)
}

/**
 *
 */
const ResourceDnDContext = createContext([null, (_) => {}])

/**
 *
 */
export function ResourceDnDProvider({
  type: _type = null,
  data: _data = null,

  children,
}) {
  const [type, setType] = useState(_type)
  const [data, setData] = useState(_data)

  return (
    <ResourceDnDContext.Provider value={[type, setType, data, setData]}>
      {children}
    </ResourceDnDContext.Provider>
  )
}

/**
 *
 */
export function useResourceDnD() {
  return useContext(ResourceDnDContext)
}

/**
 *
 */
const ConfiguratorContext = createContext([null, (_) => {}])

/**
 *
 */
export function ConfiguratorProvider({ children }) {
  const context = useState({})

  return (
    <SchemaPanelModeProvider storageKey="designer:configurator:mode">
      <SchemaPanelPositionProvider>
        <ConfiguratorContext.Provider value={context}>
          {children}
        </ConfiguratorContext.Provider>
      </SchemaPanelPositionProvider>
    </SchemaPanelModeProvider>
  )
}

/**
 *
 */
export function useConfigurator() {
  return useContext(ConfiguratorContext)
}

/**
 *
 */
export function getNoteSurfaceClasses(color = 'yellow') {
  const noteSurfaceClassesByColor = {
    yellow: {
      frame: 'bg-yellow-400 dark:bg-yellow-600',
      body: 'bg-yellow-50 dark:bg-yellow-950',
      header: 'bg-yellow-100 dark:bg-yellow-900',
    },
    red: {
      frame: 'bg-red-400 dark:bg-red-600',
      body: 'bg-red-50 dark:bg-red-950',
      header: 'bg-red-100 dark:bg-red-900',
    },
    green: {
      frame: 'bg-green-400 dark:bg-green-600',
      body: 'bg-green-50 dark:bg-green-950',
      header: 'bg-green-100 dark:bg-green-900',
    },
    blue: {
      frame: 'bg-blue-400 dark:bg-blue-600',
      body: 'bg-blue-50 dark:bg-blue-950',
      header: 'bg-blue-100 dark:bg-blue-900',
    },
    purple: {
      frame: 'bg-purple-400 dark:bg-purple-600',
      body: 'bg-purple-50 dark:bg-purple-950',
      header: 'bg-purple-100 dark:bg-purple-900',
    },
    pink: {
      frame: 'bg-pink-400 dark:bg-pink-600',
      body: 'bg-pink-50 dark:bg-pink-950',
      header: 'bg-pink-100 dark:bg-pink-900',
    },
  }

  return noteSurfaceClassesByColor[color] || noteSurfaceClassesByColor.yellow
}

/**
 *
 */
export function NoteNode({ id, data, selected }) {
  const { setNodes } = useReactFlow()

  const [text, setText] = useState(data.text ?? '')
  const noteSurfaceClasses = getNoteSurfaceClasses(data.color)

  const debouncedText = useDebounce(text, 500)

  useEffect(() => {
    setNodes((nodes) => {
      return nodes.map((node) => {
        if (node.id === id) {
          return {
            ...node,

            data: {
              ...node.data,

              text: debouncedText,
            },
          }
        }

        return node
      })
    })
  }, [id, setNodes, debouncedText])

  return (
    <>
      <NodeResizer minWidth={100} minHeight={30} isVisible={selected} />
      <div className="relative w-full h-full rounded-xl shadow-md overflow-hidden">
        <div
          className={clsx(
            'w-full h-full rounded-xl p-[2px]',
            noteSurfaceClasses.frame
          )}
        >
          <div
            className={clsx(
              'w-full h-full flex flex-col rounded-[10px]',
              noteSurfaceClasses.body
            )}
          >
            <div
              className={clsx(
                'shrink-0 w-full',
                'flex flex-row justify-end items-center',
                'px-2 py-1',
                'border-b border-black/10',
                'rounded-t-[10px]',
                noteSurfaceClasses.header
              )}
            >
              <div
                className={clsx(
                  'w-2 aspect-square',
                  'group',
                  'bg-black/10',
                  'cursor-pointer'
                )}
                onClick={() => {
                  setNodes((nodes) => {
                    return nodes.filter((node) => node.id !== id)
                  })
                }}
              >
                <XMarkIcon
                  className={clsx(
                    'w-full h-full',
                    'text-white',
                    'opacity-0 group-hover:opacity-100',
                    'transition-opacity duration-200 ease-in-out'
                  )}
                />
              </div>
            </div>
            <textarea
              className={clsx(
                'none-input flex-1 w-full h-full bg-transparent text-gray-900 dark:text-gray-100 p-2 resize-none text-xs',
                {
                  'nodrag nopan nowheel': !!selected,
                  'cursor-grab': !selected,
                }
              )}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        </div>
      </div>
    </>
  )
}

NoteNode.dimensions = {
  width: DEFAULT_BASEBOX_WIDTH,
  height: DEFAULT_BASEBOX_HEIGHT,
}

/**
 * Image Node Configurator - Allows configuring the image URL.
 */
export function ImageNodeConfigurator(props) {
  const { setNodes } = useReactFlow()

  const [target] = useDOMQuerySelector('#configurator-area')

  const id = props.id
  const value = props.data

  const setValue = useCallback(
    (newValue) => {
      setNodes((nodes) => {
        return updateConfiguratorNodes(nodes, id, newValue)
      })
    },
    [id, setNodes]
  )

  const schema = useMemo(
    () => ({
      type: 'object',
      properties: {
        url: {
          type: 'string',
          title: 'Image URL',
          description: 'The URL of the image to display.',
        },
        sizing: {
          type: 'string',
          title: 'Sizing',
          description: 'How the image should be sized within the container.',
          enum: ['cover', 'contain', 'tile'],
          enumNames: ['Cover (default)', 'Contain', 'Tile'],
          default: 'cover',
        },
      },
    }),
    []
  )

  return target
    ? createPortal(
        <SchemaPanel.Saving
          className="right-4 top-20"
          title="Image"
          schema={schema}
          value={value}
          setValue={setValue}
        />,
        target
      )
    : null
}

ImageNodeConfigurator.Memo = memo(ImageNodeConfigurator)

/**
 * Image Node - Displays an image on the canvas without borders.
 *
 * @note This annotation is designed to display images as backgrounds. The node
 * is created with zIndex: -1 to render below other nodes so it can be used as a
 * canvas background. The image can be resized and positioned anywhere.
 */
export function ImageNode({ id, data, selected }) {
  const url = data.url ?? ''
  const sizing = data.sizing ?? 'cover'
  const [hasMultiSelection, setHasMultiSelection] = useState(false)

  useOnSelectionChange({
    onChange: useCallback(
      ({ nodes }) => setHasMultiSelection(nodes.length > 1),
      []
    ),
  })

  // @note determine image styles based on sizing mode
  const imageStyles = useMemo(() => {
    if (sizing === 'tile') {
      return {
        backgroundImage: `url(${url})`,
        backgroundRepeat: 'repeat',
        backgroundSize: 'auto',
      }
    }

    return null
  }, [sizing, url])

  // @note determine object-fit class for non-tile modes
  const objectFitClass =
    sizing === 'contain' ? 'object-contain' : 'object-cover'

  return (
    <>
      <NodeResizer minWidth={100} minHeight={100} isVisible={selected} />
      <div
        className={clsx(
          'relative w-full h-full overflow-hidden',
          'pointer-events-auto'
        )}
      >
        {url ? (
          sizing === 'tile' ? (
            <div className="w-full h-full" style={imageStyles} />
          ) : (
            <DynamicImage
              src={url}
              alt=""
              className={clsx('w-full h-full', objectFitClass)}
              draggable={false}
            />
          )
        ) : (
          <div
            className={clsx(
              'w-full h-full flex items-center justify-center',
              'bg-gray-100 dark:bg-gray-800',
              'border border-dashed border-gray-300 dark:border-gray-600',
              'rounded-lg'
            )}
          >
            <div className="text-center auto-text-gray-500">
              <DynamicIcon
                name="@lucide/image"
                className="w-8 h-8 mx-auto mb-2 opacity-50"
              />
              <p className="text-xs">Click to add image URL</p>
            </div>
          </div>
        )}
      </div>
      {/* Configurator when selected */}
      {!hasMultiSelection && selected && (
        <ImageNodeConfigurator.Memo id={id} type="image" data={data} />
      )}
    </>
  )
}

ImageNode.dimensions = {
  width: DEFAULT_BASEBOX_WIDTH,
  height: DEFAULT_BASEBOX_HEIGHT,
}

/**
 * Frame Annotation - Visual canvas grouping for related nodes.
 */
export function FrameNode({ id, data, selected }) {
  const { mode } = useResources()
  const { setNodes } = useReactFlow()

  const [title, setTitle] = useState(data.title ?? 'Frame')

  const debouncedTitle = useDebounce(title, 300)

  useEffect(() => {
    // @note skip node mutations in public preview mode
    if (mode === MODE_PUBLIC_PREVIEW) {
      return
    }

    setNodes((nodes) => {
      return nodes.map((node) => {
        if (node.id !== id) {
          return node
        }

        return {
          ...node,
          data: {
            ...node.data,
            title: debouncedTitle,
          },
        }
      })
    })
  }, [id, setNodes, debouncedTitle, mode])

  return (
    <>
      <div className="relative w-full h-full pointer-events-none">
        {/* Visual border - decorative only */}
        <div
          className={clsx(
            'absolute inset-0 rounded-xl border-2 border-dashed',
            'border-pink-400/60 dark:border-pink-500/60',
            'pointer-events-none'
          )}
        />
        {/* Clickable border strips - only the edges are selectable. Inset from 
            corners so NodeResizer handles stay accessible. Tinted to hint that
            edges are the clickable/selectable area. */}
        <div className="absolute top-0 left-3 right-3 h-3 pointer-events-auto hover:bg-pink-400/10 transition-colors" />
        <div className="absolute bottom-0 left-3 right-3 h-3 pointer-events-auto hover:bg-pink-400/10 transition-colors" />
        <div className="absolute top-3 bottom-3 left-0 w-3 pointer-events-auto hover:bg-pink-400/10 transition-colors" />
        <div className="absolute top-3 bottom-3 right-0 w-3 pointer-events-auto hover:bg-pink-400/10 transition-colors" />
        {/* Title area - always interactive */}
        <div className="absolute top-3 left-3 flex flex-row items-center gap-2 pointer-events-auto">
          <DynamicIcon
            icon="@lucide/folder"
            className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400"
          />
          <input
            className={clsx(
              'none-input text-xs font-medium',
              'bg-transparent border-none rounded-none px-0 py-0 w-44',
              { 'nodrag nopan nowheel': !!selected }
            )}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Frame name"
            aria-label="Frame name"
          />
        </div>
      </div>
      {/* @note rendered last so its resize handles paint/hit-test above border strips.
          @note explicit pointer-events: auto because the wrapper is pointer-events: none
          and the default value does not reliably restore hit-testing on descendants. */}
      <NodeResizer
        minWidth={240}
        minHeight={140}
        isVisible={selected}
        handleStyle={{ pointerEvents: 'auto' }}
        lineStyle={{ pointerEvents: 'auto' }}
      />
    </>
  )
}

FrameNode.dimensions = {
  width: DEFAULT_FRAME_WIDTH,
  height: DEFAULT_FRAME_HEIGHT,
}

/**
 * File Preview Tool Configurator - Allows configuring refresh interval.
 */
export function FilePreviewToolConfigurator(props) {
  const { setNodes } = useReactFlow()

  const [target] = useDOMQuerySelector('#configurator-area')

  const id = props.id
  const value = props.data

  const setValue = useCallback(
    (newValue) => {
      setNodes((nodes) => {
        return updateConfiguratorNodes(nodes, id, newValue)
      })
    },
    [id, setNodes]
  )

  const schema = useMemo(
    () => ({
      type: 'object',
      properties: {
        name: {
          type: 'string',
          title: 'Name',
          description: 'A name for this file preview tool.',
        },
        refreshInterval: {
          type: 'number',
          title: 'Refresh Interval (seconds)',
          description:
            'How often to refresh the file content. Set to 0 to disable auto-refresh.',
          default: 30,
          minimum: 0,
          maximum: 3600,
        },
      },
    }),
    []
  )

  return target
    ? createPortal(
        <SchemaPanel.Saving
          className="right-4 top-20"
          title={value.name || 'File Preview'}
          schema={schema}
          value={value}
          setValue={setValue}
        />,
        target
      )
    : null
}

FilePreviewToolConfigurator.Memo = memo(FilePreviewToolConfigurator)

/**
 * File Preview Tool - Shows file content with configurable auto-refresh.
 */
export function FilePreviewToolNode({ id, data, selected }) {
  const { mode } = useResources()
  const { fetch } = useFetch()
  const { getNodes } = useReactFlow()

  const [fileContent, setFileContent] = useState(null)
  const [fileName, setFileName] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [hasMultiSelection, setHasMultiSelection] = useState(false)

  useOnSelectionChange({
    onChange: useCallback(
      ({ nodes }) => setHasMultiSelection(nodes.length > 1),
      []
    ),
  })

  // Get the connected fileId from node data (set by onConnect)

  const fileId = data.fileId || null

  const refreshInterval = data.refreshInterval ?? 30

  // Get the file name from the connected node

  useEffect(() => {
    if (fileId) {
      const nodes = getNodes()
      const fileNode = nodes.find((node) => node.id === fileId)

      if (fileNode?.data?.name) {
        setFileName(fileNode.data.name)
      }
    } else {
      setFileName(null)
    }
  }, [fileId, getNodes])

  // Load file content

  const loadFileContent = useCallback(async () => {
    // @note skip data loading in public preview mode
    if (mode === MODE_PUBLIC_PREVIEW) {
      return
    }

    // @note fileId starting with '#' indicates an unsaved node
    if (!fileId || fileId.startsWith('#')) {
      setFileContent(null)
      setError(null)

      return
    }

    setLoading(true)
    setError(null)

    try {
      // @note download as arraybuffer first to sniff content type
      const { data: fileData, error: fetchError } = await fetch(
        `/api/v1/file/${fileId}/download`,
        { dataType: 'arrayBuffer' }
      )

      if (fetchError) {
        setError(fetchError)
        setFileContent(null)

        return
      }

      // @note empty files are treated as text with empty content
      if (fileData.byteLength === 0) {
        setFileContent('')
        setLastRefresh(new Date())

        return
      }

      // @note use content sniffing to detect if file is text
      if (!isText(fileData)) {
        setError('Cannot preview binary file')
        setFileContent(null)

        return
      }

      const textContent = new TextDecoder().decode(fileData)

      setFileContent(textContent)
      setLastRefresh(new Date())
    } catch (err) {
      setError(err.message || 'Failed to load file')
      setFileContent(null)
    } finally {
      setLoading(false)
    }
  }, [fileId, fetch, mode])

  // @note initial load; recurring refresh is driven by RefreshTimer

  useEffect(() => {
    loadFileContent()
  }, [loadFileContent])

  return (
    <>
      {/* Source handle to connect to files */}
      <Handle
        id="fileId"
        type="source"
        position={Position.Left}
        className={clsx(
          'w-3 h-3',
          'border-2 border-gray-400',
          'bg-white dark:bg-gray-800',
          'rounded-full',
          '-ml-1.5'
        )}
        isConnectable={true}
        isValidConnection={(conn) =>
          isReferenceFieldFor(conn.sourceHandle, conn.targetHandle)
        }
      />

      <NodeResizer
        minWidth={DEFAULT_TOOL_WIDTH}
        minHeight={DEFAULT_TOOL_HEIGHT}
        isVisible={selected}
      />

      <div
        className={clsx(
          'relative w-full h-full flex flex-col rounded-lg overflow-hidden border',
          'bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-600'
        )}
      >
        <div
          className={clsx(
            'shrink-0 w-full',
            'flex flex-row items-center gap-2',
            'px-3 py-2',
            'bg-amber-100 dark:bg-amber-800/50'
          )}
        >
          <DynamicIcon name="@lucide/file-text" className="w-4 h-4 shrink-0" />
          <span className="flex-1 text-xs font-medium truncate">
            {data.name || 'File Preview'}
            {fileName && (
              <span className="ml-1 auto-text-gray-500">({fileName})</span>
            )}
          </span>
          {fileId && refreshInterval > 0 ? (
            <RefreshTimer
              interval={refreshInterval}
              onRefresh={loadFileContent}
              loading={loading}
              className="text-[9px]"
            />
          ) : lastRefresh ? (
            <span className="text-[9px] auto-text-gray-400">
              {lastRefresh.toLocaleTimeString()}
            </span>
          ) : null}
        </div>

        <div
          className={clsx('flex-1 overflow-auto p-2', {
            'nodrag nopan nowheel': !!selected,
            'cursor-grab': !selected,
          })}
        >
          {mode === MODE_PUBLIC_PREVIEW ? (
            <div className="flex items-center justify-center h-full text-xs auto-text-gray-500">
              <div className="text-center">
                <DynamicIcon
                  name="@lucide/file-text"
                  className="w-6 h-6 mx-auto mb-2 opacity-50"
                />
                <p>File Preview</p>
                <p className="text-[10px] mt-1 opacity-75">
                  Previews file content when deployed
                </p>
              </div>
            </div>
          ) : !fileId ? (
            <div className="flex items-center justify-center h-full text-xs auto-text-gray-500">
              <div className="text-center">
                <DynamicIcon
                  name="@lucide/link"
                  className="w-6 h-6 mx-auto mb-2 opacity-50"
                />
                <p>Connect to a file to preview its content</p>
                <p className="text-[10px] mt-1 opacity-75">
                  Drag from the handle to a file node
                </p>
              </div>
            </div>
          ) : loading && fileContent === null ? (
            <div className="flex items-center justify-center h-full">
              <Spinner className="w-6 h-6" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-xs text-red-500">
              <div className="text-center">
                <DynamicIcon
                  name="@lucide/circle-alert"
                  className="w-6 h-6 mx-auto mb-2"
                />
                <p>{error}</p>
              </div>
            </div>
          ) : fileContent === '' ? (
            <div className="flex items-center justify-center h-full text-xs auto-text-gray-500">
              <div className="text-center">
                <DynamicIcon
                  name="@lucide/file-x"
                  className="w-6 h-6 mx-auto mb-2 opacity-50"
                />
                <p>File is empty</p>
                <p className="text-[10px] mt-1 opacity-75">
                  Content will appear when the file has data
                </p>
              </div>
            </div>
          ) : (
            <pre className="text-[10px] whitespace-pre-wrap break-words font-mono auto-text-gray-700">
              {fileContent}
            </pre>
          )}
        </div>
      </div>
      {/* Configurator when selected */}
      {!hasMultiSelection && selected && (
        <FilePreviewToolConfigurator.Memo
          id={id}
          type="tool:filePreview"
          data={data}
        />
      )}
    </>
  )
}

/**
 * Checks whether a file path is considered hidden, i.e. it starts with a dot
 * or contains a segment that starts with a dot.
 *
 * @param {string} filePath
 * @returns {boolean}
 */
function isHiddenPath(filePath) {
  if (!filePath) {
    return false
  }

  return filePath
    .split('/')
    .some(
      (segment) =>
        segment.startsWith('.') && segment !== '.' && segment !== '..'
    )
}

/**
 * Space File Browser Tool Configurator - Allows configuring the file browser.
 */
export function SpaceFileBrowserToolConfigurator(props) {
  const { setNodes } = useReactFlow()

  const [target] = useDOMQuerySelector('#configurator-area')

  const id = props.id
  const value = props.data

  const setValue = useCallback(
    (newValue) => {
      setNodes((nodes) => {
        return updateConfiguratorNodes(nodes, id, newValue)
      })
    },
    [id, setNodes]
  )

  const schema = useMemo(
    () => ({
      type: 'object',
      properties: {
        name: {
          type: 'string',
          title: 'Name',
          description: 'A name for this file browser tool.',
        },
        refreshInterval: {
          type: 'number',
          title: 'Refresh Interval (seconds)',
          description:
            'How often to refresh the file list. Set to 0 to disable auto-refresh.',
          default: 30,
          minimum: 0,
          maximum: 3600,
        },
        path: {
          type: 'string',
          title: 'Path',
          description:
            'The path within the space to browse. Defaults to root (/).',
          default: '/',
        },
        recursive: {
          type: 'boolean',
          title: 'Recursive',
          description: 'List files recursively in subdirectories.',
          default: true,
        },
        hidden: {
          type: 'boolean',
          title: 'Hidden',
          description:
            'Show files and directories that start with a dot (e.g. .skills, .github).',
          default: false,
        },
      },
    }),
    []
  )

  return target
    ? createPortal(
        <SchemaPanel.Saving
          className="right-4 top-20"
          title={value.name || 'Space File Browser'}
          schema={schema}
          value={value}
          setValue={setValue}
        />,
        target
      )
    : null
}

SpaceFileBrowserToolConfigurator.Memo = memo(SpaceFileBrowserToolConfigurator)

/**
 * Space File Browser Tool - Shows files in a space with download capability.
 * Connect to a space node to browse its files.
 */
export function SpaceFileBrowserToolNode({ id, data, selected }) {
  const { mode } = useResources()
  const { fetch } = useFetch()
  const { getNodes } = useReactFlow()

  const [files, setFiles] = useState([])
  const [spaceName, setSpaceName] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [hasMultiSelection, setHasMultiSelection] = useState(false)

  useOnSelectionChange({
    onChange: useCallback(
      ({ nodes }) => setHasMultiSelection(nodes.length > 1),
      []
    ),
  })

  // Get the connected spaceId from node data (set by onConnect)

  const spaceId = data.spaceId || null
  const path = data.path || '/'
  const recursive = data.recursive ?? true
  const hidden = data.hidden ?? false

  const refreshInterval = data.refreshInterval ?? 30
  const isPublicPreview = mode === MODE_PUBLIC_PREVIEW

  // Get the space name from the connected node

  useEffect(() => {
    if (spaceId) {
      const nodes = getNodes()
      const spaceNode = nodes.find((node) => node.id === spaceId)

      if (spaceNode?.data?.name) {
        setSpaceName(spaceNode.data.name)
      }
    } else {
      setSpaceName(null)
    }
  }, [spaceId, getNodes])

  // Load space files

  const loadSpaceFiles = useCallback(async () => {
    // @note skip data loading in public preview mode

    if (isPublicPreview) {
      return
    }

    // @note spaceId starting with '#' indicates an unsaved node

    if (!spaceId || spaceId.startsWith('#')) {
      setFiles([])
      setError(null)

      return
    }

    setLoading(true)
    setError(null)

    try {
      // Normalize path: '/' means root (no path segment needed)

      const normalizedPath = path === '/' ? null : path

      const { data: listData, error: fetchError } = await fetch(
        `/api/v1/space/${spaceId}/storage/list${
          normalizedPath ? `/${encodePath(normalizedPath)}` : ''
        }?recursive=${recursive}`,
        {}
      )

      if (fetchError) {
        setError(fetchError)
        setFiles([])

        return
      }

      // Filter out directories, keep only files

      // @note hidden files (paths starting with . or containing /.) are
      // filtered by default unless hidden is enabled

      const fileItems = (listData?.items || []).filter(
        (item) => !item.isDirectory && (hidden || !isHiddenPath(item.path))
      )

      setFiles(fileItems)
      setLastRefresh(new Date())
    } catch (err) {
      setError(err.message || 'Failed to load files')
      setFiles([])
    } finally {
      setLoading(false)
    }
  }, [spaceId, path, recursive, hidden, fetch, isPublicPreview])

  // @note initial load; recurring refresh is driven by RefreshTimer

  useEffect(() => {
    if (isPublicPreview) {
      return
    }

    loadSpaceFiles()
  }, [loadSpaceFiles, isPublicPreview])

  // Format file size

  const formatFileSize = useCallback((bytes) => {
    if (!bytes) {
      return 'Unknown'
    }

    const KB = 1024
    const MB = KB * 1024

    if (bytes < KB) {
      return `${bytes} B`
    }

    if (bytes < MB) {
      return `${(bytes / KB).toFixed(1)} KB`
    }

    return `${(bytes / MB).toFixed(1)} MB`
  }, [])

  const { popup: createPopup, openPopup, closePopup } = usePopup()

  const {
    popup: fileActionsPopup,
    handleFilePreview,
    handleFileDelete,
  } = useSpaceFileActions(spaceId, { onFilesChanged: loadSpaceFiles })

  const handleCreateFile = useCallback(() => {
    // @note public previews must never mutate space storage
    if (isPublicPreview) {
      return
    }

    const doCreate = async (filePath) => {
      const trimmed = (filePath || '').trim()

      if (!trimmed) {
        toast.error('Please enter a file path')

        return
      }

      const toastId = toast.loading('Creating file...', {})

      try {
        const emptyBlob = new Blob([''], { type: 'text/plain' })

        const { error: uploadError, data: uploadData } = await fetch(
          `/api/v1/space/${spaceId}/storage/upload/${encodePath(trimmed)}`,
          {
            data: { file: { type: 'text/plain', size: 0 } },
          }
        )

        if (uploadError || !uploadData) {
          throw new Error('Failed to get upload URL')
        }

        if (uploadData.uploadRequest) {
          const { method, url, headers } = uploadData.uploadRequest

          const response = await window.fetch(url, {
            method,
            headers: headers ?? {},
            body: emptyBlob,
          })

          if (!response.ok) {
            throw new Error('Failed to create file')
          }
        }

        toast.success('File created!', { id: toastId })

        await loadSpaceFiles()

        closePopup()
      } catch (e) {
        toast.error(e.message, { id: toastId })
      }
    }

    openPopup(
      () => (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium auto-text-gray-700">
            File path / name
          </label>
          <input
            className="default-input"
            type="text"
            name="filePath"
            placeholder="e.g. notes/readme.md"
            required
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                doCreate(e.currentTarget.value)
              }
            }}
          />
          <span className="text-xs auto-text-gray-400">
            Use forward slashes for subdirectories.
          </span>
        </div>
      ),
      {
        title: 'Create File',
        cancelButtonCaption: 'Cancel',
        actions: {
          Create: {
            default: true,
            fn: (data) => doCreate(data.filePath),
          },
        },
      }
    )
  }, [spaceId, fetch, openPopup, closePopup, loadSpaceFiles, isPublicPreview])

  return (
    <>
      {createPopup}
      {fileActionsPopup}
      {/* Source handle to connect to spaces */}
      <Handle
        id="spaceId"
        type="source"
        position={Position.Left}
        className={clsx(
          'w-3 h-3',
          'border-2 border-gray-400',
          'bg-white dark:bg-gray-800',
          'rounded-full',
          '-ml-1.5'
        )}
        isConnectable={true}
        isValidConnection={(conn) =>
          isReferenceFieldFor(conn.sourceHandle, conn.targetHandle)
        }
      />

      <NodeResizer
        minWidth={DEFAULT_TOOL_WIDTH}
        minHeight={DEFAULT_TOOL_HEIGHT}
        isVisible={selected}
      />

      <div
        className={clsx(
          'relative w-full h-full flex flex-col rounded-lg overflow-hidden border',
          'bg-violet-50 dark:bg-violet-900/30 border-violet-300 dark:border-violet-600'
        )}
      >
        <div
          className={clsx(
            'shrink-0 w-full',
            'flex flex-row items-center gap-2',
            'px-3 py-2',
            'bg-violet-100 dark:bg-violet-800/50'
          )}
        >
          <DynamicIcon
            name="@lucide/folder-open"
            className="w-4 h-4 shrink-0"
          />
          <span className="flex-1 text-xs font-medium truncate">
            {data.name || 'Space File Browser'}
            {spaceName && (
              <span className="ml-1 auto-text-gray-500">({spaceName})</span>
            )}
          </span>
          {files.length > 0 ? (
            <span className="text-[9px] auto-text-gray-400">
              {files.length} file{files.length !== 1 ? 's' : ''}
            </span>
          ) : null}
          {!isPublicPreview && spaceId && !spaceId.startsWith('#') ? (
            <button
              type="button"
              title="Create new file"
              className="nodrag flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-violet-200 dark:bg-violet-700/60 hover:bg-violet-300 dark:hover:bg-violet-600/60 auto-text-gray-700"
              onClick={handleCreateFile}
            >
              <DynamicIcon name="@lucide/file-plus" className="w-3 h-3" />
              New
            </button>
          ) : null}
          {!isPublicPreview && spaceId && refreshInterval > 0 ? (
            <RefreshTimer
              interval={refreshInterval}
              onRefresh={loadSpaceFiles}
              loading={loading}
              className="text-[9px]"
            />
          ) : lastRefresh ? (
            <span className="text-[9px] auto-text-gray-400">
              {lastRefresh.toLocaleTimeString()}
            </span>
          ) : null}
        </div>

        <div
          className={clsx('flex-1 overflow-auto p-2', {
            'nodrag nopan nowheel': !!selected,
            'cursor-grab': !selected,
          })}
        >
          {isPublicPreview ? (
            <div className="flex items-center justify-center h-full text-xs auto-text-gray-500">
              <div className="text-center">
                <DynamicIcon
                  name="@lucide/folder-open"
                  className="w-6 h-6 mx-auto mb-2 opacity-50"
                />
                <p>Space File Browser</p>
                <p className="text-[10px] mt-1 opacity-75">
                  Browses space files when deployed
                </p>
              </div>
            </div>
          ) : !spaceId ? (
            <div className="flex items-center justify-center h-full text-xs auto-text-gray-500">
              <div className="text-center">
                <DynamicIcon
                  name="@lucide/link"
                  className="w-6 h-6 mx-auto mb-2 opacity-50"
                />
                <p>Connect to a space to browse files</p>
                <p className="text-[10px] mt-1 opacity-75">
                  Drag from the handle to a space node
                </p>
              </div>
            </div>
          ) : loading && files.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <Spinner className="w-6 h-6" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-xs text-red-500">
              <div className="text-center">
                <DynamicIcon
                  name="@lucide/circle-alert"
                  className="w-6 h-6 mx-auto mb-2"
                />
                <p>{error}</p>
              </div>
            </div>
          ) : files.length === 0 ? (
            <div className="flex items-center justify-center h-full text-xs auto-text-gray-500">
              <div className="text-center">
                <DynamicIcon
                  name="@lucide/folder"
                  className="w-6 h-6 mx-auto mb-2 opacity-50"
                />
                <p>No files in this space</p>
                {!spaceId.startsWith('#') ? (
                  <button
                    type="button"
                    className="nodrag mt-2 px-2 py-1 rounded text-[10px] font-medium bg-violet-100 dark:bg-violet-800/50 hover:bg-violet-200 dark:hover:bg-violet-700/50 auto-text-gray-700"
                    onClick={handleCreateFile}
                  >
                    + Create a file
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {files.map((file) => {
                return (
                  <div
                    key={file.path}
                    className={clsx(
                      'nodrag flex flex-row items-center gap-2 p-1.5 rounded',
                      'text-[10px]',
                      'bg-white/50 dark:bg-black/20',
                      'hover:bg-white dark:hover:bg-black/40',
                      'transition-colors group'
                    )}
                  >
                    <DynamicIcon
                      name="@lucide/file"
                      className="w-3 h-3 shrink-0 auto-text-gray-400"
                    />
                    <span
                      className="flex-1 truncate cursor-pointer hover:underline"
                      title={file.path}
                      onClick={() => handleFilePreview(file)}
                    >
                      {file.path}
                    </span>
                    <span className="shrink-0 auto-text-gray-400">
                      {formatFileSize(file.size)}
                    </span>
                    <button
                      type="button"
                      title="Delete file"
                      className="nodrag shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:text-red-500"
                      onClick={() => handleFileDelete(file)}
                    >
                      <DynamicIcon name="@lucide/trash-2" className="w-3 h-3" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
      {/* Configurator when selected */}
      {!hasMultiSelection && selected && (
        <SpaceFileBrowserToolConfigurator.Memo
          id={id}
          type="tool:spaceFileBrowser"
          data={data}
        />
      )}
    </>
  )
}

/**
 * Space Skill Browser Configurator - Allows configuring the skill browser tool.
 */
export function SpaceSkillBrowserConfigurator(props) {
  const { setNodes } = useReactFlow()

  const [target] = useDOMQuerySelector('#configurator-area')

  const id = props.id
  const value = props.data

  const setValue = useCallback(
    (newValue) => {
      setNodes((nodes) => {
        return updateConfiguratorNodes(nodes, id, newValue)
      })
    },
    [id, setNodes]
  )

  const schema = useMemo(
    () => ({
      type: 'object',
      properties: {
        name: {
          type: 'string',
          title: 'Name',
          description: 'A name for this skills tool.',
        },
        refreshInterval: {
          type: 'number',
          title: 'Refresh Interval (seconds)',
          description:
            'How often to refresh the skills list. Set to 0 to disable auto-refresh.',
          default: 30,
          minimum: 0,
          maximum: 3600,
        },
      },
    }),
    []
  )

  return target
    ? createPortal(
        <SchemaPanel.Saving
          className="right-4 top-20"
          title={value.name || 'Space Skill Browser'}
          schema={schema}
          value={value}
          setValue={setValue}
        />,
        target
      )
    : null
}

SpaceSkillBrowserConfigurator.Memo = memo(SpaceSkillBrowserConfigurator)

/**
 * Space Skill Browser - Shows installed skills in a space and allows installing
 * new skills from the skills.sh catalogue. Connect to a space node to manage
 * its skills.
 */
export function SpaceSkillBrowserNode({ id, data, selected }) {
  const { mode } = useResources()
  const { fetch } = useFetch()
  const { getNodes } = useReactFlow()

  const [skills, setSkills] = useState([])
  const [spaceName, setSpaceName] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [hasMultiSelection, setHasMultiSelection] = useState(false)

  useOnSelectionChange({
    onChange: useCallback(
      ({ nodes }) => setHasMultiSelection(nodes.length > 1),
      []
    ),
  })

  const spaceId = data.spaceId || null

  const refreshInterval = data.refreshInterval ?? 30
  const isPublicPreview = mode === MODE_PUBLIC_PREVIEW

  // Get the space name from the connected node

  useEffect(() => {
    if (spaceId) {
      const nodes = getNodes()
      const spaceNode = nodes.find((node) => node.id === spaceId)

      if (spaceNode?.data?.name) {
        setSpaceName(spaceNode.data.name)
      }
    } else {
      setSpaceName(null)
    }
  }, [spaceId, getNodes])

  // Load installed skills from the space

  const loadSkills = useCallback(async () => {
    if (isPublicPreview) {
      return
    }

    if (!spaceId || spaceId.startsWith('#')) {
      setSkills([])
      setError(null)

      return
    }

    setLoading(true)
    setError(null)

    try {
      // @note list files under .skills/ to find installed skill directories

      const { data: listData, error: fetchError } = await fetch(
        `/api/v1/space/${spaceId}/storage/list/.skills?recursive=true`,
        {}
      )

      if (fetchError) {
        // @note .skills directory may not exist yet, treat as empty
        setSkills([])
        setError(null)

        return
      }

      // @note find SKILL.md files and extract skill info
      const skillFiles = (listData?.items || []).filter(
        (item) => !item.isDirectory && item.path.endsWith('/SKILL.md')
      )

      const skillItems = skillFiles.map((file) => {
        const parts = file.path.split('/')
        const slug = parts.length >= 2 ? parts[parts.length - 2] : file.path

        return {
          path: `.skills/${file.path}`,
          deletePath: `.skills/${slug}`,
          deleteRecursive: true,
          slug: slug,
          name: slug,
          size: file.size,
        }
      })

      setSkills(skillItems)
      setLastRefresh(new Date())
    } catch (err) {
      setError(err.message || 'Failed to load skills')
      setSkills([])
    } finally {
      setLoading(false)
    }
  }, [spaceId, fetch, isPublicPreview])

  // @note initial load; recurring refresh is driven by RefreshTimer

  useEffect(() => {
    if (isPublicPreview) {
      return
    }

    loadSkills()
  }, [loadSkills, isPublicPreview])

  // Skill browser popup

  const { popup: skillBrowserPopup, openSkillBrowser } = useSkillBrowser({
    spaceId,
    onInstalled: loadSkills,
  })

  const { popup: skillActionsPopup, handleFilePreview: handleViewSkill } =
    useSpaceFileActions(spaceId, { onFilesChanged: loadSkills })

  const handleAddSkill = useCallback(() => {
    // @note public previews must never mutate space storage
    if (isPublicPreview) {
      return
    }

    openSkillBrowser()
  }, [openSkillBrowser, isPublicPreview])

  return (
    <>
      {skillBrowserPopup}
      {skillActionsPopup}
      {/* Source handle to connect to spaces */}
      <Handle
        id="spaceId"
        type="source"
        position={Position.Left}
        className={clsx(
          'w-3 h-3',
          'border-2 border-gray-400',
          'bg-white dark:bg-gray-800',
          'rounded-full',
          '-ml-1.5'
        )}
        isConnectable={true}
        isValidConnection={(conn) =>
          isReferenceFieldFor(conn.sourceHandle, conn.targetHandle)
        }
      />

      <NodeResizer
        minWidth={DEFAULT_TOOL_WIDTH}
        minHeight={DEFAULT_TOOL_HEIGHT}
        isVisible={selected}
      />

      <div
        className={clsx(
          'relative w-full h-full flex flex-col rounded-lg overflow-hidden border',
          'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-600'
        )}
      >
        <div
          className={clsx(
            'shrink-0 w-full',
            'flex flex-row items-center gap-2',
            'px-3 py-2',
            'bg-emerald-100 dark:bg-emerald-800/50'
          )}
        >
          <DynamicIcon name="@lucide/puzzle" className="w-4 h-4 shrink-0" />
          <span className="flex-1 text-xs font-medium truncate">
            {data.name || 'Space Skill Browser'}
            {spaceName && (
              <span className="ml-1 auto-text-gray-500">({spaceName})</span>
            )}
          </span>
          {skills.length > 0 ? (
            <span className="text-[9px] auto-text-gray-400">
              {skills.length} skill{skills.length !== 1 ? 's' : ''}
            </span>
          ) : null}
          {!isPublicPreview && spaceId && !spaceId.startsWith('#') ? (
            <button
              type="button"
              title="Install skill from catalogue"
              className="nodrag flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-200 dark:bg-emerald-700/60 hover:bg-emerald-300 dark:hover:bg-emerald-600/60 auto-text-gray-700"
              onClick={handleAddSkill}
            >
              <DynamicIcon name="@lucide/plus" className="w-3 h-3" />
              Add
            </button>
          ) : null}
          {!isPublicPreview && spaceId && refreshInterval > 0 ? (
            <RefreshTimer
              interval={refreshInterval}
              onRefresh={loadSkills}
              loading={loading}
              className="text-[9px]"
            />
          ) : lastRefresh ? (
            <span className="text-[9px] auto-text-gray-400">
              {lastRefresh.toLocaleTimeString()}
            </span>
          ) : null}
        </div>

        <div
          className={clsx('flex-1 overflow-auto p-2', {
            'nodrag nopan nowheel': !!selected,
            'cursor-grab': !selected,
          })}
        >
          {isPublicPreview ? (
            <div className="flex items-center justify-center h-full text-xs auto-text-gray-500">
              <div className="text-center">
                <DynamicIcon
                  name="@lucide/puzzle"
                  className="w-6 h-6 mx-auto mb-2 opacity-50"
                />
                <p>Space Skill Browser</p>
                <p className="text-[10px] mt-1 opacity-75">
                  Manages space skills when deployed
                </p>
              </div>
            </div>
          ) : !spaceId ? (
            <div className="flex items-center justify-center h-full text-xs auto-text-gray-500">
              <div className="text-center">
                <DynamicIcon
                  name="@lucide/link"
                  className="w-6 h-6 mx-auto mb-2 opacity-50"
                />
                <p>Connect to a space to manage skills</p>
                <p className="text-[10px] mt-1 opacity-75">
                  Drag from the handle to a space node
                </p>
              </div>
            </div>
          ) : loading && skills.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <Spinner className="w-6 h-6" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-xs text-red-500">
              <div className="text-center">
                <DynamicIcon
                  name="@lucide/circle-alert"
                  className="w-6 h-6 mx-auto mb-2"
                />
                <p>{error}</p>
              </div>
            </div>
          ) : skills.length === 0 ? (
            <div className="flex items-center justify-center h-full text-xs auto-text-gray-500">
              <div className="text-center">
                <DynamicIcon
                  name="@lucide/puzzle"
                  className="w-6 h-6 mx-auto mb-2 opacity-50"
                />
                <p>No skills installed</p>
                {!spaceId.startsWith('#') ? (
                  <button
                    type="button"
                    className="nodrag mt-2 px-2 py-1 rounded text-[10px] font-medium bg-emerald-100 dark:bg-emerald-800/50 hover:bg-emerald-200 dark:hover:bg-emerald-700/50 auto-text-gray-700"
                    onClick={handleAddSkill}
                  >
                    + Install a skill
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {skills.map((skill) => (
                <div
                  key={skill.path}
                  className={clsx(
                    'nodrag flex flex-row items-center gap-2 p-1.5 rounded',
                    'text-[10px]',
                    'bg-white/50 dark:bg-black/20',
                    'hover:bg-white dark:hover:bg-black/40',
                    'transition-colors cursor-pointer'
                  )}
                  onClick={() =>
                    handleViewSkill({ path: skill.path, name: skill.name })
                  }
                >
                  <DynamicIcon
                    name="@lucide/puzzle"
                    className="w-3 h-3 shrink-0 auto-text-gray-400"
                  />
                  <span className="flex-1 truncate" title={skill.path}>
                    {skill.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Configurator when selected */}
      {!hasMultiSelection && selected && (
        <SpaceSkillBrowserConfigurator.Memo
          id={id}
          type="tool:spaceSkillBrowser"
          data={data}
        />
      )}
    </>
  )
}

/**
 * Report ID for bot stats
 */
const BOT_STATS_REPORT_ID = 'clr3m5n8k000e08jqbs0t1u5o'

/**
 * Bot Stats Tool Configurator - Allows configuring the stats display.
 */
export function BotStatsToolConfigurator(props) {
  const { setNodes } = useReactFlow()

  const [target] = useDOMQuerySelector('#configurator-area')

  const id = props.id
  const value = props.data

  const setValue = useCallback(
    (newValue) => {
      setNodes((nodes) => {
        return updateConfiguratorNodes(nodes, id, newValue)
      })
    },
    [id, setNodes]
  )

  const schema = useMemo(
    () => ({
      type: 'object',
      properties: {
        name: {
          type: 'string',
          title: 'Name',
          description: 'A name for this bot stats tool.',
        },
        periodDays: {
          type: 'number',
          title: 'Period (days)',
          description: 'The number of days to include in the stats.',
          default: 30,
          minimum: 1,
          maximum: 365,
        },
        refreshInterval: {
          type: 'number',
          title: 'Refresh Interval (seconds)',
          description:
            'How often to refresh the stats. Set to 0 to disable auto-refresh.',
          default: 30,
          minimum: 0,
          maximum: 3600,
        },
      },
    }),
    []
  )

  return target
    ? createPortal(
        <SchemaPanel.Saving
          className="right-4 top-20"
          title={value.name || 'Bot Stats'}
          schema={schema}
          value={value}
          setValue={setValue}
        />,
        target
      )
    : null
}

BotStatsToolConfigurator.Memo = memo(BotStatsToolConfigurator)

/**
 * Bot Stats Tool - Shows bot statistics (conversations, messages, ratings, sentiment).
 * Connect to a bot to display its stats.
 */
export function BotStatsToolNode({ id, data, selected }) {
  const { mode } = useResources()
  const { fetch } = useFetch()
  const { getNodes } = useReactFlow()

  const [stats, setStats] = useState(null)
  const [botName, setBotName] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [hasMultiSelection, setHasMultiSelection] = useState(false)

  useOnSelectionChange({
    onChange: useCallback(
      ({ nodes }) => setHasMultiSelection(nodes.length > 1),
      []
    ),
  })

  // Get the connected botId from node data (set by onConnect)

  const botId = data.botId || null
  const periodDays = data.periodDays || 30
  const refreshInterval = data.refreshInterval ?? 30

  // Get the bot name from the connected node

  useEffect(() => {
    if (botId) {
      const nodes = getNodes()
      const botNode = nodes.find((node) => node.id === botId)

      if (botNode?.data?.name) {
        setBotName(botNode.data.name)
      } else {
        setBotName('Unnamed Bot')
      }
    } else {
      setBotName(null)
    }
  }, [botId, getNodes])

  // Load bot stats

  const loadBotStats = useCallback(async () => {
    // @note skip data loading in public preview mode
    if (mode === MODE_PUBLIC_PREVIEW) {
      return
    }

    // @note botId starting with '#' indicates an unsaved node
    if (!botId || botId.startsWith('#')) {
      setStats(null)
      setError(null)

      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data: results, error: fetchError } = await fetch(
        '/api/v1/platform/report/generate',
        {
          data: {
            [BOT_STATS_REPORT_ID]: { botId, periodDays },
          },
        }
      )

      if (fetchError) {
        setError(fetchError)
        setStats(null)

        return
      }

      const reportResult = results[BOT_STATS_REPORT_ID]

      if (reportResult?.error) {
        setError(reportResult.error)
        setStats(null)

        return
      }

      setStats(reportResult)
    } catch (err) {
      setError(err.message || 'Failed to load stats')
      setStats(null)
    } finally {
      setLoading(false)
    }
  }, [botId, periodDays, fetch, mode])

  // @note initial load; recurring refresh is driven by RefreshTimer

  useEffect(() => {
    loadBotStats()
  }, [loadBotStats])

  const getSentimentIcon = (signal) => {
    switch (signal) {
      case 'positive':
        return '↑'
      case 'negative':
        return '↓'
      case 'neutral':
        return '–'
      default:
        return '?'
    }
  }

  const getSentimentColor = (signal) => {
    switch (signal) {
      case 'positive':
        return 'text-green-600 dark:text-green-400'
      case 'negative':
        return 'text-red-600 dark:text-red-400'
      case 'neutral':
        return 'text-yellow-600 dark:text-yellow-400'
      default:
        return 'text-gray-500'
    }
  }

  return (
    <>
      {/* Source handle to connect to bots */}
      <Handle
        id="botId"
        type="source"
        position={Position.Left}
        className={clsx(
          'w-3 h-3',
          'border-2 border-gray-400',
          'bg-white dark:bg-gray-800',
          'rounded-full',
          '-ml-1.5'
        )}
        isConnectable={true}
        isValidConnection={(conn) =>
          isReferenceFieldFor(conn.sourceHandle, conn.targetHandle)
        }
      />

      <NodeResizer
        minWidth={DEFAULT_TOOL_WIDTH}
        minHeight={DEFAULT_TOOL_HEIGHT}
        isVisible={selected}
      />

      <div
        className={clsx(
          'relative w-full h-full flex flex-col rounded-lg overflow-hidden border',
          'auto-bg-gray-100',
          {
            'border-indigo-500 dark:border-indigo-400': selected,
            'auto-border-gray-300': !selected,
          }
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-1.5 p-2 border-b auto-border-gray-200 auto-bg-gray-50">
          <DynamicIcon
            icon="@lucide/chart-bar"
            className="w-3.5 h-3.5 auto-text-gray-500"
          />
          <span className="text-xs font-medium truncate flex-1">
            {data.name || 'Bot Stats'}
          </span>
          {refreshInterval > 0 ? (
            <RefreshTimer
              interval={refreshInterval}
              onRefresh={loadBotStats}
              loading={loading}
              className="text-[9px]"
            />
          ) : (
            <button
              type="button"
              className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              onClick={loadBotStats}
              title="Refresh stats"
            >
              <DynamicIcon
                icon="@lucide/refresh-cw"
                className={clsx('w-3 h-3 auto-text-gray-400', {
                  'animate-spin': loading,
                })}
              />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-2 overflow-auto">
          {mode === MODE_PUBLIC_PREVIEW ? (
            <div className="flex items-center justify-center h-full text-xs auto-text-gray-500">
              <div className="text-center">
                <DynamicIcon
                  icon="@lucide/chart-bar"
                  className="w-6 h-6 mx-auto mb-2 opacity-50"
                />
                <p>Bot Stats</p>
                <p className="text-[10px] mt-1 opacity-75">
                  Displays bot statistics when deployed
                </p>
              </div>
            </div>
          ) : !botId ? (
            <div className="flex items-center justify-center h-full text-xs auto-text-gray-500">
              <div className="text-center">
                <DynamicIcon
                  icon="@lucide/link"
                  className="w-6 h-6 mx-auto mb-2 opacity-50"
                />
                <p>Connect to a bot</p>
              </div>
            </div>
          ) : botId.startsWith('#') ? (
            <div className="flex items-center justify-center h-full text-xs auto-text-gray-500">
              <div className="text-center">
                <DynamicIcon
                  icon="@lucide/save"
                  className="w-6 h-6 mx-auto mb-2 opacity-50"
                />
                <p>Save blueprint to view stats</p>
              </div>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-full">
              <Spinner className="w-6 h-6" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-xs text-red-500">
              <div className="text-center">
                <DynamicIcon
                  icon="@lucide/circle-alert"
                  className="w-6 h-6 mx-auto mb-2"
                />
                <p>{error}</p>
              </div>
            </div>
          ) : stats ? (
            <div className="space-y-2">
              {/* Bot name */}
              {botName && (
                <div className="text-xs font-medium truncate auto-text-gray-700">
                  {botName}
                </div>
              )}

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="flex flex-col p-1.5 rounded auto-bg-gray-50">
                  <span className="auto-text-gray-500">Tokens</span>
                  <span className="font-medium text-sm">
                    {shortFormat(stats.totalTokens)}
                  </span>
                </div>
                <div className="flex flex-col p-1.5 rounded auto-bg-gray-50">
                  <span className="auto-text-gray-500">Conversations</span>
                  <span className="font-medium text-sm">
                    {shortFormat(stats.totalConversations)}
                  </span>
                </div>
                <div className="flex flex-col p-1.5 rounded auto-bg-gray-50">
                  <span className="auto-text-gray-500">Messages</span>
                  <span className="font-medium text-sm">
                    {shortFormat(stats.totalMessages)}
                  </span>
                </div>
                <div className="flex flex-col p-1.5 rounded auto-bg-gray-50">
                  <span className="auto-text-gray-500">Ratings</span>
                  <span className="font-medium text-sm">
                    {stats.totalRatings}
                    <span className="text-[10px] ml-1 auto-text-gray-400">
                      ({stats.thumbsUp}↑ {stats.thumbsDown}↓)
                    </span>
                  </span>
                </div>
                <div className="flex flex-col p-1.5 rounded auto-bg-gray-50">
                  <span className="auto-text-gray-500">Sentiment</span>
                  <span
                    className={clsx(
                      'font-medium text-sm',
                      getSentimentColor(stats.sentimentSignal)
                    )}
                  >
                    {getSentimentIcon(stats.sentimentSignal)}{' '}
                    {stats.sentimentSignal}
                  </span>
                </div>
              </div>

              {/* Period */}
              <div className="text-[10px] auto-text-gray-400 text-right">
                {stats.period}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {/* Configurator when selected */}
      {!hasMultiSelection && selected && (
        <BotStatsToolConfigurator.Memo
          id={id}
          type="tool:botStats"
          data={data}
        />
      )}
    </>
  )
}

BotStatsToolNode.Memo = memo(BotStatsToolNode)

BotStatsToolNode.dimensions = {
  width: 355,
  height: 260,
}

/**
 * Extract Chart Tool Configurator - Allows configuring the extract chart tool.
 */
export function ExtractChartToolConfigurator(props) {
  const { setNodes } = useReactFlow()

  const [target] = useDOMQuerySelector('#configurator-area')

  const id = props.id
  const value = props.data

  const setValue = useCallback(
    (newValue) => {
      setNodes((nodes) => {
        return updateConfiguratorNodes(nodes, id, newValue)
      })
    },
    [id, setNodes]
  )

  const schema = useMemo(
    () => ({
      type: 'object',
      properties: {
        name: {
          type: 'string',
          title: 'Name',
          description: 'A name for this extract chart tool.',
        },
      },
    }),
    []
  )

  return target
    ? createPortal(
        <SchemaPanel.Saving
          className="right-4 top-20"
          title={value.name || 'Extract Chart'}
          schema={schema}
          value={value}
          setValue={setValue}
        />,
        target
      )
    : null
}

ExtractChartToolConfigurator.Memo = memo(ExtractChartToolConfigurator)

/**
 * Extract Chart Tool - Displays the metrics chart for a connected Extract
 * integration. Connect it to an Extract integration to view the daily series of
 * its collected fields, formatted using each field's `display` setting.
 */
export function ExtractChartToolNode({ id, data, selected }) {
  const { mode } = useResources()
  const { fetch } = useFetch()
  const { getNodes } = useReactFlow()

  const [integration, setIntegration] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [hasMultiSelection, setHasMultiSelection] = useState(false)

  useOnSelectionChange({
    onChange: useCallback(
      ({ nodes }) => setHasMultiSelection(nodes.length > 1),
      []
    ),
  })

  // @note optional connection (set by onConnect via the extractIntegrationId
  // handle) pointing at the extract integration to chart

  const extractIntegrationId = data.extractIntegrationId || null
  const isPublicPreview = mode === MODE_PUBLIC_PREVIEW

  // @note an id starting with '#' indicates an unsaved node that has no
  // persisted integration to fetch yet

  const isUnsaved =
    !!extractIntegrationId && extractIntegrationId.startsWith('#')

  const safeIntegrationId =
    extractIntegrationId && !isUnsaved && !isPublicPreview
      ? extractIntegrationId
      : null

  // Resolve the connected integration's name for the header from the canvas

  const connectedNodeName = useMemo(() => {
    if (!extractIntegrationId) {
      return null
    }

    const node = getNodes().find((node) => node.id === extractIntegrationId)

    return node?.data?.name || null
  }, [extractIntegrationId, getNodes])

  // Load the integration to discover its collected fields and display formats

  const loadIntegration = useCallback(async () => {
    if (!safeIntegrationId) {
      setIntegration(null)
      setError(null)

      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data: result, error: fetchError } = await fetch(
        `/api/v1/integration/extract/${safeIntegrationId}/fetch`
      )

      if (fetchError) {
        setError(fetchError)
        setIntegration(null)

        return
      }

      setIntegration(result)
    } catch (err) {
      setError(err.message || 'Failed to load integration')
      setIntegration(null)
    } finally {
      setLoading(false)
    }
  }, [safeIntegrationId, fetch])

  useEffect(() => {
    loadIntegration()
  }, [loadIntegration])

  const {
    data: seriesData,
    formats,
    reload,
  } = useExtractIntegrationSeries(safeIntegrationId, integration?.schema)

  const hasCollectionItems = useMemo(() => {
    return Object.values(integration?.schema ?? {}).some(
      (def) => 'collect' in def && !!def.collect
    )
  }, [integration?.schema])

  const refresh = useCallback(() => {
    loadIntegration()
    reload()
  }, [loadIntegration, reload])

  return (
    <>
      {/* Source handle to connect to extract integrations */}
      <Handle
        id="extractIntegrationId"
        type="source"
        position={Position.Left}
        className={clsx(
          'w-3 h-3',
          'border-2 border-gray-400',
          'bg-white dark:bg-gray-800',
          'rounded-full',
          '-ml-1.5'
        )}
        isConnectable={true}
        isValidConnection={(conn) =>
          isReferenceFieldFor(conn.sourceHandle, conn.targetHandle)
        }
      />

      <NodeResizer
        minWidth={DEFAULT_TOOL_WIDTH}
        minHeight={DEFAULT_TOOL_HEIGHT}
        isVisible={selected}
      />

      <div
        className={clsx(
          'relative w-full h-full flex flex-col rounded-lg overflow-hidden border',
          'auto-bg-gray-100',
          {
            'border-indigo-500 dark:border-indigo-400': selected,
            'auto-border-gray-300': !selected,
          }
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-1.5 p-2 border-b auto-border-gray-200 auto-bg-gray-50">
          <DynamicIcon
            icon="@lucide/chart-line"
            className="w-3.5 h-3.5 auto-text-gray-500"
          />
          <span className="text-xs font-medium truncate flex-1">
            {data.name || connectedNodeName || 'Extract Chart'}
          </span>
          <button
            type="button"
            className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            onClick={refresh}
            title="Refresh chart"
          >
            <DynamicIcon
              icon="@lucide/refresh-cw"
              className={clsx('w-3 h-3 auto-text-gray-400', {
                'animate-spin': loading,
              })}
            />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-2 overflow-auto">
          {isPublicPreview ? (
            <div className="flex items-center justify-center h-full text-xs auto-text-gray-500">
              <div className="text-center">
                <DynamicIcon
                  icon="@lucide/chart-line"
                  className="w-6 h-6 mx-auto mb-2 opacity-50"
                />
                <p>Extract Chart</p>
                <p className="text-[10px] mt-1 opacity-75">
                  Displays the integration chart when deployed
                </p>
              </div>
            </div>
          ) : !extractIntegrationId ? (
            <div className="flex items-center justify-center h-full text-xs auto-text-gray-500">
              <div className="text-center">
                <DynamicIcon
                  icon="@lucide/link"
                  className="w-6 h-6 mx-auto mb-2 opacity-50"
                />
                <p>Connect to an Extract integration</p>
              </div>
            </div>
          ) : isUnsaved ? (
            <div className="flex items-center justify-center h-full text-xs auto-text-gray-500">
              <div className="text-center">
                <DynamicIcon
                  icon="@lucide/save"
                  className="w-6 h-6 mx-auto mb-2 opacity-50"
                />
                <p>Save blueprint to view chart</p>
              </div>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-full">
              <Spinner className="w-6 h-6" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-xs text-red-500">
              <div className="text-center">
                <DynamicIcon
                  icon="@lucide/circle-alert"
                  className="w-6 h-6 mx-auto mb-2"
                />
                <p>{error}</p>
              </div>
            </div>
          ) : !hasCollectionItems ? (
            <div className="flex items-center justify-center h-full text-xs auto-text-gray-500">
              <div className="text-center">
                <DynamicIcon
                  icon="@lucide/chart-line"
                  className="w-6 h-6 mx-auto mb-2 opacity-50"
                />
                <p>No collected fields to chart</p>
                <p className="text-[10px] mt-1 opacity-75">
                  Mark numeric schema fields with collect: true
                </p>
              </div>
            </div>
          ) : (
            <DailyChart data={seriesData} formats={formats} />
          )}
        </div>
      </div>

      {/* Configurator when selected */}
      {!hasMultiSelection && selected && (
        <ExtractChartToolConfigurator.Memo
          id={id}
          type="tool:extractChart"
          data={data}
        />
      )}
    </>
  )
}

ExtractChartToolNode.Memo = memo(ExtractChartToolNode)

/**
 * Blueprint Bulletin Browser Tool Configurator - Allows configuring the
 * bulletin browser.
 */
export function BlueprintBulletinBrowserToolConfigurator(props) {
  const { setNodes } = useReactFlow()

  const [target] = useDOMQuerySelector('#configurator-area')

  const id = props.id
  const value = props.data

  const setValue = useCallback(
    (newValue) => {
      setNodes((nodes) => {
        return updateConfiguratorNodes(nodes, id, newValue)
      })
    },
    [id, setNodes]
  )

  const schema = useMemo(
    () => ({
      type: 'object',
      properties: {
        name: {
          type: 'string',
          title: 'Name',
          description: 'A name for this bulletin browser tool.',
        },
        refreshInterval: {
          type: 'number',
          title: 'Refresh Interval (seconds)',
          description:
            'How often to refresh the bulletins. Set to 0 to disable auto-refresh.',
          default: 30,
          minimum: 0,
          maximum: 3600,
        },
      },
    }),
    []
  )

  return target
    ? createPortal(
        <SchemaPanel.Saving
          className="right-4 top-20"
          title={value.name || 'Blueprint Bulletins'}
          schema={schema}
          value={value}
          setValue={setValue}
        />,
        target
      )
    : null
}

BlueprintBulletinBrowserToolConfigurator.Memo = memo(
  BlueprintBulletinBrowserToolConfigurator
)

/**
 * Blueprint Bulletin Browser Tool - Shows the bulletins posted to the current
 * blueprint's shared board. Optionally connect it to a bot to filter the board
 * down to bulletins authored by that bot.
 */
export function BlueprintBulletinBrowserToolNode({ id, data, selected }) {
  const router = useRouter()
  const { mode } = useResources()
  const { fetch } = useFetch()
  const { getNodes } = useReactFlow()

  const [bulletins, setBulletins] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [botName, setBotName] = useState(null)
  const [hasMultiSelection, setHasMultiSelection] = useState(false)

  useOnSelectionChange({
    onChange: useCallback(
      ({ nodes }) => setHasMultiSelection(nodes.length > 1),
      []
    ),
  })

  // The bulletin board is scoped to the blueprint, which is the current route

  const blueprintId = router.query?.blueprintId || null

  // @note optional bot connection (set by onConnect via the botId handle) used
  // to filter the board down to a single author

  const botId = data.botId || null
  const refreshInterval = data.refreshInterval ?? 30
  const isPublicPreview = mode === MODE_PUBLIC_PREVIEW

  // Resolve the connected bot's name for the header

  useEffect(() => {
    if (botId) {
      const botNode = getNodes().find((node) => node.id === botId)

      setBotName(botNode?.data?.name || 'Unnamed Bot')
    } else {
      setBotName(null)
    }
  }, [botId, getNodes])

  // Load blueprint bulletins

  const loadBulletins = useCallback(async () => {
    // @note skip data loading in public preview mode

    if (isPublicPreview) {
      return
    }

    // @note an unsaved/missing blueprint has no board to read

    if (!blueprintId) {
      setBulletins([])
      setError(null)

      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data: listData, error: fetchError } = await fetch(
        `/api/v1/blueprint/${blueprintId}/bulletin/list`,
        {}
      )

      if (fetchError) {
        setError(fetchError)
        setBulletins([])

        return
      }

      setBulletins(listData?.items || [])
      setLastRefresh(new Date())
    } catch (err) {
      setError(err.message || 'Failed to load bulletins')
      setBulletins([])
    } finally {
      setLoading(false)
    }
  }, [blueprintId, fetch, isPublicPreview])

  // @note initial load; recurring refresh is driven by RefreshTimer

  useEffect(() => {
    if (isPublicPreview) {
      return
    }

    loadBulletins()
  }, [loadBulletins, isPublicPreview])

  // @note when connected to a saved bot, filter the board to that bot's posts.
  // The node id of a saved bot equals its resource id, which matches the
  // bulletin author. Unsaved ('#') connections fall back to showing everything.

  const visibleBulletins = useMemo(() => {
    if (botId && !botId.startsWith('#')) {
      return bulletins.filter((bulletin) => bulletin.botId === botId)
    }

    return bulletins
  }, [bulletins, botId])

  // Resolve a bulletin's display author: prefer the stored name, otherwise fall
  // back to the connected bot node's name (or the raw id) when only a botId is
  // present (e.g. bulletins posted via the API without an author name)

  const resolveAuthor = useCallback(
    (bulletin) => {
      if (bulletin.author) {
        return bulletin.author
      }

      if (!bulletin.botId) {
        return null
      }

      const botNode = getNodes().find((node) => node.id === bulletin.botId)

      return botNode?.data?.name || bulletin.botId
    },
    [getNodes]
  )

  const formatAge = useCallback((ms) => {
    const seconds = Math.max(0, Math.floor((Date.now() - ms) / 1000))

    if (seconds < 60) {
      return `${seconds}s ago`
    }

    const minutes = Math.floor(seconds / 60)

    if (minutes < 60) {
      return `${minutes}m ago`
    }

    const hours = Math.floor(minutes / 60)

    if (hours < 24) {
      return `${hours}h ago`
    }

    return `${Math.floor(hours / 24)}d ago`
  }, [])

  return (
    <>
      {/* Source handle to connect to a bot (optional, filters by author) */}
      <Handle
        id="botId"
        type="source"
        position={Position.Left}
        className={clsx(
          'w-3 h-3',
          'border-2 border-gray-400',
          'bg-white dark:bg-gray-800',
          'rounded-full',
          '-ml-1.5'
        )}
        isConnectable={true}
        isValidConnection={(conn) =>
          isReferenceFieldFor(conn.sourceHandle, conn.targetHandle)
        }
      />

      <NodeResizer
        minWidth={DEFAULT_TOOL_WIDTH}
        minHeight={DEFAULT_TOOL_HEIGHT}
        isVisible={selected}
      />

      <div
        className={clsx(
          'relative w-full h-full flex flex-col rounded-lg overflow-hidden border',
          'bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-600'
        )}
      >
        <div
          className={clsx(
            'shrink-0 w-full',
            'flex flex-row items-center gap-2',
            'px-3 py-2',
            'bg-amber-100 dark:bg-amber-800/50'
          )}
        >
          <DynamicIcon name="@lucide/megaphone" className="w-4 h-4 shrink-0" />
          <span className="flex-1 text-xs font-medium truncate">
            {data.name || 'Blueprint Bulletins'}
            {botName && (
              <span className="ml-1 auto-text-gray-500">({botName})</span>
            )}
          </span>
          {visibleBulletins.length > 0 ? (
            <span className="text-[9px] auto-text-gray-400">
              {visibleBulletins.length} bulletin
              {visibleBulletins.length !== 1 ? 's' : ''}
            </span>
          ) : null}
          {!isPublicPreview && blueprintId && refreshInterval > 0 ? (
            <RefreshTimer
              interval={refreshInterval}
              onRefresh={loadBulletins}
              loading={loading}
              className="text-[9px]"
            />
          ) : lastRefresh ? (
            <span className="text-[9px] auto-text-gray-400">
              {lastRefresh.toLocaleTimeString()}
            </span>
          ) : null}
        </div>

        <div
          className={clsx('flex-1 overflow-auto p-2', {
            'nodrag nopan nowheel': !!selected,
            'cursor-grab': !selected,
          })}
        >
          {isPublicPreview ? (
            <div className="flex items-center justify-center h-full text-xs auto-text-gray-500">
              <div className="text-center">
                <DynamicIcon
                  name="@lucide/megaphone"
                  className="w-6 h-6 mx-auto mb-2 opacity-50"
                />
                <p>Blueprint Bulletins</p>
                <p className="text-[10px] mt-1 opacity-75">
                  Shows the blueprint&apos;s shared board when deployed
                </p>
              </div>
            </div>
          ) : !blueprintId ? (
            <div className="flex items-center justify-center h-full text-xs auto-text-gray-500">
              <div className="text-center">
                <DynamicIcon
                  name="@lucide/save"
                  className="w-6 h-6 mx-auto mb-2 opacity-50"
                />
                <p>Save the blueprint to view its bulletins</p>
              </div>
            </div>
          ) : loading && visibleBulletins.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <Spinner className="w-6 h-6" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-xs text-red-500">
              <div className="text-center">
                <DynamicIcon
                  name="@lucide/circle-alert"
                  className="w-6 h-6 mx-auto mb-2"
                />
                <p>{error}</p>
              </div>
            </div>
          ) : visibleBulletins.length === 0 ? (
            <div className="flex items-center justify-center h-full text-xs auto-text-gray-500">
              <div className="text-center">
                <DynamicIcon
                  name="@lucide/megaphone"
                  className="w-6 h-6 mx-auto mb-2 opacity-50"
                />
                <p>
                  {botId
                    ? 'No bulletins from this bot'
                    : 'No bulletins on the board'}
                </p>
                <p className="text-[10px] mt-1 opacity-75">
                  Agents post bulletins at runtime
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {visibleBulletins.map((bulletin) => {
                const author = resolveAuthor(bulletin)

                return (
                  <div
                    key={bulletin.id}
                    className={clsx(
                      'nodrag flex flex-col gap-1 p-2 rounded',
                      'text-[10px]',
                      'bg-white/60 dark:bg-black/20'
                    )}
                  >
                    <div className="whitespace-pre-wrap break-words auto-text-gray-700">
                      {bulletin.text}
                    </div>
                    <div className="flex flex-row items-center gap-2 auto-text-gray-400">
                      {author ? (
                        <span className="flex items-center gap-1 min-w-0">
                          <DynamicIcon
                            name="@lucide/bot"
                            className="w-3 h-3 shrink-0"
                          />
                          <span className="truncate">{author}</span>
                        </span>
                      ) : null}
                      <span className="ml-auto shrink-0">
                        {formatAge(bulletin.createdAt)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Configurator when selected */}
      {!hasMultiSelection && selected && (
        <BlueprintBulletinBrowserToolConfigurator.Memo
          id={id}
          type="tool:blueprintBulletinBrowser"
          data={data}
        />
      )}
    </>
  )
}

BlueprintBulletinBrowserToolNode.Memo = memo(BlueprintBulletinBrowserToolNode)

/**
 * Error Log Tool Configurator - Allows configuring the error log display.
 */
export function ErrorLogToolConfigurator(props) {
  const { setNodes } = useReactFlow()

  const [target] = useDOMQuerySelector('#configurator-area')

  const id = props.id
  const value = props.data

  const setValue = useCallback(
    (newValue) => {
      setNodes((nodes) => {
        return updateConfiguratorNodes(nodes, id, newValue)
      })
    },
    [id, setNodes]
  )

  const schema = useMemo(
    () => ({
      type: 'object',
      properties: {
        name: {
          type: 'string',
          title: 'Name',
          description: 'A name for this error log tool.',
        },
        refreshInterval: {
          type: 'number',
          title: 'Refresh Interval (seconds)',
          description:
            'How often to refresh the error logs. Set to 0 to disable auto-refresh.',
          default: 60,
          minimum: 0,
          maximum: 3600,
        },
        take: {
          type: 'number',
          title: 'Max Errors',
          description: 'Maximum number of errors to display.',
          default: 10,
          minimum: 1,
          maximum: 50,
        },
      },
    }),
    []
  )

  return target
    ? createPortal(
        <SchemaPanel.Saving
          className="right-4 top-20"
          title={value.name || 'Error Log'}
          schema={schema}
          value={value}
          setValue={setValue}
        />,
        target
      )
    : null
}

ErrorLogToolConfigurator.Memo = memo(ErrorLogToolConfigurator)

/**
 * Error Log Tool - Displays errors for connected resources with configurable auto-refresh.
 * Connect to bots, datasets, skillsets, or integrations to monitor their errors.
 */
export function ErrorLogToolNode({ id, data, selected }) {
  const { mode } = useResources()
  const { fetch } = useFetch()
  const { getNodes, getEdges, getNode, updateNode } = useReactFlow()
  const updateNodeInternals = useUpdateNodeInternals()

  const onResourceConnect = useCallback(
    (edges) => {
      edges.forEach((edge) => {
        updateNode(edge.source, (node) => applyConnectionEdgeToNode(node, edge))
      })
    },
    [updateNode]
  )

  const onResourceDisconnect = useCallback(
    (edges) => {
      edges.forEach((edge) => {
        updateNode(edge.source, (node) =>
          clearConnectionEdgeFromNode(node, edge)
        )
      })
    },
    [updateNode]
  )

  const sourceConnectionOptions = useMemo(
    () => ({
      handleType: 'source',
      onConnect: onResourceConnect,
      onDisconnect: onResourceDisconnect,
    }),
    [onResourceConnect, onResourceDisconnect]
  )

  const sourceConnections = useNodeConnections(sourceConnectionOptions)

  const [errors, setErrors] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [hasMultiSelection, setHasMultiSelection] = useState(false)

  useOnSelectionChange({
    onChange: useCallback(
      ({ nodes }) => setHasMultiSelection(nodes.length > 1),
      []
    ),
  })

  const resourceHandleIds = useMemo(() => {
    const usedHandleIndexes = getEdges()
      .filter(
        (edge) =>
          edge.source === id && isErrorLogToolResourceHandle(edge.sourceHandle)
      )
      .map((edge) =>
        Number.parseInt(
          edge.sourceHandle.slice(ERROR_LOG_TOOL_RESOURCE_HANDLE_PREFIX.length),
          10
        )
      )
      .filter(Number.isFinite)

    const highestUsedHandleIndex =
      usedHandleIndexes.length > 0 ? Math.max(...usedHandleIndexes) : -1

    return Array.from(
      { length: highestUsedHandleIndex + 2 },
      (_, index) => `${ERROR_LOG_TOOL_RESOURCE_HANDLE_PREFIX}${index}`
    )
  }, [id, getEdges, sourceConnections])

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      updateNodeInternals(id)
    })

    return () => cancelAnimationFrame(raf)
  }, [id, resourceHandleIds, updateNodeInternals])

  // @note get all connected resource IDs from edges where this tool is the source
  const connectedResources = useMemo(() => {
    const edges = getEdges()
    const nodes = getNodes()

    const resources = []

    for (const edge of edges) {
      if (edge.source === id && edge.sourceHandle && edge.target) {
        const resourceType = isErrorLogToolResourceHandle(edge.sourceHandle)
          ? edge.targetHandle
          : // @note legacy edges used sourceHandle values like 'botId'.
            getReferenceFieldType(edge.sourceHandle)
        const resourceId = edge.target

        if (!isErrorLogToolResourceType(resourceType)) {
          continue
        }

        // @note verify the target node exists and is a valid saved resource
        const targetNode = nodes.find((n) => n.id === resourceId)

        if (targetNode && !resourceId.startsWith('#')) {
          resources.push({
            type: resourceType,
            id: resourceId,
            name: targetNode.data?.name || resourceId,
          })
        }
      }
    }

    return resources
  }, [id, getEdges, getNodes, sourceConnections])

  const isValidResourceConnection = useCallback(
    (conn) => {
      const sourceNodeType = getNode(conn.source)?.type
      const targetNodeType = getNode(conn.target)?.type
      const validErrorLogConnection = isValidErrorLogToolConnection({
        sourceHandle: conn.sourceHandle,
        sourceNodeType,
        targetHandle: conn.targetHandle,
        targetNodeType,
      })

      return validErrorLogConnection === true
    },
    [getNode]
  )

  // Load error logs
  const loadErrorLogs = useCallback(async () => {
    // @note skip data loading in public preview mode
    if (mode === MODE_PUBLIC_PREVIEW) {
      return
    }

    if (connectedResources.length === 0) {
      setErrors([])
      setError(null)

      return
    }

    setLoading(true)
    setError(null)

    try {
      const take = data.take ?? 10

      // @note fetch errors for each resource separately then merge results
      const allErrorItems = []

      for (const resource of connectedResources) {
        const searchParams = new URLSearchParams()

        searchParams.append('order', 'desc')
        searchParams.append('take', String(take))
        searchParams.append(`${resource.type}Id`, resource.id)

        const { data: logData, error: fetchError } = await fetch(
          `/api/v1/event/log/list?${searchParams.toString()}`,
          {}
        )

        if (fetchError) {
          // @note continue fetching other resources even if one fails
          continue
        }

        // @note filter for error events (type ends with '.error' or '.warning')
        const errorItems = (logData?.items || []).filter(
          (item) =>
            item.type.endsWith('.error') || item.type.endsWith('.warning')
        )

        allErrorItems.push(...errorItems)
      }

      // @note deduplicate by id and sort by createdAt descending
      const uniqueErrors = Array.from(
        new Map(allErrorItems.map((item) => [item.id, item])).values()
      ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

      // @note limit to configured take value
      setErrors(uniqueErrors.slice(0, take))
      setLastRefresh(new Date())
    } catch (err) {
      setError(err.message || 'Failed to load error logs')
      setErrors([])
    } finally {
      setLoading(false)
    }
  }, [connectedResources, data.take, fetch, mode])

  const refreshInterval = data.refreshInterval ?? 60

  // @note initial load; recurring refresh is driven by RefreshTimer
  useEffect(() => {
    loadErrorLogs()
  }, [loadErrorLogs])

  // @note format relative time
  const formatRelativeTime = useCallback((date) => {
    const now = new Date()
    const diff = now - new Date(date)
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) {
      return `${days}d ago`
    }

    if (hours > 0) {
      return `${hours}h ago`
    }

    if (minutes > 0) {
      return `${minutes}m ago`
    }

    return 'just now'
  }, [])

  return (
    <>
      {/* Source handles connect to any resource type supported by the error log. */}
      {resourceHandleIds.map((handleId, index) => (
        <Handle
          key={handleId}
          id={handleId}
          type="source"
          position={Position.Left}
          className={clsx(
            'w-3 h-3',
            'border-2 border-gray-400',
            'bg-white dark:bg-gray-800',
            'rounded-full',
            '-ml-1.5'
          )}
          style={{
            top: `${((index + 1) / (resourceHandleIds.length + 1)) * 100}%`,
          }}
          isConnectable={true}
          isValidConnection={isValidResourceConnection}
        />
      ))}

      <NodeResizer
        minWidth={DEFAULT_TOOL_WIDTH}
        minHeight={DEFAULT_TOOL_HEIGHT}
        isVisible={selected}
      />

      <div
        className={clsx(
          'relative w-full h-full flex flex-col rounded-lg overflow-hidden border',
          'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-600'
        )}
      >
        <div
          className={clsx(
            'shrink-0 w-full',
            'flex flex-row items-center gap-2',
            'px-3 py-2',
            'bg-red-100 dark:bg-red-800/50'
          )}
        >
          <DynamicIcon
            name="@lucide/triangle-alert"
            className="w-4 h-4 shrink-0"
          />
          <span className="flex-1 text-xs font-medium truncate">
            {data.name || 'Error Log'}
            {connectedResources.length > 0 && (
              <span className="ml-1 auto-text-gray-500">
                ({connectedResources.length} resource
                {connectedResources.length !== 1 ? 's' : ''})
              </span>
            )}
          </span>
          {refreshInterval > 0 ? (
            <RefreshTimer
              interval={refreshInterval}
              onRefresh={loadErrorLogs}
              loading={loading}
              className="text-[9px]"
            />
          ) : lastRefresh ? (
            <span className="text-[9px] auto-text-gray-400">
              {lastRefresh.toLocaleTimeString()}
            </span>
          ) : null}
        </div>

        <div
          className={clsx('flex-1 overflow-auto p-2', {
            'nodrag nopan nowheel': !!selected,
            'cursor-grab': !selected,
          })}
        >
          {mode === MODE_PUBLIC_PREVIEW ? (
            <div className="flex items-center justify-center h-full text-xs auto-text-gray-500">
              <div className="text-center">
                <DynamicIcon
                  name="@lucide/triangle-alert"
                  className="w-6 h-6 mx-auto mb-2 opacity-50"
                />
                <p>Error Log</p>
                <p className="text-[10px] mt-1 opacity-75">
                  Monitors resource errors when deployed
                </p>
              </div>
            </div>
          ) : connectedResources.length === 0 ? (
            <div className="flex items-center justify-center h-full text-xs auto-text-gray-500">
              <div className="text-center">
                <DynamicIcon
                  name="@lucide/link"
                  className="w-6 h-6 mx-auto mb-2 opacity-50"
                />
                <p>Connect to resources to monitor errors</p>
                <p className="text-[10px] mt-1 opacity-75">
                  Drag from handles to bots, datasets, or integrations
                </p>
              </div>
            </div>
          ) : loading && errors.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <Spinner className="w-6 h-6" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-xs text-red-500">
              <div className="text-center">
                <DynamicIcon
                  name="@lucide/circle-alert"
                  className="w-6 h-6 mx-auto mb-2"
                />
                <p>{error}</p>
              </div>
            </div>
          ) : errors.length === 0 ? (
            <div className="flex items-center justify-center h-full text-xs auto-text-gray-500">
              <div className="text-center">
                <DynamicIcon
                  name="@lucide/check-circle"
                  className="w-6 h-6 mx-auto mb-2 opacity-50 text-green-500"
                />
                <p>No errors found</p>
                <p className="text-[10px] mt-1 opacity-75">
                  Connected resources have no recent errors
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {errors.map((errorItem) => (
                <div
                  key={errorItem.id}
                  className={clsx(
                    'flex flex-col gap-1 p-1.5 rounded',
                    'text-[10px]',
                    errorItem.type.endsWith('.error')
                      ? 'bg-red-100/50 dark:bg-red-900/30'
                      : 'bg-yellow-100/50 dark:bg-yellow-900/30',
                    'transition-colors'
                  )}
                >
                  <div className="flex flex-row items-center gap-2">
                    <DynamicIcon
                      name={
                        errorItem.type.endsWith('.error')
                          ? '@lucide/circle-x'
                          : '@lucide/alert-triangle'
                      }
                      className={clsx(
                        'w-3 h-3 shrink-0',
                        errorItem.type.endsWith('.error')
                          ? 'text-red-500'
                          : 'text-yellow-500'
                      )}
                    />
                    <span
                      className={clsx(
                        'flex-1 truncate font-medium',
                        errorItem.type.endsWith('.error')
                          ? 'text-red-700 dark:text-red-300'
                          : 'text-yellow-700 dark:text-yellow-300'
                      )}
                    >
                      {errorItem.type}
                    </span>
                    <span className="shrink-0 auto-text-gray-400">
                      {formatRelativeTime(errorItem.createdAt)}
                    </span>
                  </div>
                  {errorItem.description && (
                    <p className="pl-5 auto-text-gray-600 truncate">
                      {errorItem.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Configurator when selected */}
      {!hasMultiSelection && selected && (
        <ErrorLogToolConfigurator.Memo
          id={id}
          type="tool:errorLog"
          data={data}
        />
      )}
    </>
  )
}

/**
 * Task Monitor Tool Configurator - Allows configuring the task monitor display.
 */
export function TaskMonitorToolConfigurator(props) {
  const { setNodes } = useReactFlow()

  const [target] = useDOMQuerySelector('#configurator-area')

  const id = props.id
  const value = props.data

  const setValue = useCallback(
    (newValue) => {
      setNodes((nodes) => {
        return updateConfiguratorNodes(nodes, id, newValue)
      })
    },
    [id, setNodes]
  )

  const schema = useMemo(
    () => ({
      type: 'object',
      properties: {
        name: {
          type: 'string',
          title: 'Name',
          description: 'A name for this task monitor tool.',
        },
        refreshInterval: {
          type: 'number',
          title: 'Refresh Interval (seconds)',
          description:
            'How often to refresh the task list. Set to 0 to disable auto-refresh.',
          default: 30,
          minimum: 0,
          maximum: 300,
        },
        take: {
          type: 'number',
          title: 'Max Tasks',
          description: 'Maximum number of tasks to display.',
          default: 10,
          minimum: 1,
          maximum: 50,
        },
      },
    }),
    []
  )

  return target
    ? createPortal(
        <SchemaPanel.Saving
          className="right-4 top-20"
          title={value.name || 'Task Monitor'}
          schema={schema}
          value={value}
          setValue={setValue}
        />,
        target
      )
    : null
}

TaskMonitorToolConfigurator.Memo = memo(TaskMonitorToolConfigurator)

/**
 * Task Monitor Tool - Displays running and active tasks for a connected bot.
 * Connect to a bot to monitor its currently running tasks.
 */
export function TaskMonitorToolNode({ id, data, selected }) {
  const { mode } = useResources()
  const { fetch } = useFetch()
  const { getNodes } = useReactFlow()

  const [tasks, setTasks] = useState([])
  const [botName, setBotName] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [hasMultiSelection, setHasMultiSelection] = useState(false)

  useOnSelectionChange({
    onChange: useCallback(
      ({ nodes }) => setHasMultiSelection(nodes.length > 1),
      []
    ),
  })

  // Get the connected botId from node data (set by onConnect)
  const botId = data.botId || null

  // Get the bot name from the connected node
  useEffect(() => {
    if (botId) {
      const nodes = getNodes()
      const botNode = nodes.find((node) => node.id === botId)

      if (botNode?.data?.name) {
        setBotName(botNode.data.name)
      } else {
        setBotName('Unnamed Bot')
      }
    } else {
      setBotName(null)
    }
  }, [botId, getNodes])

  // Load tasks for the connected bot
  const loadTasks = useCallback(async () => {
    // @note skip data loading in public preview mode
    if (mode === MODE_PUBLIC_PREVIEW) {
      return
    }

    // @note botId starting with '#' indicates an unsaved node
    if (!botId || botId.startsWith('#')) {
      setTasks([])
      setError(null)

      return
    }

    setLoading(true)
    setError(null)

    try {
      const take = data.take ?? 10

      const searchParams = new URLSearchParams()

      searchParams.append('order', 'desc')
      searchParams.append('take', String(take))
      searchParams.append('botId', botId)

      const { data: taskData, error: fetchError } = await fetch(
        `/api/v1/task/list?${searchParams.toString()}`,
        {}
      )

      if (fetchError) {
        setError(fetchError)
        setTasks([])

        return
      }

      setTasks(taskData?.items || [])
      setLastRefresh(new Date())
    } catch (err) {
      setError(err.message || 'Failed to load tasks')
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [botId, data.take, fetch, mode])

  // Initial load and refresh interval
  useEffect(() => {
    loadTasks()

    const refreshInterval = data.refreshInterval ?? 30

    if (refreshInterval > 0) {
      const interval = setInterval(loadTasks, refreshInterval * 1000)

      return () => clearInterval(interval)
    }
  }, [loadTasks, data.refreshInterval])

  // @note format relative time
  const formatRelativeTime = useCallback((date) => {
    const now = new Date()
    const diff = now - new Date(date)
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) {
      return `${days}d ago`
    }

    if (hours > 0) {
      return `${hours}h ago`
    }

    if (minutes > 0) {
      return `${minutes}m ago`
    }

    return 'just now'
  }, [])

  const getStatusColor = useCallback((status) => {
    switch (status) {
      case 'running':
        return 'text-green-600 dark:text-green-400'
      case 'idle':
        return 'text-gray-500'
      default:
        return 'text-gray-500'
    }
  }, [])

  const getStatusIcon = useCallback((status) => {
    switch (status) {
      case 'running':
        return '@lucide/play'
      case 'idle':
        return '@lucide/pause'
      default:
        return '@lucide/circle'
    }
  }, [])

  // Separate running and idle tasks
  const runningTasks = tasks.filter((task) => task.status === 'running')
  const idleTasks = tasks.filter((task) => task.status !== 'running')

  return (
    <>
      {/* Source handle to connect to bots */}
      <Handle
        id="botId"
        type="source"
        position={Position.Left}
        className={clsx(
          'w-3 h-3',
          'border-2 border-gray-400',
          'bg-white dark:bg-gray-800',
          'rounded-full',
          '-ml-1.5'
        )}
        isConnectable={true}
        isValidConnection={(conn) =>
          isReferenceFieldFor(conn.sourceHandle, conn.targetHandle)
        }
      />

      <NodeResizer
        minWidth={DEFAULT_TOOL_WIDTH}
        minHeight={DEFAULT_TOOL_HEIGHT}
        isVisible={selected}
      />

      <div
        className={clsx(
          'relative w-full h-full flex flex-col rounded-lg overflow-hidden border',
          'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600'
        )}
      >
        {/* Header */}
        <div
          className={clsx(
            'shrink-0 w-full',
            'flex flex-row items-center gap-2',
            'px-3 py-2',
            'bg-blue-100 dark:bg-blue-800/50'
          )}
        >
          <DynamicIcon
            icon="@lucide/list-todo"
            className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400"
          />
          <span className="flex-1 text-xs font-medium truncate">
            {data.name || 'Task Monitor'}
            {botName && (
              <span className="ml-1 auto-text-gray-500">({botName})</span>
            )}
          </span>
          <button
            type="button"
            className="p-0.5 rounded hover:bg-blue-200 dark:hover:bg-blue-700 transition-colors"
            onClick={loadTasks}
            title="Refresh tasks"
          >
            <DynamicIcon
              icon="@lucide/refresh-cw"
              className={clsx('w-3 h-3 text-blue-500 dark:text-blue-400', {
                'animate-spin': loading,
              })}
            />
          </button>
          {lastRefresh && (
            <span className="text-[9px] auto-text-gray-400">
              {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Content */}
        <div
          className={clsx('flex-1 overflow-auto p-2', {
            'nodrag nopan nowheel': !!selected,
            'cursor-grab': !selected,
          })}
        >
          {mode === MODE_PUBLIC_PREVIEW ? (
            <div className="flex items-center justify-center h-full text-xs auto-text-gray-500">
              <div className="text-center">
                <DynamicIcon
                  icon="@lucide/list-todo"
                  className="w-6 h-6 mx-auto mb-2 opacity-50"
                />
                <p>Task Monitor</p>
                <p className="text-[10px] mt-1 opacity-75">
                  Monitors bot tasks when deployed
                </p>
              </div>
            </div>
          ) : !botId ? (
            <div className="flex items-center justify-center h-full text-xs auto-text-gray-500">
              <div className="text-center">
                <DynamicIcon
                  icon="@lucide/link"
                  className="w-6 h-6 mx-auto mb-2 opacity-50"
                />
                <p>Connect to a bot</p>
                <p className="text-[10px] mt-1 opacity-75">
                  Drag from handle to a bot to monitor its tasks
                </p>
              </div>
            </div>
          ) : botId.startsWith('#') ? (
            <div className="flex items-center justify-center h-full text-xs auto-text-gray-500">
              <div className="text-center">
                <DynamicIcon
                  icon="@lucide/save"
                  className="w-6 h-6 mx-auto mb-2 opacity-50"
                />
                <p>Save blueprint to view tasks</p>
              </div>
            </div>
          ) : loading && tasks.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <Spinner className="w-6 h-6" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-xs text-red-500">
              <div className="text-center">
                <DynamicIcon
                  icon="@lucide/circle-alert"
                  className="w-6 h-6 mx-auto mb-2"
                />
                <p>{error}</p>
              </div>
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex items-center justify-center h-full text-xs auto-text-gray-500">
              <div className="text-center">
                <DynamicIcon
                  icon="@lucide/inbox"
                  className="w-6 h-6 mx-auto mb-2 opacity-50"
                />
                <p>No tasks found</p>
                <p className="text-[10px] mt-1 opacity-75">
                  This bot has no associated tasks
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Running tasks section */}
              {runningTasks.length > 0 && (
                <div>
                  <div className="text-[10px] font-medium text-green-600 dark:text-green-400 mb-1 flex items-center gap-1">
                    <DynamicIcon icon="@lucide/activity" className="w-3 h-3" />
                    Running ({runningTasks.length})
                  </div>
                  <div className="space-y-1">
                    {runningTasks.map((task) => (
                      <div
                        key={task.id}
                        className={clsx(
                          'flex flex-col gap-0.5 p-1.5 rounded',
                          'text-[10px]',
                          'bg-green-100/70 dark:bg-green-900/40',
                          'border border-green-200 dark:border-green-700'
                        )}
                      >
                        <div className="flex flex-row items-center gap-1.5">
                          <DynamicIcon
                            icon={getStatusIcon(task.status)}
                            className={clsx(
                              'w-3 h-3 shrink-0 animate-pulse',
                              getStatusColor(task.status)
                            )}
                          />
                          <span className="flex-1 truncate font-medium">
                            {task.name || task.id}
                          </span>
                          <span className="shrink-0 auto-text-gray-400">
                            {formatRelativeTime(task.updatedAt)}
                          </span>
                        </div>
                        {task.description && (
                          <p className="pl-[18px] auto-text-gray-600 truncate">
                            {task.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Idle tasks section */}
              {idleTasks.length > 0 && (
                <div>
                  <div className="text-[10px] font-medium auto-text-gray-500 mb-1 flex items-center gap-1">
                    <DynamicIcon icon="@lucide/clock" className="w-3 h-3" />
                    Idle ({idleTasks.length})
                  </div>
                  <div className="space-y-1">
                    {idleTasks.map((task) => (
                      <div
                        key={task.id}
                        className={clsx(
                          'flex flex-col gap-0.5 p-1.5 rounded',
                          'text-[10px]',
                          'bg-gray-100/50 dark:bg-gray-800/50'
                        )}
                      >
                        <div className="flex flex-row items-center gap-1.5">
                          <DynamicIcon
                            icon={getStatusIcon(task.status)}
                            className={clsx(
                              'w-3 h-3 shrink-0',
                              getStatusColor(task.status)
                            )}
                          />
                          <span className="flex-1 truncate font-medium auto-text-gray-700">
                            {task.name || task.id}
                          </span>
                          <span className="shrink-0 auto-text-gray-400">
                            {formatRelativeTime(task.updatedAt)}
                          </span>
                        </div>
                        {task.schedule && (
                          <p className="pl-[18px] auto-text-gray-500 truncate text-[9px]">
                            {task.schedule}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Configurator when selected */}
      {!hasMultiSelection && selected && (
        <TaskMonitorToolConfigurator.Memo
          id={id}
          type="tool:taskMonitor"
          data={data}
        />
      )}
    </>
  )
}

TaskMonitorToolNode.Memo = memo(TaskMonitorToolNode)

/**
 * Backstory Tool Configurator - Allows configuring the backstory tool name.
 */
export function BackstoryToolConfigurator(props) {
  const { setNodes } = useReactFlow()

  const [target] = useDOMQuerySelector('#configurator-area')

  const id = props.id
  const value = props.data

  const setValue = useCallback(
    (newValue) => {
      setNodes((nodes) => {
        return updateConfiguratorNodes(nodes, id, newValue)
      })
    },
    [id, setNodes]
  )

  const schema = useMemo(
    () => ({
      type: 'object',
      properties: {
        name: {
          type: 'string',
          title: 'Name',
          description: 'A name for this backstory version.',
        },
      },
    }),
    []
  )

  return target
    ? createPortal(
        <SchemaPanel.Saving
          className="right-4 top-20"
          title={value.name || 'Backstory'}
          schema={schema}
          value={value}
          setValue={setValue}
        />,
        target
      )
    : null
}

BackstoryToolConfigurator.Memo = memo(BackstoryToolConfigurator)

/**
 * Backstory Tool - An editable backstory that can be connected to bots.
 * When connected to a bot, the backstory content is automatically copied to the bot's backstory field.
 * Multiple backstory tools can be used to manage different backstory versions.
 */
export function BackstoryToolNode({ id, data, selected }) {
  const { mode } = useResources()
  const { getNodes, setNodes, updateNode } = useReactFlow()

  const [backstory, setBackstory] = useState(data.backstory ?? '')
  const [botName, setBotName] = useState(null)
  const [hasMultiSelection, setHasMultiSelection] = useState(false)

  useOnSelectionChange({
    onChange: useCallback(
      ({ nodes }) => setHasMultiSelection(nodes.length > 1),
      []
    ),
  })

  const debouncedBackstory = useDebounce(backstory, 500)

  // Get the connected botId from node data (set by onConnect)
  const botId = data.botId || null

  // Get the bot name from the connected node
  useEffect(() => {
    if (botId) {
      const nodes = getNodes()
      const botNode = nodes.find((node) => node.id === botId)

      if (botNode?.data?.name) {
        setBotName(botNode.data.name)
      } else {
        setBotName('Unnamed Bot')
      }
    } else {
      setBotName(null)
    }
  }, [botId, getNodes])

  // @note update the tool node data when backstory changes
  useEffect(() => {
    // @note skip node mutations in public preview mode
    if (mode === MODE_PUBLIC_PREVIEW) {
      return
    }

    setNodes((nodes) => {
      return nodes.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: {
              ...node.data,
              backstory: debouncedBackstory,
            },
          }
        }

        return node
      })
    })
  }, [id, setNodes, debouncedBackstory, mode])

  // @note copy backstory to connected bot when connection changes or backstory changes
  useEffect(() => {
    // @note skip node mutations in public preview mode
    if (mode === MODE_PUBLIC_PREVIEW) {
      return
    }

    if (botId) {
      updateNode(botId, (node) => {
        // @note normalize empty string and undefined to be comparable
        const currentBackstory = node.data.backstory || ''
        const newBackstory = debouncedBackstory || ''

        // @note only update if the backstory is different to avoid unnecessary updates
        if (currentBackstory === newBackstory) {
          return node
        }

        return {
          ...node,
          data: {
            ...node.data,
            backstory: newBackstory,
          },
        }
      })
    }
  }, [botId, debouncedBackstory, updateNode, mode])

  return (
    <>
      {/* Source handle to connect to bots */}
      <Handle
        id="botId"
        type="source"
        position={Position.Left}
        className={clsx(
          'w-3 h-3',
          'border-2 border-gray-400',
          'bg-white dark:bg-gray-800',
          'rounded-full',
          '-ml-1.5'
        )}
        isConnectable={true}
        isValidConnection={(conn) =>
          isReferenceFieldFor(conn.sourceHandle, conn.targetHandle)
        }
      />

      <NodeResizer
        minWidth={DEFAULT_TOOL_WIDTH}
        minHeight={DEFAULT_TOOL_HEIGHT}
        isVisible={selected}
      />

      <div
        className={clsx(
          'relative w-full h-full flex flex-col rounded-lg overflow-hidden border',
          'auto-bg-gray-100',
          {
            'border-indigo-500 dark:border-indigo-400': selected,
            'auto-border-gray-300': !selected,
          }
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-1.5 p-2 border-b auto-border-gray-200 auto-bg-gray-50">
          <DynamicIcon
            icon="@lucide/scroll-text"
            className="w-3.5 h-3.5 auto-text-gray-500"
          />
          <span className="text-xs font-medium truncate flex-1">
            {data.name || 'Backstory'}
          </span>
          {botId && (
            <span className="text-[10px] auto-text-gray-400 truncate max-w-20">
              → {botName || 'Bot'}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="relative flex-1 overflow-hidden flex flex-col">
          {mode === MODE_PUBLIC_PREVIEW ? (
            <div
              className={clsx(
                '!max-h-none !h-full !overflow-auto p-2 text-xs flex-1',
                'whitespace-pre-wrap break-words auto-text-gray-700'
              )}
            >
              {backstory || (
                <div className="flex items-center justify-center h-full text-xs auto-text-gray-500">
                  <div className="text-center">
                    <DynamicIcon
                      icon="@lucide/scroll-text"
                      className="w-6 h-6 mx-auto mb-2 opacity-50"
                    />
                    <p>Backstory</p>
                    <p className="text-[10px] mt-1 opacity-75">
                      Editable backstory when deployed
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <BackstoryInput
              className={clsx(
                '!max-h-none !h-full !overflow-auto none-input p-2 text-xs flex-1',
                {
                  'nodrag nopan nowheel': selected,
                }
              )}
              wrapperClassName="flex-1 flex flex-col h-full min-h-0"
              containerClassName="flex-1 h-full flex flex-col min-h-0"
              textareaWrapperClassName="flex-1 h-full flex flex-col min-h-0"
              value={backstory}
              onChange={(e) => setBackstory(e.target.value)}
              fieldsInfo={false}
              zoom={true}
              magic={true}
              quickEdit={true}
              placeholder="Enter backstory content..."
            />
          )}
        </div>
      </div>

      {/* Configurator when selected */}
      {!hasMultiSelection && selected && (
        <BackstoryToolConfigurator.Memo
          id={id}
          type="tool:backstory"
          data={data}
        />
      )}
    </>
  )
}

BackstoryToolNode.Memo = memo(BackstoryToolNode)

/**
 *
 */
export function DefaultEdge({
  id,

  sourceX,
  sourceY,
  targetX,
  targetY,

  sourcePosition,
  targetPosition,

  style: _style = {},

  markerStart,
  markerEnd,

  selected,
}) {
  const offset = useMemo(() => {
    return 20
  }, [])

  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    offset,
  })

  // @note vary dash pattern per edge so overlapping edges don't merge into
  // a solid line. Uses a simple hash of the edge ID to pick a pattern.
  const dashStyle = useMemo(() => {
    let hash = 0

    for (let i = 0; i < id.length; i++) {
      hash = (hash * 31 + id.charCodeAt(i)) | 0
    }

    const patterns = ['5 5', '6 4', '4 6', '7 3', '3 7', '8 4', '4 8']

    return patterns[Math.abs(hash) % patterns.length]
  }, [id])

  const { getEdge, setEdges } = useReactFlow()

  const incomingConnection = useConnection()

  const [isConnectedToSelected, setIsConnectedToSelected] = useState(false)

  const [selectedNodes, setSelectedNodes] = useState([])

  // @note useOnSelectionChange fires on every store update with a new array
  // reference even when selection hasn't changed. We must compare by node IDs
  // and only update state when there's an actual change to avoid continuous
  // re-renders that cause edge/handle flickering.
  const onSelectionChange = useCallback(({ nodes }) => {
    setSelectedNodes((prev) => {
      if (prev.length !== nodes.length) {
        return nodes
      }

      const prevIds = new Set(prev.map((n) => n.id))
      const changed = nodes.some((n) => !prevIds.has(n.id))

      return changed ? nodes : prev
    })
  }, [])

  useOnSelectionChange({
    onChange: onSelectionChange,
  })

  useEffect(() => {
    if (!selectedNodes.length) {
      setIsConnectedToSelected(false)

      return
    }

    const edge = getEdge(id)

    if (!edge) {
      setIsConnectedToSelected(false)

      return
    }

    const isConnected = selectedNodes.some(
      (node) => node.id === edge.source || node.id === edge.target
    )

    setIsConnectedToSelected(isConnected)
  }, [id, selectedNodes, getEdge])

  const style = useMemo(() => {
    const hasSelectionOrConnectionDrag =
      selectedNodes.length || incomingConnection.inProgress

    return {
      ..._style,

      // @note apply varied dash pattern to prevent overlapping edges from
      // appearing as a solid line
      strokeDasharray: dashStyle,

      ...(isConnectedToSelected
        ? {
            stroke: 'var(--color-pink-500)',
            strokeDasharray: '0',
          }
        : hasSelectionOrConnectionDrag
          ? {
              opacity: 0.2,
            }
          : null),
    }
  }, [
    _style,
    dashStyle,
    isConnectedToSelected,
    selectedNodes,
    incomingConnection.inProgress,
  ])

  return (
    <>
      <BaseEdge
        path={path}
        markerStart={markerStart}
        markerEnd={markerEnd}
        style={style}
      />
      {isConnectedToSelected ? (
        <circle r="2" fill="var(--color-pink-500)">
          <animateMotion
            path={path}
            dur={Math.random() < 0.5 ? '4s' : '6s'}
            repeatCount="indefinite"
            keyTimes="0;0.5;1"
            keyPoints={Math.random() < 0.5 ? '0;1;0' : '1;0;1'}
          />
        </circle>
      ) : null}
      <EdgeLabelRenderer>
        <div
          className={clsx('nodrag nopan', {
            'z-[1000]': selected || isConnectedToSelected,
          })}
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            fontSize: 12,
            pointerEvents: 'all',
          }}
        >
          {!incomingConnection.inProgress ? (
            <button
              className={clsx(
                'edgebutton',
                'bg-gray-200 dark:bg-gray-800',
                'p-1 rounded-full',
                'hover:scale-110 ring-offset-2 ring-offset-white dark:ring-offset-black hover:ring hover:!ring-pink-500',
                'transition-all duration-200',
                {
                  'ring ring-pink-500': selected || isConnectedToSelected,
                }
              )}
              type="button"
              onClick={() => {
                setEdges((edges) => edges.filter((edge) => edge.id !== id))
              }}
            >
              <XMarkIcon className="w-3 h-3" />
            </button>
          ) : null}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

/**
 *
 */
export function BaseHandle({
  className,

  id,
  type,

  style,

  isVisible,

  ...props
}) {
  const reactFlow = useReactFlow()

  const { updateNode } = reactFlow

  const onConnect = useCallback(
    (edges) => {
      edges.forEach((edge) => {
        updateNode(edge.source, (node) => applyConnectionEdgeToNode(node, edge))
      })
    },
    [updateNode]
  )

  const onDisconnect = useCallback(
    (edges) => {
      edges.forEach((edge) => {
        updateNode(edge.source, (node) =>
          clearConnectionEdgeFromNode(node, edge)
        )
      })
    },
    [updateNode]
  )

  // @note Memoize the connection options to prevent useNodeConnections from
  // re-subscribing on every render due to a new options object reference.

  const connectionOptions = useMemo(
    () => ({
      handleId: id,
      handleType: type,
      onConnect,
      onDisconnect,
    }),
    [id, type, onConnect, onDisconnect]
  )

  const connections = useNodeConnections(connectionOptions)

  // @note useNodeConnections may return a new array reference on every store
  // update even when connections haven't changed. Stabilize by tracking only
  // the connection count which is all we need for isConnectable.

  const prevConnectionCountRef = useRef(connections.length)

  const connectionCount = useMemo(() => {
    if (connections.length !== prevConnectionCountRef.current) {
      prevConnectionCountRef.current = connections.length
    }

    return prevConnectionCountRef.current
  }, [connections.length])

  // @note For instruction parameter handles with the 'instruction:' prefix,
  // we strip the prefix before checking if it ends with 'Id'

  const baseId = isInstructionParamHandle(id) ? getParamNameFromHandle(id) : id

  const isConnectable = baseId.endsWith('Id') ? connectionCount === 0 : true

  // @note while the platform templates are still loading the blueprint graph is
  // only partially resolved, so every handle renders at once which looks noisy.
  // Keep handles that already have a connection visible (so existing wiring
  // reads clearly) and hide the unconnected ones until everything has loaded.

  const { loading: resourcesLoading } = useResources()

  const hiddenWhileLoading = resourcesLoading && connectionCount === 0

  const isValidConnection = (conn) => {
    // @note For instruction parameter handles with the 'instruction:' prefix,
    // we strip the prefix before comparing to the target handle

    const sourceHandle = isInstructionParamHandle(conn.sourceHandle)
      ? getParamNameFromHandle(conn.sourceHandle)
      : conn.sourceHandle

    const sourceNodeType = reactFlow.getNode(conn.source)?.type
    const targetNodeType = reactFlow.getNode(conn.target)?.type
    const validErrorLogConnection = isValidErrorLogToolConnection({
      sourceHandle,
      sourceNodeType,
      targetHandle: conn.targetHandle,
      targetNodeType,
    })

    if (validErrorLogConnection != null) {
      return validErrorLogConnection
    }

    // @note skillsetForAbility only accepts connections from abilities
    if (conn.targetHandle === 'skillsetForAbility') {
      return sourceHandle === 'skillsetId' && sourceNodeType === 'ability'
    }

    // @note the main skillset target rejects connections from abilities
    // (they should use skillsetForAbility instead)
    if (conn.targetHandle === 'skillset' && sourceHandle === 'skillsetId') {
      return sourceNodeType !== 'ability'
    }

    return isReferenceFieldFor(sourceHandle, conn.targetHandle)
  }

  const incomingConnection = useConnection()

  const handleTitle = getHandleTooltip(id, type)

  const [isTooltipOpen, setIsTooltipOpen] = useState(false)

  const tooltipTimerRef = useRef(null)
  const tooltipAnchorRef = useRef(null)

  const [tooltipPosition, setTooltipPosition] = useState(null)

  const tooltipTransform = {
    [Position.Top]: 'translate(-50%, -100%)',
    [Position.Bottom]: 'translate(-50%, 0)',
    [Position.Left]: 'translate(-100%, -50%)',
    [Position.Right]: 'translate(0, -50%)',
  }[props.position]

  const updateTooltipPosition = useCallback(() => {
    const anchor = tooltipAnchorRef.current

    if (!anchor) {
      return
    }

    const rect = anchor.getBoundingClientRect()
    const offset = 12

    switch (props.position) {
      case Position.Top: {
        setTooltipPosition({
          left: rect.left + rect.width / 2,
          top: rect.top - offset,
        })

        break
      }

      case Position.Bottom: {
        setTooltipPosition({
          left: rect.left + rect.width / 2,
          top: rect.bottom + offset,
        })

        break
      }

      case Position.Left: {
        setTooltipPosition({
          left: rect.left - offset,
          top: rect.top + rect.height / 2,
        })

        break
      }

      case Position.Right:
      default: {
        setTooltipPosition({
          left: rect.right + offset,
          top: rect.top + rect.height / 2,
        })

        break
      }
    }
  }, [props.position])

  const openTooltip = useCallback(() => {
    if (tooltipTimerRef.current) {
      clearTimeout(tooltipTimerRef.current)
      tooltipTimerRef.current = null
    }

    tooltipTimerRef.current = setTimeout(() => {
      updateTooltipPosition()
      setIsTooltipOpen(true)

      tooltipTimerRef.current = null
    }, 500)
  }, [updateTooltipPosition])

  const closeTooltip = useCallback(() => {
    if (tooltipTimerRef.current) {
      clearTimeout(tooltipTimerRef.current)

      tooltipTimerRef.current = null
    }

    setIsTooltipOpen(false)
  }, [])

  useEffect(() => {
    if (!isTooltipOpen) {
      return
    }

    updateTooltipPosition()

    const onViewportChange = () => {
      updateTooltipPosition()
    }

    window.addEventListener('resize', onViewportChange)
    window.addEventListener('scroll', onViewportChange, true)

    return () => {
      window.removeEventListener('resize', onViewportChange)
      window.removeEventListener('scroll', onViewportChange, true)
    }
  }, [isTooltipOpen, updateTooltipPosition])

  useEffect(() => {
    return () => {
      if (tooltipTimerRef.current) {
        clearTimeout(tooltipTimerRef.current)
      }
    }
  }, [])

  return (
    <div
      ref={tooltipAnchorRef}
      className="relative"
      onMouseEnter={openTooltip}
      onMouseLeave={closeTooltip}
      onMouseMove={isTooltipOpen ? updateTooltipPosition : undefined}
    >
      <Handle
        {...props}
        className="!bg-transparent !border-none	!w-[10px] !h-[10px]"
        id={id}
        type={type}
        isConnectable={isConnectable}
        isValidConnection={isValidConnection}
        aria-label={handleTitle}
        onFocus={openTooltip}
        onBlur={closeTooltip}
      >
        <div
          className={clsx(
            'base-handle',

            'w-full h-full',

            // 'bg-black dark:bg-white',
            'bg-gray-500 dark:bg-gray-500',

            'rounded-full',

            'pointer-events-none', // @note used for the handle to accept mouse events

            className,

            'transition-opacity duration-200',

            {
              'ring-2 ring-offset-2 ring-violet-500 ring-offset-white dark:ring-offset-black':
                isConnectable && type === 'source',
              'ring-2 ring-offset-2 ring-pink-500 ring-offset-white dark:ring-offset-black':
                isConnectable && type === 'target',
            },
            {
              '': isConnectable && ['linkedSecretId'].includes(id), // @todo document what this is for
            },
            {
              'opacity-0': !isVisible || hiddenWhileLoading,
              'animate-ping':
                isVisible && isConnectable && incomingConnection.inProgress,
            }
          )}
          style={style}
        />
      </Handle>
      <GlobalRootPortal>
        {isVisible && tooltipPosition ? (
          <div
            className={clsx(
              'fixed z-[9999] pointer-events-none whitespace-nowrap',
              'px-2 py-1 rounded-md',
              'text-[11px] leading-none',
              'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900',
              'shadow-md',
              'origin-center transition-all duration-150 ease-out',
              {
                'opacity-100 scale-100': isTooltipOpen,
                'opacity-0 scale-95': !isTooltipOpen,
              }
            )}
            style={{
              left: tooltipPosition.left,
              top: tooltipPosition.top,
              transform: tooltipTransform || 'translate(-50%, -100%)',
            }}
            aria-hidden={!isTooltipOpen}
          >
            {handleTitle}
          </div>
        ) : null}
      </GlobalRootPortal>
    </div>
  )
}

/**
 *
 */
export function BaseBox({
  className,

  icon,

  title,
  description,

  tools,

  id,
  type,

  width,
  height,

  data,

  selected,

  children,
}) {
  const reactFlow = useReactFlow()

  const { loading } = useResources()

  // @note memoize instruction type for ability nodes to avoid redundant computation
  const instructionType = useMemo(() => {
    if (type !== 'ability') {
      return null
    }

    return getInstructionType(data?.instruction || '')
  }, [type, data?.instruction])

  // @note extract template name to show pack/mock tags for ability nodes
  const templateName = useMemo(() => {
    if (type !== 'ability' || !data?.instruction) {
      return null
    }

    try {
      return parseTemplateInstruction(data.instruction).template
    } catch {
      return null
    }
  }, [type, data?.instruction])

  return (
    <Box
      className={clsx('base-box shadow-md rounded-xl', className, {
        // 'ring ring-offset-2 ring-offset-white dark:ring-offset-black ring-pink-500 rounded-[10px]': selected,
        'animate-pulse': loading,
      })}
      style={{ minWidth: width, minHeight: height }}
    >
      <Box
        className={clsx('p-[2px] inset-0 rounded-xl', {
          'bg-gray-500 dark:bg-gray-500': !selected,
          'bg-gradient-dynamic from-pink-500 via-cyan-500 to-violet-500 animate-deg-rotate':
            selected,
        })}
      >
        <Box className="rounded-[10px] bg-gray-50 dark:bg-gray-950">
          <div className="p-2 flex flex-row gap-2 items-center overflow-hidden">
            <DynamicIcon
              className="shrink-0 w-5 h-5 rounded-sm object-cover"
              icon={loading ? Spinner : icon || '@lucide/puzzle'}
              fallbackIcon="@lucide/puzzle"
            />
            <div className="w-full text-lg font-semibold truncate">{title}</div>
            <button
              type="button"
              className={clsx(
                'text-gray-500 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-200',
                'transition-all duration-300 ease-in-out',
                'cursor-pointer'
              )}
              onClick={() => {
                const { position } = reactFlow.getNode(id)

                reactFlow.addNodes([
                  {
                    id: getRandomId(`#${type}:::`),
                    type,
                    position: {
                      x: position.x + 100,
                      y: position.y + 100,
                    },
                    data: {
                      ...data,
                    },
                    width,
                    height,
                  },
                ])
              }}
            >
              <DocumentDuplicateIcon className="w-4 h-4 justify-self-end cursor-copy" />
            </button>
            <button
              type="button"
              className={clsx(
                'text-gray-500 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-200',
                'transition-all duration-300 ease-in-out',
                'cursor-pointer'
              )}
              onClick={() => {
                reactFlow.deleteElements({ nodes: [{ id }] })
              }}
            >
              <XMarkIcon className="w-4 h-4 justify-self-end" />
            </button>
          </div>
          <div
            className={clsx(
              'mx-1 p-2 flex-1 flex flex-col gap-2'
              // 'bg-white dark:bg-black rounded-md cursor-pointer'
            )}
          >
            {description ? (
              <p className="text-xs line-clamp-2">
                {typeof description === 'string'
                  ? getShortDescription(description)
                  : description}
              </p>
            ) : null}
            {children}
          </div>
          <div className="p-2 text-xxs flex flex-row items-center gap-2 overflow-hidden">
            {!id.startsWith('#') ? (
              <CopyButton
                className="cursor-copy min-w-0 flex-1 truncate text-left"
                message="Resource id copied to your clipboard"
                text={id}
              >
                &#x2116; {id}
              </CopyButton>
            ) : (
              <div className="min-w-0 flex-1" />
            )}
            {tools}
            {type === 'bot' && !id.startsWith('#') ? (
              <BotBlockTag botId={id} />
            ) : null}
            {type === 'secret' ? (
              <>
                {data?.config?.template?.startsWith?.('platform/') ? (
                  <TooltipButton tooltip="This is secret is managed by ChatBotKit">
                    <span
                      className={clsx(
                        'tag text-xxs',
                        'min-w-0 max-w-full shrink'
                      )}
                    >
                      platform
                    </span>
                  </TooltipButton>
                ) : null}
              </>
            ) : null}
            {type === 'triggerIntegration' ? (
              <>
                {data.schedule && data.schedule !== 'never' ? (
                  <TooltipButton
                    tooltip={`This integration is scheduled to trigger: ${data.schedule}`}
                  >
                    <span
                      className={clsx(
                        'tag text-xxs',
                        'min-w-0 max-w-full shrink'
                      )}
                    >
                      ⏱︎
                    </span>
                  </TooltipButton>
                ) : null}
              </>
            ) : null}
            {instructionType ? (
              <TooltipButton tooltip={`Instruction type: ${instructionType}`}>
                <span
                  className={clsx('tag text-xxs', 'min-w-0 max-w-full shrink')}
                >
                  {instructionType}
                </span>
              </TooltipButton>
            ) : null}
            {templateName?.startsWith('pack/') ? (
              <span
                className={clsx('tag text-xxs', 'min-w-0 max-w-full shrink')}
              >
                pack
              </span>
            ) : null}
            {templateName?.startsWith('mock/') ? (
              <span
                className={clsx('tag text-xxs', 'min-w-0 max-w-full shrink')}
              >
                mock
              </span>
            ) : null}
            <TooltipButton
              as="span"
              tooltip={
                data?.visibility && data.visibility !== 'private'
                  ? `${data.visibility}`
                  : undefined
              }
            >
              <span
                className={clsx('tag text-xxs', 'min-w-0 max-w-full shrink', {
                  error: data?.visibility === 'public',
                  warning: data?.visibility === 'protected',
                })}
              >
                {type === 'oAuthConnection'
                  ? 'oauth'
                  : type.replace('Integration', '')}
              </span>
            </TooltipButton>
            {!id.startsWith('#') ? (
              <ArrowUpRightIcon
                className={clsx(
                  'shrink-0',
                  'w-4 h-4',
                  'text-gray-500 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-200',
                  'transition-all duration-300 ease-in-out',
                  'cursor-pointer'
                )}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()

                  if (/^(.+?)Integration$/.test(type)) {
                    window.open(
                      `/${type.replace(
                        /^(.+?)Integration$/,
                        'integrations/$1'
                      )}/${id}`
                    )
                  } else {
                    window.open(`/${getCollection(type)}/${id}`)
                  }
                }}
              />
            ) : null}
            {/* {top && popupWidgetInstance ? (
              <QuestionMarkCircleIcon
                className={clsx(
                  'shrink-0',
                  'w-4 h-4',
                  'text-gray-500 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-200',
                  'transition-all duration-300 ease-in-out',
                  'cursor-pointer'
                )}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()

                  popupWidgetInstance.open = true

                  popupWidgetInstance.sendMessage({
                    message: `What are ${toWordCase(getCollection(type))}?`,
                    respond: true,
                  })
                }}
              />
            ) : null} */}
          </div>
        </Box>
      </Box>
    </Box>
  )
}

BaseBox.Memo = memo(BaseBox)

/**
 *
 */
export function IconBox({
  className,

  barIcon: icon,
  icon: contentIcon,

  description: _description,

  type,
  data,

  ...props
}) {
  // @note animate icon colors when a scheduled resource is active (a trigger
  // integration or a task with a live schedule)
  const isActiveScheduled =
    (type === 'triggerIntegration' || type === 'task') &&
    data?.schedule &&
    data.schedule !== 'never'

  return (
    <BaseBox
      {...props}
      className={clsx('icon-box', className)}
      icon={icon}
      type={type}
      data={data}
    >
      <div className="flex-1 flex flex-col justify-center items-center">
        <DynamicIcon
          className={clsx('w-16 h-16 rounded-xl', {
            'animate-color-cycle': isActiveScheduled,
          })}
          icon={contentIcon}
        />
      </div>
    </BaseBox>
  )
}

IconBox.Memo = memo(IconBox)

/**
 *
 */
export function AvatarBox({
  className,

  description: _description,

  type,
  data,

  ...props
}) {
  return (
    <BaseBox
      {...props}
      className={clsx('icon-box', className)}
      type={type}
      data={data}
      description={null}
    >
      <div className="flex-1 flex flex-col justify-center items-center">
        <div className="relative w-full max-h-44 aspect-[3/4] overflow-hidden rounded-lg border auto-border-gray-200 bg-black">
          <video
            className="h-full w-full object-cover object-center"
            src="/avatars/friend.mp4"
            autoPlay
            muted
            loop
            playsInline
            aria-label="ChatBotKit Avatar preview"
          />
        </div>
      </div>
    </BaseBox>
  )
}

AvatarBox.Memo = memo(AvatarBox)

/**
 *
 */
export function AnamBox({
  className,

  icon: contentIcon,
  description: _description,

  type,
  data,

  tools,

  ...props
}) {
  const [persona, setPersona] = useState(null)
  const { fetch: fetchPersonas } = useFetch({
    trackLoading: false,
    failureMessage: false,
    xRequestedWith: false,
  })

  useEffect(() => {
    if (!data?.apiKey || !data?.personaId) {
      setPersona(null)

      return
    }

    let canceled = false

    async function fetchPersona() {
      try {
        const { data: result, error } = await fetchPersonas(
          'https://api.anam.ai/v1/personas?perPage=100',
          {
            headers: {
              Authorization: `Bearer ${data.apiKey}`,
            },
          }
        )

        if (error) {
          throw new Error('Failed to load Anam personas')
        }

        const personas = Array.isArray(result?.data) ? result.data : []
        const nextPersona = personas.find(
          (persona) => persona.id === data.personaId
        )

        if (!canceled) {
          setPersona(nextPersona || null)
        }
      } catch {
        if (!canceled) {
          setPersona(null)
        }
      }
    }

    fetchPersona()

    return () => {
      canceled = true
    }
  }, [data?.apiKey, data?.personaId, fetchPersonas])

  const avatar = persona?.avatar
  const previewUrl = avatar?.videoUrl || avatar?.imageUrl

  return (
    <BaseBox
      {...props}
      className={clsx('icon-box', className)}
      type={type}
      data={data}
      description={null}
      tools={
        <>
          {persona ? (
            <TooltipButton tooltip={persona.name || persona.id}>
              <span className="tag text-xxs min-w-0 max-w-full shrink">
                {persona.name || persona.id}
              </span>
            </TooltipButton>
          ) : null}
          {tools}
        </>
      }
    >
      <div className="flex-1 flex flex-col justify-center items-center">
        {previewUrl ? (
          <div className="relative w-full max-h-44 aspect-[3/4] overflow-hidden rounded-lg border auto-border-gray-200 bg-black shadow-sm">
            {avatar.videoUrl ? (
              <video
                className="h-full w-full object-cover object-top"
                src={avatar.videoUrl}
                poster={avatar.imageUrl}
                autoPlay
                muted
                loop
                playsInline
                aria-label={persona.name || persona.id || 'Anam avatar'}
              />
            ) : (
              <img
                className="h-full w-full object-cover object-top"
                src={avatar.imageUrl}
                alt={avatar.displayName || persona.name || 'Anam avatar'}
              />
            )}
          </div>
        ) : (
          <DynamicIcon className="w-16 h-16 rounded-xl" icon={contentIcon} />
        )}
      </div>
    </BaseBox>
  )
}

AnamBox.Memo = memo(AnamBox)

/**
 *
 */
export function VerticalBox({
  className,

  ...props
}) {
  return <BaseBox {...props} className={clsx('vertical-box', className)} />
}

VerticalBox.Memo = memo(VerticalBox)

/**
 *
 */
export function PortalBox({
  className,

  data,

  ...props
}) {
  const apps = useMemo(() => {
    if (!data?.config?.apps || typeof data.config.apps !== 'object') {
      return []
    }

    return Object.entries(data.config.apps).map(([slug, appConfig]) => {
      const instance = configApps.find(
        (app) => app.slug === slug || app.id === slug
      )

      return {
        slug,
        icon: appConfig?.icon || instance?.icon || '@lucide/puzzle',
      }
    })
  }, [data.config])

  return (
    <BaseBox
      {...props}
      className={clsx('large-box', className)}
      data={data}
      description={null}
    >
      {apps.length ? (
        <div className="flex flex-row flex-wrap gap-1 items-center">
          {apps.map((app, index) => (
            <DynamicIcon key={index} className="w-4 h-4" icon={app.icon} />
          ))}
        </div>
      ) : null}
    </BaseBox>
  )
}

PortalBox.Memo = memo(PortalBox)

/**
 *
 */
export const connectionLineType = ConnectionLineType.SmoothStep

/**
 *
 */
export const connectionLineStyle = {
  stroke: 'var(--color-pink-500)',
  strokeWidth: 2,
}

/**
 * Build node types from resources.
 */
export function buildNodeTypes(
  allResources,
  abilityResources,
  secretResources
) {
  return {
    // resources

    ...Object.fromEntries(
      Object.entries(allResources).map(
        ([
          type,
          {
            icon,

            title,

            schema,

            Configurator,

            Frame = BaseBox.Memo,

            width,
            height,

            ...rest
          },
        ]) => {
          /**
           * The target connection are the connections that are coming into the
           * node. Each node has at least one target connection but only if in the
           * total list of resources there is a resource that has a field that
           * references a resource of this type.
           *
           * @note We check both the schema and additionalSourceConnections to
           * support dynamic connections from ability instruction fields.
           *
           * @note Integration types always get a target handle because abilities
           * can dynamically reference them via instruction parameters (e.g.,
           * slackIntegrationId in an ability's instruction).
           */
          const isIntegrationType = type.endsWith('Integration')

          const targetConnections = [type]
            .filter(
              (key) =>
                isIntegrationType ||
                Object.values(allResources).find(
                  ({ schema, additionalSourceConnections = [] }) =>
                    Object.keys(schema).some((field) =>
                      isReferenceFieldFor(field, key)
                    ) ||
                    additionalSourceConnections.some((field) =>
                      isReferenceFieldFor(field, key)
                    )
                )
            )
            .sort((a, b) => a.localeCompare(b))

          // @note skillset gets a second target handle so abilities connect
          // from the bottom while bots connect from the top
          if (type === 'skillset') {
            targetConnections.push('skillsetForAbility')
          }

          /**
           * The source connections are the connections that are going out of the
           * node into another node. This is typically related to fields that end
           * with `Id` where the field is a reference to another resource.
           */
          const schemaSourceConnections = Object.keys(schema)
            .filter((key) => key.endsWith('Id'))
            .filter(
              (key) =>
                ({
                  // we need to filter out keys that are not actual connections
                  // but match the pattern
                  [`discordIntegration:appId`]: false,
                  [`microsoftteamsIntegration:botFrameworkAppId`]: false,
                  [`microsoftteamsIntegration:tenantId`]: false,
                  [`whatsappIntegration:phoneNumberId`]: false,
                })[`${type}:${key}`] ?? true
            )

          /**
           * Additional source connections from ability instruction fields.
           * These are dynamic connections extracted from the instruction template
           * (e.g., slackIntegrationId field in an ability's instruction).
           */
          const additionalConnections = rest.additionalSourceConnections || []

          const sourceConnections = [
            ...schemaSourceConnections,
            ...additionalConnections,
          ].sort((a, b) => a.localeCompare(b))

          /**
           * The actual component that will be rendered for the node type.
           */
          function Component(props) {
            const incomingConnection = useConnection()
            const reactFlowInstance = useReactFlow()

            const [hasMultiSelection, setHasMultiSelection] = useState(false)

            const [hasSelectionButNotMe, setHasSelectionButNotMe] =
              useState(false)

            const { loading } = useResources()

            /**
             * Compute dynamic source connections from the node's instruction.
             * This extracts resource reference fields (e.g., slackIntegrationId)
             * from the instruction parameters to create additional handles.
             */
            const dynamicSourceConnections = useMemo(() => {
              // Only compute for ability type nodes that have an instruction

              if (type !== 'ability' || !props.data?.instruction) {
                return []
              }

              return extractInstructionReferenceFields(props.data.instruction)
            }, [props.data?.instruction])

            /**
             * For templated abilities, only show schema connections that the
             * template actually requires (secret, file, space, bot).
             * For non-templated abilities, show all schema connections.
             */
            const filteredSchemaConnections = useMemo(() => {
              if (type !== 'ability') {
                return sourceConnections
              }

              // Try to find the template

              let templateResource = null

              if (props.data?.instruction) {
                try {
                  const { template } = parseTemplateInstruction(
                    props.data.instruction
                  )

                  templateResource = abilityResources[template]
                } catch {
                  // Ignore parsing errors
                }
              }

              // If no template found, this is a non-templated ability - show all

              if (!templateResource) {
                return sourceConnections
              }

              // Filter to only connections the template requires

              return sourceConnections.filter((conn) => {
                // Map connection to resource property check

                switch (conn) {
                  case 'linkedBotId': {
                    return !!templateResource.bot
                  }

                  case 'linkedSecretId': {
                    return !!templateResource.secret
                  }

                  case 'linkedFileId': {
                    return !!templateResource.file
                  }

                  case 'linkedSpaceId': {
                    return !!templateResource.space
                  }

                  // skillsetId is always shown for now as it is core ability
                  // relationships

                  default: {
                    return true
                  }
                }
              })
            }, [props.data?.instruction])

            /**
             * All source connections: filtered schema-based + dynamic from
             * instruction.
             */
            const allSourceConnections = useMemo(() => {
              const combined = [
                ...filteredSchemaConnections,
                ...dynamicSourceConnections,
              ]

              // Deduplicate and sort

              return [...new Set(combined)].sort((a, b) => a.localeCompare(b))
            }, [filteredSchemaConnections, dynamicSourceConnections])

            /**
             * When handles change (e.g., due to template filtering), we need to
             * tell ReactFlow to recalculate the internal node dimensions and
             * handle positions, otherwise edges will connect to stale positions.
             *
             * @note requestAnimationFrame defers the call until after ReactFlow
             * has fully registered the node's Handle components, which happens
             * asynchronously after mount. Without the delay, the first call can
             * fire before handles are registered, and since allSourceConnections
             * is referentially stable the effect never re-fires.
             */
            const updateNodeInternals = useUpdateNodeInternals()

            useEffect(() => {
              const raf = requestAnimationFrame(() => {
                updateNodeInternals(props.id)
              })

              return () => cancelAnimationFrame(raf)
            }, [updateNodeInternals, props.id, allSourceConnections])

            const onSelectionChange = useCallback(
              ({ nodes }) => {
                setHasMultiSelection(nodes.length > 1)

                setHasSelectionButNotMe(
                  nodes.length > 0 &&
                    nodes.every((node) => node.id !== props.id)
                )
              },
              [props.id]
            )

            useOnSelectionChange({
              onChange: onSelectionChange,
            })

            const incomingConnectionInProgress = incomingConnection?.inProgress

            const incomingConnectionFromHandleId =
              incomingConnection?.fromHandle?.id
            const incomingConnectionFromHandleType =
              incomingConnection?.fromHandle?.type
            const incomingConnectionFromNodeId =
              incomingConnection?.fromNode?.id

            const [
              topTargetElements,
              bottomTargetElements,
              leftTargetElements,
              rightTargetElements,
              hasVisibleTargetElements,
            ] = useMemo(() => {
              let hasVisible = false

              const connections = targetConnections.map((connection, index) => {
                const position =
                  {
                    // add here specific positions

                    'skillset:skillset': Position.Top,
                    'skillset:skillsetForAbility': Position.Left,
                    'secret:secret': Position.Right,
                    'file:file': Position.Right,
                  }[`${type}:${connection}`] ??
                  {
                    0: Position.Top,
                    1: Position.Left,
                    3: Position.Right,
                    2: Position.Bottom,
                  }[index]

                let isVisible = true

                if (
                  incomingConnectionInProgress &&
                  incomingConnectionFromHandleId
                ) {
                  // @note strip "instruction:" prefix for comparison since
                  // instruction param handles connect to the same targets

                  const baseFromHandleId = isInstructionParamHandle(
                    incomingConnectionFromHandleId
                  )
                    ? getParamNameFromHandle(incomingConnectionFromHandleId)
                    : incomingConnectionFromHandleId

                  if (incomingConnectionFromHandleType === 'source') {
                    // @note skillsetForAbility only lights up for abilities,
                    // skillset only lights up for non-abilities
                    if (connection === 'skillsetForAbility') {
                      const sourceNodeType = incomingConnectionFromNodeId
                        ? reactFlowInstance.getNode(
                            incomingConnectionFromNodeId
                          )?.type
                        : null

                      isVisible =
                        baseFromHandleId === 'skillsetId' &&
                        sourceNodeType === 'ability'
                    } else if (
                      connection === 'skillset' &&
                      baseFromHandleId === 'skillsetId'
                    ) {
                      const sourceNodeType = incomingConnectionFromNodeId
                        ? reactFlowInstance.getNode(
                            incomingConnectionFromNodeId
                          )?.type
                        : null

                      isVisible = sourceNodeType !== 'ability'
                    } else {
                      isVisible = isReferenceFieldFor(
                        baseFromHandleId,
                        connection
                      )
                    }
                  } else {
                    isVisible = isReferenceFieldFor(
                      connection,
                      baseFromHandleId
                    )
                  }
                }

                if (isVisible) {
                  hasVisible = true
                }

                return (
                  <BaseHandle
                    key={index}
                    id={connection}
                    type="target"
                    position={position}
                    isVisible={isVisible}
                  />
                )
              })

              const topConnections = connections.filter(
                (connection) => connection.props.position === Position.Top
              )
              const bottomConnections = connections.filter(
                (connection) => connection.props.position === Position.Bottom
              )
              const leftConnections = connections.filter(
                (connection) => connection.props.position === Position.Left
              )
              const rightConnections = connections.filter(
                (connection) => connection.props.position === Position.Right
              )

              return [
                topConnections,
                bottomConnections,
                leftConnections,
                rightConnections,
                hasVisible,
              ]
            }, [
              incomingConnectionInProgress,
              incomingConnectionFromHandleId,
              incomingConnectionFromHandleType,
              incomingConnectionFromNodeId,
              reactFlowInstance,
            ])

            const [
              topSourceElements,
              bottomSourceElements,
              leftSourceElements,
              rightSourceElements,
              hasVisibleSourceElements,
            ] = useMemo(() => {
              let hasVisible = false

              const connections = allSourceConnections.map(
                (connection, index) => {
                  // @note For instruction parameter handles, we strip the prefix
                  // for visibility checks but use the prefix to determine position

                  const isInstructionParam =
                    isInstructionParamHandle(connection)

                  const baseConnection = isInstructionParam
                    ? getParamNameFromHandle(connection)
                    : connection

                  // @note Instruction parameters always go on the left side,
                  // separate from schema-level fields which may have the same name

                  const position = isInstructionParam
                    ? Position.Left
                    : ({
                        // add here specific positions for schema-level fields

                        'ability:skillsetId': Position.Top,
                        'ability:linkedSecretId': Position.Left,
                        'ability:linkedFileId': Position.Left,
                        'ability:linkedBotId': Position.Left,
                        'ability:linkedSpaceId': Position.Left,
                      }[`${type}:${baseConnection}`] ??
                      // Default position for dynamic resource connections
                      // (integrations, datasets, etc. go on the left)

                      (isDynamicResourceField(baseConnection)
                        ? Position.Left
                        : {
                            0: Position.Bottom,
                            1: Position.Right,
                            3: Position.Left,
                            2: Position.Top,
                          }[index]))

                  let isVisible = true

                  if (
                    incomingConnectionInProgress &&
                    incomingConnectionFromHandleId
                  ) {
                    // @note For visibility, we need to compare the base connection
                    // name (without prefix) to the incoming handle ID

                    if (incomingConnectionFromHandleType === 'source') {
                      isVisible = isReferenceFieldFor(
                        incomingConnectionFromHandleId,
                        baseConnection
                      )
                    } else {
                      // @note when dragging from skillsetForAbility target,
                      // only ability nodes' skillsetId should pulse
                      if (
                        incomingConnectionFromHandleId === 'skillsetForAbility'
                      ) {
                        isVisible =
                          baseConnection === 'skillsetId' && type === 'ability'
                      } else if (
                        incomingConnectionFromHandleId === 'skillset'
                      ) {
                        // @note when dragging from skillset target,
                        // only non-ability nodes' skillsetId should pulse
                        isVisible =
                          baseConnection === 'skillsetId' && type !== 'ability'
                      } else {
                        isVisible = isReferenceFieldFor(
                          baseConnection,
                          incomingConnectionFromHandleId
                        )
                      }
                    }
                  }

                  if (isVisible) {
                    hasVisible = true
                  }

                  return (
                    <BaseHandle
                      key={index}
                      id={connection}
                      type="source"
                      position={position}
                      isVisible={isVisible}
                    />
                  )
                }
              )

              const topConnections = connections.filter(
                (connection) => connection.props.position === Position.Top
              )
              const bottomConnections = connections.filter(
                (connection) => connection.props.position === Position.Bottom
              )
              const leftConnections = connections.filter(
                (connection) => connection.props.position === Position.Left
              )
              const rightConnections = connections.filter(
                (connection) => connection.props.position === Position.Right
              )

              return [
                topConnections,
                bottomConnections,
                leftConnections,
                rightConnections,
                hasVisible,
              ]
            }, [
              allSourceConnections,
              incomingConnectionInProgress,
              incomingConnectionFromHandleId,
              incomingConnectionFromHandleType,
            ])

            const hasVisible =
              hasVisibleTargetElements || hasVisibleSourceElements

            /**
             * Used to display the icon linked to the specific resource and its
             * configuration which might be different from the default icon for
             * the resource.
             */
            const customIcon = useMemo(() => {
              switch (type) {
                case 'ability': {
                  // @note the ability's icon comes from the catalogue template
                  // it was created from, recovered via the template id embedded
                  // in its instruction (with a display-name fallback)
                  const resource = resolveAbilityTemplate(
                    props.data,
                    abilityResources
                  )

                  if (resource) {
                    return resource.icon
                  }
                }

                case 'secret': {
                  try {
                    const { template } = props.data.config || {}

                    const resource = secretResources[template]

                    if (resource) {
                      return resource.icon
                    }
                  } catch {
                    // pass
                  }

                  const matchedResource = Object.values(secretResources).find(
                    (r) => r.title === props.data.name
                  )

                  if (matchedResource) {
                    return matchedResource.icon
                  }
                }
              }
            }, [props.data.name, props.data.instruction, props.data.config])

            const botWarnings = useBotWarnings(props.data, props.type !== 'bot')

            const datasetWarnings = useDatasetWarnings(
              props.data,
              props.type !== 'dataset'
            )

            const skillsetWarnings = useSkillsetWarnings(
              props.data,
              props.type !== 'skillset'
            )

            const abilityWarnings = useAbilityWarnings(
              props.data,
              props.type !== 'ability',
              abilityResources
            )

            const triggerIntegrationWarnings = useTriggerIntegrationWarnings(
              props.data,
              props.type !== 'triggerIntegration'
            )

            const taskWarnings = useTaskWarnings(
              props.data,
              props.type !== 'task'
            )

            const slackIntegrationWarnings = useSlackIntegrationWarnings(
              props.data,
              props.type !== 'slackIntegration'
            )

            // @note wildcard `allowFrom` heads-up for any integration with an
            // access list. Kept separate from the per-integration warning hooks
            // so it applies uniformly (slackIntegrationWarnings does not include
            // it, so slack nodes are not double-counted).
            const allowFromWarnings = useMemo(
              () =>
                integrationTypesWithAllowFrom.has(props.type)
                  ? getAllowFromWarnings(props.data)
                  : [],
              [props.type, props.data]
            )

            // @note Secret warnings need connection info, but we can't use
            // useSecretWarnings here because it subscribes ALL nodes to edge
            // changes via useNodeConnections, causing cascading re-renders.
            // Instead, we check edges only for secret nodes using a snapshot
            // approach. We intentionally omit reactFlowInstance from deps
            // because getEdges is a stable method and we want a point-in-time
            // check when other deps change, not a subscription to edge changes.
            const secretWarnings = useMemo(() => {
              if (props.type !== 'secret') {
                return []
              }

              const hasConnections = reactFlowInstance
                .getEdges()
                .some((edge) => edge.target === props.id)

              return getSecretWarnings(props.data, secretResources, {
                connections: hasConnections ? [{}] : [],
              })
              // eslint-disable-next-line react-hooks/exhaustive-deps
            }, [props.type, props.id, props.data])

            const warnings = useMemo(() => {
              return [
                ...botWarnings,
                ...datasetWarnings,
                ...skillsetWarnings,
                ...abilityWarnings,
                ...triggerIntegrationWarnings,
                ...taskWarnings,
                ...slackIntegrationWarnings,
                ...allowFromWarnings,
                ...secretWarnings,
              ]
            }, [
              botWarnings,
              datasetWarnings,
              skillsetWarnings,
              abilityWarnings,
              triggerIntegrationWarnings,
              taskWarnings,
              slackIntegrationWarnings,
              allowFromWarnings,
              secretWarnings,
            ])

            return (
              <>
                {/* frame */}
                <Frame
                  {...rest}
                  {...props}
                  className={clsx('transition-all duration-200', {
                    'opacity-20 transition-opacity duration-200':
                      !incomingConnection.inProgress && hasSelectionButNotMe,

                    'opacity-20 transition-opacity duration-200 [--v:2]':
                      incomingConnection.inProgress && !hasVisible,
                  })}
                  type={type}
                  icon={customIcon || icon}
                  title={props.data.name || title || type}
                  tools={
                    <>
                      <WarningIcons warnings={warnings} />
                    </>
                  }
                  description={
                    props.data.description || (
                      <span className="italic">
                        {{
                          // @todo improve the descriptions
                          bot: 'An intelligent virtual assistant that can engage in conversations and perform automated tasks.',
                          dataset:
                            'A structured collection of knowledge that provides context and information during conversations.',
                          skillset:
                            'A curated group of specialized abilities that enables automation and enhanced functionality.',
                          ability:
                            'A specialized skill or function that can be performed by a bot.',
                          secret:
                            'A hidden piece of information that is used to authenticate or secure a connection.',
                          file: 'A document or data file that can be used for various purposes.',
                          // @todo add more descriptions
                        }[type] || `A ${type} without description.`}
                      </span>
                    )
                  }
                />
                {/* the configurator for the resource */}
                {!loading && !hasMultiSelection && props.selected && (
                  <Configurator
                    id={props.id}
                    type={props.type}
                    data={props.data}
                    schema={schema}
                    title={props.data.name || title || type}
                  />
                )}
                {/* top handles */}
                <div className="absolute top-0 left-0 w-full px-8 flex flex-row items-center justify-evenly">
                  {topTargetElements}
                  {topSourceElements}
                </div>
                {/* bottom handles */}
                <div className="absolute bottom-0 right-0 w-full px-8 flex flex-row items-center justify-evenly">
                  {bottomTargetElements}
                  {bottomSourceElements}
                </div>
                {/* left handles */}
                <div className="absolute top-0 left-0 h-full py-2 flex flex-col items-center justify-evenly">
                  {leftTargetElements}
                  {leftSourceElements}
                </div>
                {/* right handles */}
                <div className="absolute bottom-0 right-0 h-full py-2 flex flex-col items-center justify-evenly">
                  {rightTargetElements}
                  {rightSourceElements}
                </div>
              </>
            )
          }

          /**
           * The component dimension.
           */
          Component.dimensions = {
            width: width || DEFAULT_BASEBOX_WIDTH,
            height: height || DEFAULT_BASEBOX_HEIGHT,
          }

          /**
           * The final component mapped to the type.
           */
          return [type, Component]
        }
      )
    ),

    // annotations

    note: NoteNode,
    image: ImageNode,
    frame: FrameNode,

    // tools

    'tool:filePreview': FilePreviewToolNode,
    'tool:spaceFileBrowser': SpaceFileBrowserToolNode,
    'tool:spaceSkillBrowser': SpaceSkillBrowserNode,
    'tool:botStats': BotStatsToolNode,
    'tool:extractChart': ExtractChartToolNode,
    'tool:blueprintBulletinBrowser': BlueprintBulletinBrowserToolNode,
    'tool:errorLog': ErrorLogToolNode,
    'tool:taskMonitor': TaskMonitorToolNode,
    'tool:backstory': BackstoryToolNode,
  }
}

// --- Graph Defaults ---

/**
 *
 */
export const edgeTypes = {
  default: DefaultEdge,
}

/**
 *
 */
export const proOptions = {
  hideAttribution: true,
}

/**
 *
 */
export const defaultEdgeOptions = {
  animated: true,
  type: connectionLineType,
}

// --- Toolbar Components ---

/**
 *
 */
export function ResourceItem({
  className,

  type,

  icon,

  tags: _tags,

  tooltip,

  provider: _provider,

  data,

  children,

  ...props
}) {
  const Wrapper = useMemo(() => {
    if (tooltip) {
      return TooltipButton
    } else {
      return function WrapperButton({ caption }) {
        return <>{caption}</>
      }
    }
  }, [tooltip])

  const [_, setType, __, setData] = useResourceDnD()

  const onDragStart = (event) => {
    setType(type)

    if (data) {
      setData(data)
    }

    event.dataTransfer.effectAllowed = 'move'
  }

  const onDragEnd = () => {
    setType(null)
    setData(null)
  }

  const onClick = () => {
    toast('Drag and drop this resource onto the canvas to add it.')
  }

  const tags = useMemo(() => {
    return [
      ...(_tags || []),
      // @note disabled because items are grouped by provider already
      // ...(provider ? [provider] : [])
    ]
  }, [_tags])

  return (
    <Wrapper
      placement="right-end"
      allowedPlacements={['right']}
      delay={{
        open: 1000,
        close: 0,
      }}
      restMs={150}
      offset={20}
      caption={
        <div
          {...props}
          className={clsx(
            'item',
            'w-full',
            'p-1',
            'flex flex-row items-center gap-2',
            'text-xs',
            'border auto-border-gray-200 rounded',
            'auto-bg-gray-50 hover:auto-bg-gray-50',
            'cursor-grab',
            // @note helpers render translucent corners when dragging
            'translate-x-0',
            className
          )}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onClick={onClick}
          draggable
        >
          <DynamicIcon
            className="w-4 h-4 rounded-[3px] object-cover leading-[inherit]"
            icon={icon || '@lucide/puzzle'}
            fallbackIcon="@lucide/puzzle"
          />
          <div className="min-w-0 flex-1 flex flex-row gap-1 overflow-hidden">
            <div className="flex-1 text-left whitespace-nowrap truncate">
              {children}
            </div>
            {tags && (
              <>
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className={clsx('tag text-xs', 'min-w-0 max-w-full shrink')}
                  >
                    {tag}
                  </span>
                ))}
              </>
            )}
          </div>
        </div>
      }
    >
      <div className="text-left">{tooltip}</div>
    </Wrapper>
  )
}

/**
 *
 */
export function Sidebar({ className, icon, type, children, ...props }) {
  const [active, setActive] = useToolbar()

  const [toolbarExtensionElement] = useDOMQuerySelector('#toolbar-sidebar', {
    waitForElements: true,
  })

  const tooltip = getSidebarTooltip(props)

  return (
    <>
      <TooltipButton
        as="button"
        tooltip={tooltip}
        placement="right"
        allowedPlacements={['right']}
        delay={{ open: 1000, close: 0 }}
        tooltipClassName="w-64 text-left"
        className={clsx(
          'panel-icon',
          'w-full h-10 flex flex-row justify-center items-center group',
          'cursor-pointer',
          'border-l-2 border-transparent',
          {
            '!border-gray-900 dark:!border-white': active === type,
          },
          className
        )}
        aria-label={props.tooltipTitle || type}
        onClick={() => setActive(type)}
      >
        <DynamicIcon
          className={clsx(
            'w-[60%] h-[60%] opacity-50 group-hover:opacity-100 transition-all duration-300',
            {
              '!opacity-100': active === type,
            }
          )}
          icon={icon}
        />
      </TooltipButton>
      {active &&
        toolbarExtensionElement &&
        createPortal(
          <div
            className={clsx(
              'p-2 pb-10 flex flex-col gap-4 w-full h-full overflow-auto',
              { hidden: active !== type }
            )}
          >
            <Children active={active === type}>{children}</Children>
          </div>,
          toolbarExtensionElement
        )}
    </>
  )
}

/**
 *
 */
export function Group({ className, title, cols = 2, children, ...props }) {
  const childItems = ReactChildren.toArray(children).filter(Boolean)

  if (childItems.length === 0) {
    return null
  }

  return (
    <div {...props} className={clsx('flex flex-col gap-2', className)}>
      {title && <div className="text-xs font-bold">{title}</div>}
      <div
        className={clsx('grid gap-2', {
          'grid-cols-2': cols === 2,
          'grid-cols-1': cols === 1,
        })}
      >
        {childItems}
      </div>
    </div>
  )
}

/**
 *
 */
export const ToolbarContext = createContext([null, (_) => {}])

/**
 *
 */
export function ToolbarProvider({ defaultActive = 'resources', children }) {
  const [active, setActive] = useState(defaultActive)

  return (
    <ToolbarContext.Provider value={[active, setActive]}>
      {children}
    </ToolbarContext.Provider>
  )
}

/**
 *
 */
export function useToolbar() {
  return useContext(ToolbarContext)
}

const ABILITY_TEMPLATE_TOOLBAR_FACET_OPTIONS = [
  { label: 'Stable', value: 'stable' },
  { label: 'Beta', value: 'beta' },
  ...(!isProduction ? [{ label: 'Alpha', value: 'alpha' }] : []),
  { label: 'All', value: 'all' },
]

const SECRET_TOOLBAR_FACET_OPTIONS = [
  { label: 'Platform', value: 'platform' },
  { label: 'Beta', value: 'beta' },
  ...(!isProduction ? [{ label: 'Alpha', value: 'alpha' }] : []),
  { label: 'All', value: 'all' },
]

function isVisibleToolbarAbilityEntry(type, { tags } = {}) {
  if (isProduction) {
    if (tags?.includes('alpha')) {
      return false
    }
  } else if (tags?.includes('hidden')) {
    return false
  }

  return (
    !type.startsWith('pack/') &&
    !type.startsWith('mcp/') &&
    !type.startsWith('mock/')
  )
}

function isVisibleToolbarPackEntry(type, { tags } = {}) {
  if (isProduction) {
    if (tags?.includes('alpha')) {
      return false
    }
  } else if (tags?.includes('hidden')) {
    return false
  }

  return type.startsWith('pack/')
}

function isVisibleToolbarMcpEntry(type, { tags } = {}) {
  if (isProduction) {
    if (tags?.includes('alpha')) {
      return false
    }
  } else if (tags?.includes('hidden')) {
    return false
  }

  return type.startsWith('mcp/')
}

function isVisibleToolbarMockEntry(type, { tags } = {}) {
  if (isProduction) {
    if (tags?.includes('alpha')) {
      return false
    }
  } else if (tags?.includes('hidden')) {
    return false
  }

  return type.startsWith('mock/')
}

function isVisibleToolbarSecretEntry(_type, { tags } = {}) {
  if (isProduction) {
    return !tags?.includes('alpha')
  }

  return !tags?.includes('hidden')
}

function getToolbarEntryOrigin(activeTab, entry) {
  if (!entry) {
    return null
  }

  // @note only secrets tab has platform/external concept
  if (activeTab === 'secrets') {
    return entry.type?.startsWith('platform/') ? 'platform' : 'external'
  }

  return null
}

// @note default filter varies by tab type
export function getToolbarDefaultFilter(activeTab) {
  // @note abilities, packs, mcps, mocks default to stable
  if (['abilities', 'packs', 'mcps', 'mocks'].includes(activeTab)) {
    return 'stable'
  }

  // @note secrets default to platform to show core secrets first
  if (activeTab === 'secrets') {
    return 'platform'
  }

  return 'all'
}

export function getToolbarFacetEntriesForActiveTab({
  activeTab,
  allResources = {},
  abilityResources = {},
  secretResources = {},
  danglingResources = {},
}) {
  if (activeTab === 'resources') {
    return [
      ...Object.entries(basicResources),
      ...Object.entries(advancedResources),
      ...Object.entries(complianceResources),
      ...Object.entries(integrationResources),
    ].map(([type, data]) => ({
      ...data,
      type,
    }))
  }

  if (activeTab === 'abilities') {
    return Object.entries(abilityResources)
      .filter(([type, data]) => isVisibleToolbarAbilityEntry(type, data))
      .map(([type, data]) => ({
        ...data,
        type,
      }))
  }

  if (activeTab === 'packs') {
    return Object.entries(abilityResources)
      .filter(([type, data]) => isVisibleToolbarPackEntry(type, data))
      .map(([type, data]) => ({
        ...data,
        type,
      }))
  }

  if (activeTab === 'mcps') {
    return Object.entries(abilityResources)
      .filter(([type, data]) => isVisibleToolbarMcpEntry(type, data))
      .map(([type, data]) => ({
        ...data,
        type,
      }))
  }

  if (activeTab === 'mocks') {
    return Object.entries(abilityResources)
      .filter(([type, data]) => isVisibleToolbarMockEntry(type, data))
      .map(([type, data]) => ({
        ...data,
        type,
      }))
  }

  if (activeTab === 'secrets') {
    return Object.entries(secretResources)
      .filter(([type, data]) => isVisibleToolbarSecretEntry(type, data))
      .map(([type, data]) => ({
        ...data,
        type,
      }))
  }

  if (activeTab === 'dangling') {
    return getFilteredDanglingResources(danglingResources).map(
      ([type, data]) => ({
        ...(allResources[type] || {}),
        id: data.id,
        type,
      })
    )
  }

  return []
}

export function getToolbarFacetDefinitions(activeTab, entries = []) {
  if (['abilities', 'packs', 'mcps', 'mocks'].includes(activeTab)) {
    return ABILITY_TEMPLATE_TOOLBAR_FACET_OPTIONS
  }

  if (activeTab === 'secrets') {
    // @note a deployment without the platform secrets catalogue has no
    // platform-hosted secrets - drop the facet instead of offering an empty
    // filter

    const hasPlatformEntries = entries.some(
      (entry) => getToolbarEntryOrigin(activeTab, entry) === 'platform'
    )

    if (!hasPlatformEntries) {
      return SECRET_TOOLBAR_FACET_OPTIONS.filter(
        ({ value }) => value !== 'platform'
      )
    }

    return SECRET_TOOLBAR_FACET_OPTIONS
  }

  if (!['abilities', 'packs', 'mcps', 'mocks', 'secrets'].includes(activeTab)) {
    return []
  }

  return []
}

export function matchesToolbarTabFacets(entry, activeTab, filterValue = 'all') {
  if (!entry) {
    return true
  }

  // @note "all" means no filtering
  if (filterValue === 'all') {
    return true
  }

  // @note platform filter uses origin check
  if (filterValue === 'platform') {
    return getToolbarEntryOrigin(activeTab, entry) === 'platform'
  }

  // @note stable filter excludes beta/alpha tagged entries
  if (filterValue === 'stable') {
    return !entry.tags?.includes('beta') && !entry.tags?.includes('alpha')
  }

  // @note beta/alpha filter checks tags
  if (filterValue === 'beta' || filterValue === 'alpha') {
    return entry.tags?.includes(filterValue) === true
  }

  return true
}

/**
 *
 */
export function getTooltip({
  icon: _icon,

  title,
  description,

  commentary,
  setup,

  tags,

  type,

  id,
}) {
  const secretTooltipPreface =
    type === 'secret' ? getSecretTooltipPreface(id) : null

  return title && description ? (
    <div className="w-96 text-xs [&_p]:mt-2">
      <h3 className="font-semibold">{title}</h3>
      <p>{description}</p>
      {secretTooltipPreface ? <p>{secretTooltipPreface}</p> : null}
      {commentary && <Pagedown>{commentary}</Pagedown>}
      {setup && <Pagedown>{setup}</Pagedown>}
      {id || (tags && tags.length) ? (
        <div className="mt-2">
          <div className="flex flex-row flex-wrap gap-1">
            {type === 'dangling' && id && (
              <span className="tag no-dark-mode text-xs font-mono">
                &#x2116; {id}
              </span>
            )}
            {tags &&
              tags.map((tag) => (
                <span key={tag} className="tag no-dark-mode text-xs">
                  {tag}
                </span>
              ))}
          </div>
        </div>
      ) : null}
    </div>
  ) : undefined
}

export function getSecretTooltipPreface(id) {
  if (!id || typeof id !== 'string') {
    return null
  }

  if (id.startsWith('platform/')) {
    return 'This is a platform-managed secret. We manage this resource and its template configuration for you.'
  }

  if (id.endsWith('[mcp]')) {
    return 'This secret is specifically for MCP integrations and manages authentication with the MCP server.'
  }

  return null
}

export function getSidebarTooltip({ tooltipTitle, tooltipDescription }) {
  return tooltipTitle && tooltipDescription ? (
    <div className="text-xs [&_p]:mt-2">
      <h3 className="font-semibold">{tooltipTitle}</h3>
      <p>{tooltipDescription}</p>
    </div>
  ) : undefined
}

/**
 *
 */
export function ResourcesSidebar({ filter }) {
  return (
    <Sidebar
      icon="@heroicons/bolt"
      type="resources"
      tooltipTitle="Resources"
      tooltipDescription="Browse core resources, integrations, annotations, and tools you can drag onto the blueprint canvas."
    >
      {({ active }) =>
        active && (
          <>
            <Group title="Basic">
              {Object.entries(basicResources)
                .filter(filter)
                .map(
                  ([
                    type,
                    {
                      icon,

                      title,
                      description,

                      tags,

                      commentary,
                      setup,
                    },
                  ]) => (
                    <ResourceItem
                      key={type}
                      type={type}
                      icon={icon}
                      tags={tags}
                      tooltip={getTooltip({
                        icon,
                        title,
                        description,
                        commentary,
                        setup,
                        tags,
                      })}
                    >
                      {title}
                    </ResourceItem>
                  )
                )}
            </Group>
            <Group title="Advanced">
              {Object.entries(advancedResources)
                .filter(filter)
                .map(
                  ([
                    type,
                    {
                      icon,

                      title,
                      description,

                      tags,

                      commentary,
                      setup,
                    },
                  ]) => (
                    <ResourceItem
                      key={type}
                      type={type}
                      icon={icon}
                      tags={tags}
                      tooltip={getTooltip({
                        icon,
                        title,
                        description,
                        commentary,
                        setup,
                        tags,
                      })}
                    >
                      {title}
                    </ResourceItem>
                  )
                )}
            </Group>
            <Group title="Compliance">
              {Object.entries(complianceResources)
                .filter(filter)
                .map(
                  ([
                    type,
                    {
                      icon,

                      title,
                      description,

                      tags,

                      commentary,
                      setup,
                    },
                  ]) => (
                    <ResourceItem
                      key={type}
                      type={type}
                      icon={icon}
                      tags={tags}
                      tooltip={getTooltip({
                        icon,
                        title,
                        description,
                        commentary,
                        setup,
                        tags,
                      })}
                    >
                      {title}
                    </ResourceItem>
                  )
                )}
            </Group>
            <Group title="Integrations">
              {Object.entries(integrationResources)
                .filter(filter)
                .map(
                  ([
                    type,
                    {
                      icon,

                      title,
                      description,

                      tags,

                      commentary,
                      setup,
                    },
                  ]) => (
                    <ResourceItem
                      key={type}
                      type={type}
                      icon={icon}
                      tags={tags}
                      tooltip={getTooltip({
                        icon,
                        title,
                        description,
                        commentary,
                        setup,
                        tags,
                      })}
                    >
                      {title}
                    </ResourceItem>
                  )
                )}
            </Group>
            <Group title="Annotations">
              <ResourceItem type="note" icon="@lucide/notebook-pen">
                Note
              </ResourceItem>
              <ResourceItem
                type="image"
                icon="@lucide/image"
                tooltip={getTooltip({
                  icon: '@lucide/image',
                  title: 'Image',
                  description:
                    'Displays an image on the canvas. Can be used as a background. Drag to position and resize as needed.',
                })}
              >
                Image
              </ResourceItem>
              <ResourceItem
                type="frame"
                icon="@lucide/folder"
                tooltip={getTooltip({
                  icon: '@lucide/folder',
                  title: 'Frame',
                  description:
                    'Create a named visual frame to group related nodes on the canvas. Frames stay behind resources and can be resized to organize large blueprints.',
                })}
              >
                Frame
              </ResourceItem>
            </Group>
            <Group title="Tools">
              <ResourceItem
                type="tool:filePreview"
                icon="@lucide/file-text"
                tooltip={getTooltip({
                  icon: '@lucide/file-text',
                  title: 'File Preview',
                  description:
                    'Displays file content with auto-refresh. Connect to a file to preview its content.',
                })}
              >
                File Preview
              </ResourceItem>
              <ResourceItem
                type="tool:spaceFileBrowser"
                icon="@lucide/folder-open"
                tooltip={getTooltip({
                  icon: '@lucide/folder-open',
                  title: 'Space File Browser',
                  description:
                    'Browse files in a space. Connect to a space to explore its files.',
                })}
              >
                Space File Browser
              </ResourceItem>
              <ResourceItem
                type="tool:spaceSkillBrowser"
                icon="@lucide/puzzle"
                tooltip={getTooltip({
                  icon: '@lucide/puzzle',
                  title: 'Space Skill Browser',
                  description:
                    'Install and manage skills in a space. Connect to a space to browse and install skills from the catalogue.',
                })}
              >
                Space Skill Browser
              </ResourceItem>
              <ResourceItem
                type="tool:botStats"
                icon="@lucide/chart-bar"
                tooltip={getTooltip({
                  icon: '@lucide/chart-bar',
                  title: 'Bot Stats',
                  description:
                    'Shows bot statistics including conversations, messages, ratings, and sentiment. Connect to a bot to view its stats.',
                })}
              >
                Bot Stats
              </ResourceItem>
              <ResourceItem
                type="tool:extractChart"
                icon="@lucide/chart-line"
                tooltip={getTooltip({
                  icon: '@lucide/chart-line',
                  title: 'Extract Chart',
                  description:
                    'Displays the metrics chart for an Extract integration. Connect to an Extract integration to view the daily series of its collected fields.',
                })}
              >
                Extract Chart
              </ResourceItem>
              <ResourceItem
                type="tool:blueprintBulletinBrowser"
                icon="@lucide/megaphone"
                tooltip={getTooltip({
                  icon: '@lucide/megaphone',
                  title: 'Blueprint Bulletins',
                  description:
                    "Shows the bulletins agents post to this blueprint's shared board. Optionally connect to a bot to filter the board to that bot's bulletins.",
                })}
              >
                Blueprint Bulletins
              </ResourceItem>
              <ResourceItem
                type="tool:errorLog"
                icon="@lucide/triangle-alert"
                tooltip={getTooltip({
                  icon: '@lucide/triangle-alert',
                  title: 'Error Log',
                  description:
                    'Monitor errors for connected resources. Connect to bots, datasets, skillsets, or integrations to see their errors.',
                })}
              >
                Error Log
              </ResourceItem>
              <ResourceItem
                type="tool:taskMonitor"
                icon="@lucide/list-todo"
                tooltip={getTooltip({
                  icon: '@lucide/list-todo',
                  title: 'Task Monitor',
                  description:
                    'Monitor running and active tasks. Connect to a bot to see its tasks with auto-refresh.',
                })}
              >
                Task Monitor
              </ResourceItem>
              <ResourceItem
                type="tool:backstory"
                icon="@lucide/scroll-text"
                tooltip={getTooltip({
                  icon: '@lucide/scroll-text',
                  title: 'Backstory',
                  description:
                    'An editable backstory version. Connect to a bot to automatically apply this backstory. Use multiple backstory tools to manage different versions.',
                })}
              >
                Backstory
              </ResourceItem>
            </Group>
          </>
        )
      }
    </Sidebar>
  )
}

ResourcesSidebar.Memo = memo(ResourcesSidebar)

/**
 * Providers that have sub-services requiring grouping by the first two segments
 * of the ability ID (e.g., google/calendar, google/drive) rather than just the
 * provider name.
 */
const PROVIDERS_WITH_SUBSERVICES = ['google']

/**
 * Gets the group name for an ability based on provider and ID. For cbk
 * provider, groups by the first segment of the ID (e.g., shell/, file/). For
 * providers with sub-services (like google), groups by the first two segments
 * (e.g., google/calendar, google/drive). For other providers, groups by the
 * provider name.
 */
function getAbilityGroupName(type, provider) {
  if (provider === 'cbk') {
    // For cbk provider, use the first segment of the ID as the group

    const firstSlash = type.indexOf('/')

    if (firstSlash > 0) {
      return toHeadingCase(type.substring(0, firstSlash))
    }

    return 'ChatBotKit'
  }

  // For providers with sub-services, group by the first two segments

  if (PROVIDERS_WITH_SUBSERVICES.includes(provider)) {
    const firstSlash = type.indexOf('/')

    if (firstSlash > 0) {
      const secondSlash = type.indexOf('/', firstSlash + 1)

      if (secondSlash > 0) {
        // Replace slash with space for proper heading case (e.g.,
        // "google/calendar" -> "Google Calendar")

        return toHeadingCase(type.substring(0, secondSlash).replace('/', ' '))
      }
    }
  }

  // For other providers, use the provider name

  return toHeadingCase(provider || 'Other')
}

/**
 *
 */
export function AbilitiesSidebar({ filter }) {
  const { abilityResources, loading } = useResources()

  // Group abilities by provider (and by prefix for cbk provider)

  const groupedAbilities = useMemo(() => {
    const groups = {}

    Object.entries(abilityResources)
      .filter(([, { tags }]) => {
        if (isProduction) {
          return !tags?.includes('alpha')
        }

        return !tags?.includes('hidden')
      })
      .filter(
        ([type]) =>
          !type.startsWith('pack/') &&
          !type.startsWith('mcp/') &&
          !type.startsWith('mock/')
      )
      .forEach(([type, ability]) => {
        const groupName = getAbilityGroupName(type, ability.provider)

        if (!groups[groupName]) {
          groups[groupName] = {
            isCbk: ability.provider === 'cbk',
            abilities: [],
          }
        }

        groups[groupName].abilities.push([type, ability])
      })

    // Sort groups alphabetically, with cbk-related groups first

    return Object.entries(groups)
      .sort(([nameA, groupA], [nameB, groupB]) => {
        // ChatBotKit groups (from cbk provider) come first

        if (groupA.isCbk && !groupB.isCbk) {
          return -1
        }

        if (!groupA.isCbk && groupB.isCbk) {
          return 1
        }

        return nameA.localeCompare(nameB)
      })
      .map(([name, { abilities }]) => ({
        name,
        abilities,
      }))
  }, [abilityResources])

  return (
    <Sidebar
      icon="@heroicons/sparkles"
      type="abilities"
      tooltipTitle="Abilities"
      tooltipDescription="Browse reusable abilities and actions, grouped by provider, to extend what your blueprint can do."
    >
      {({ active }) =>
        active &&
        !loading && (
          <>
            {groupedAbilities.map(({ name, abilities }) => {
              // @note filter is applied per-render to support dynamic search functionality
              const filteredAbilities = abilities.filter(filter)

              if (filteredAbilities.length === 0) {
                return null
              }

              return (
                <Group key={name} title={name} cols={1}>
                  {filteredAbilities.map(
                    ([
                      type,
                      {
                        icon,

                        title,
                        description,

                        tags,

                        provider,

                        commentary,
                        setup,
                      },
                    ]) => (
                      <ResourceItem
                        key={type}
                        type={type}
                        icon={icon}
                        tags={tags}
                        provider={provider}
                        tooltip={getTooltip({
                          icon,
                          title,
                          description,
                          commentary,
                          setup,
                          tags,
                          type,
                        })}
                      >
                        {title}
                      </ResourceItem>
                    )
                  )}
                </Group>
              )
            })}
          </>
        )
      }
    </Sidebar>
  )
}

AbilitiesSidebar.Memo = memo(AbilitiesSidebar)

/**
 *
 */
export function PacksSidebar({ filter }) {
  const { abilityResources, loading } = useResources()

  return (
    <Sidebar
      icon="@heroicons/inbox-stack"
      type="packs"
      tooltipTitle="Packs"
      tooltipDescription="Open packaged groups of abilities and templates that can be added to the blueprint together."
    >
      {({ active }) =>
        active &&
        !loading && (
          <>
            <Group title="Packs" cols={1}>
              {Object.entries(abilityResources)
                .filter(([, { tags }]) => {
                  if (isProduction) {
                    return !tags?.includes('alpha')
                  }

                  return !tags?.includes('hidden')
                })
                .filter(([type]) => type.startsWith('pack/'))
                .filter(filter)
                .map(
                  ([
                    type,
                    {
                      icon,

                      title,
                      description,

                      tags,

                      commentary,
                      setup,
                    },
                  ]) => (
                    <ResourceItem
                      key={type}
                      type={type}
                      icon={icon}
                      tags={tags}
                      tooltip={getTooltip({
                        icon,
                        title,
                        description,
                        commentary,
                        setup,
                        tags,
                      })}
                    >
                      {title}
                    </ResourceItem>
                  )
                )}
            </Group>
          </>
        )
      }
    </Sidebar>
  )
}

PacksSidebar.Memo = memo(PacksSidebar)

/**
 *
 */
export function McpsSidebar({ filter }) {
  const { abilityResources, loading } = useResources()

  return (
    <Sidebar
      icon={McpIcon}
      type="mcps"
      tooltipTitle="MCPs"
      tooltipDescription="Browse Model Context Protocol resources and connectors available for the current blueprint."
    >
      {({ active }) =>
        active &&
        !loading && (
          <>
            <Group title="MCPs" cols={1}>
              {Object.entries(abilityResources)
                .filter(([, { tags }]) => {
                  if (isProduction) {
                    return !tags?.includes('alpha')
                  }

                  return !tags?.includes('hidden')
                })
                .filter(([type]) => type.startsWith('mcp/'))
                .filter(filter)
                .map(
                  ([
                    type,
                    {
                      icon,

                      title,
                      description,

                      tags,

                      commentary,
                      setup,
                    },
                  ]) => (
                    <ResourceItem
                      key={type}
                      type={type}
                      icon={icon}
                      tags={tags}
                      tooltip={getTooltip({
                        icon,
                        title,
                        description,
                        commentary,
                        setup,
                        tags,
                      })}
                    >
                      {title}
                    </ResourceItem>
                  )
                )}
            </Group>
          </>
        )
      }
    </Sidebar>
  )
}

McpsSidebar.Memo = memo(McpsSidebar)

/**
 *
 */
export function MocksSidebar({ filter }) {
  const { abilityResources, loading } = useResources()

  return (
    <Sidebar
      icon="@heroicons/beaker"
      type="mocks"
      tooltipTitle="Mocks"
      tooltipDescription="Use mock resources to prototype flows and test blueprint behavior without live integrations."
    >
      {({ active }) =>
        active &&
        !loading && (
          <>
            <Group title="Mocks" cols={1}>
              {Object.entries(abilityResources)
                .filter(([, { tags }]) => {
                  if (isProduction) {
                    return !tags?.includes('alpha')
                  }

                  return !tags?.includes('hidden')
                })
                .filter(([type]) => type.startsWith('mock/'))
                .filter(filter)
                .map(
                  ([
                    type,
                    {
                      icon,

                      title,
                      description,

                      tags,

                      commentary,
                      setup,
                    },
                  ]) => (
                    <ResourceItem
                      key={type}
                      type={type}
                      icon={icon}
                      tags={tags}
                      tooltip={getTooltip({
                        icon,
                        title,
                        description,
                        commentary,
                        setup,
                        tags,
                      })}
                    >
                      {title}
                    </ResourceItem>
                  )
                )}
            </Group>
          </>
        )
      }
    </Sidebar>
  )
}

MocksSidebar.Memo = memo(MocksSidebar)

/**
 *
 */
export function SecretsSidebar({ filter }) {
  const { secretResources, loading } = useResources()

  return (
    <Sidebar
      icon="@heroicons/lock-closed"
      type="secrets"
      tooltipTitle="Secrets"
      tooltipDescription="Manage secret references and credentials used by abilities, integrations, and other resources."
    >
      {({ active }) =>
        active &&
        !loading && (
          <>
            <Group title="Secrets" cols={1}>
              {Object.entries(secretResources)
                .filter(([, { tags }]) => {
                  if (isProduction) {
                    return !tags?.includes('alpha')
                  }

                  return !tags?.includes('hidden')
                })
                .filter(filter)
                .map(
                  ([
                    type,
                    {
                      icon,

                      title,
                      description,

                      tags,

                      commentary,
                      setup,
                    },
                  ]) => (
                    <ResourceItem
                      key={type}
                      type={type}
                      icon={icon}
                      tags={tags}
                      tooltip={getTooltip({
                        icon,
                        title,
                        description,
                        commentary,
                        setup,
                        tags,
                        // make tooltip work
                        type: 'secret',
                        id: type,
                      })}
                    >
                      {title}
                    </ResourceItem>
                  )
                )}
            </Group>
          </>
        )
      }
    </Sidebar>
  )
}

SecretsSidebar.Memo = memo(SecretsSidebar)

/**
 *
 */
export function ExamplesSidebar({ examples, search }) {
  return (
    <Sidebar
      icon="@heroicons/rectangle-stack"
      type="examples"
      tooltipTitle="Examples"
      tooltipDescription="Insert from curated blueprint examples to accelerate setup and explore working patterns."
    >
      {({ active }) =>
        active && (
          <>
            <Group title="Examples" cols={1}>
              {examples
                .filter((example) => {
                  if (!search) {
                    return true
                  }

                  const term = search.toLowerCase()

                  return (
                    example.title.toLowerCase().includes(term) ||
                    example.description.toLowerCase().includes(term) ||
                    (example.keywords &&
                      example.keywords.some((kw) =>
                        kw.toLowerCase().includes(term)
                      ))
                  )
                })
                .map((example) => (
                  <ResourceItem
                    key={example.slug}
                    type="example"
                    icon={example.icon || '@heroicons/rectangle-stack'}
                    data={example}
                    tooltip={getTooltip({
                      icon: example.icon || '@heroicons/rectangle-stack',
                      title: example.title,
                      description: example.description,
                      tags: example.keywords,
                    })}
                  >
                    {example.title}
                  </ResourceItem>
                ))}
            </Group>
          </>
        )
      }
    </Sidebar>
  )
}

ExamplesSidebar.Memo = memo(ExamplesSidebar)

/**
 *
 */
export function DanglingSidebar({ resources, filter }) {
  const { allResources } = useResources()

  const filteredResources = getFilteredDanglingResources(resources, filter)

  return (
    <Sidebar
      icon="@heroicons/cube"
      type="dangling"
      tooltipTitle="Dangling"
      tooltipDescription="Find resources that exist in the blueprint data but are not currently connected into the main graph."
    >
      {({ active }) =>
        active && (
          <>
            <Group title="Dangling" cols={1}>
              {filteredResources.length === 0 ? (
                <div className="text-xs text-gray-500 p-2">
                  No dangling resources available
                </div>
              ) : (
                filteredResources.map(([type, data]) => (
                  <ResourceItem
                    key={data.id}
                    type={type}
                    icon={allResources[type]?.icon}
                    data={data}
                    tooltip={getTooltip({
                      icon: allResources[type]?.icon,
                      title: data.name,
                      description: data.description,
                      commentary: allResources[type]?.commentary,
                      setup: allResources[type]?.setup,
                      // @note helps with the tooltip
                      type: 'dangling',
                      id: data.id,
                    })}
                  >
                    {data.name || data.id}
                  </ResourceItem>
                ))
              )}
            </Group>
          </>
        )
      }
    </Sidebar>
  )
}

DanglingSidebar.Memo = memo(DanglingSidebar)

/**
 *
 */
export function TemplatesSidebar({ search }) {
  const [templateSecrets, setTemplateSecrets] = useState([])

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTemplateSecrets = async () => {
      try {
        const client = createClient({
          endpoint: new URL('/api/v1/graphql', window.location.origin).href,
        })

        const data = await client.templateSecrets()

        const secrets =
          data?.relatedSecrets?.edges?.map((edge) => edge.node) || []

        setTemplateSecrets(secrets)
      } finally {
        setLoading(false)
      }
    }

    fetchTemplateSecrets()
  }, [])

  const filteredSecrets = useMemo(() => {
    if (!search) {
      return templateSecrets
    }

    const searchLower = search.toLowerCase()

    return templateSecrets.filter((secret) => {
      return (
        secret.name?.toLowerCase().includes(searchLower) ||
        secret.description?.toLowerCase().includes(searchLower)
      )
    })
  }, [templateSecrets, search])

  return (
    <Sidebar
      icon="@heroicons/bookmark"
      type="templates"
      tooltipTitle="Templates"
      tooltipDescription="Browse template secrets and starter values that can be dropped into the blueprint as reusable references."
    >
      {({ active }) =>
        active && (
          <>
            <Group title="Template Secrets" cols={1}>
              {loading ? (
                <div className="text-xs text-gray-500 p-2">Loading...</div>
              ) : filteredSecrets.length === 0 ? (
                <div className="text-xs text-gray-500 p-2">
                  {search
                    ? 'No matching templates found'
                    : 'No template secrets available'}
                </div>
              ) : (
                filteredSecrets.map(({ id, ...secret }) => (
                  <ResourceItem
                    key={secret.id}
                    type="secret"
                    icon={nameToIcon(secret.name) || '@heroicons/key'}
                    data={{
                      ...secret,

                      kind: 'personal', // @note template secrets are always personal

                      type: 'reference',

                      config: {
                        secretId: id,
                      },
                    }}
                    tooltip={getTooltip({
                      icon: '@heroicons/key',
                      title: secret.name,
                      description: secret.description,
                    })}
                  >
                    {secret.name}
                  </ResourceItem>
                ))
              )}
            </Group>
          </>
        )
      }
    </Sidebar>
  )
}

TemplatesSidebar.Memo = memo(TemplatesSidebar)

/**
 *
 */
export function EventsSidebar({ blueprint }) {
  return (
    <Sidebar
      icon="@heroicons/calendar"
      type="events"
      tooltipTitle="Events"
      tooltipDescription="Inspect recent blueprint-related events and activity without leaving the designer."
    >
      <Group title="Events" cols={1}>
        <EventLog
          className="[&_*]:!text-xs"
          eventTypes={VISIBLE_EVENT_TYPES}
          autoLoad={true}
          contextFilters={{ blueprintId: blueprint.id }}
          filter={false}
          export={false}
        />
      </Group>
    </Sidebar>
  )
}

EventsSidebar.Memo = memo(EventsSidebar)

/**
 *
 */
export function AssistantSidebar({ blueprint }) {
  return (
    <Sidebar
      icon={WidgetIcon}
      type="assistant"
      tooltipTitle="Assistant"
      tooltipDescription="Open the blueprint assistant to inspect, edit, and validate the blueprint with guided help."
    >
      <Assistant.Memo key="assistant" blueprintId={blueprint.id} />
    </Sidebar>
  )
}

AssistantSidebar.Memo = memo(AssistantSidebar)

/**
 *
 */
export function Toolbar({
  className,

  blueprint,

  examples,

  danglingResources,

  children,
}) {
  const [active] = useToolbar()

  const { allResources, abilityResources, secretResources } = useResources()

  const [facetsByTab, setFacetsByTab] = useState({})

  // @note useDebouncedInput uses uncontrolled input pattern to avoid React
  // re-renders on every keystroke. Only updates state after 300ms delay.

  const { value: search, inputProps: searchInputProps } = useDebouncedInput({
    delay: 300,
  })

  // @note convert allResources object to array format for fuzzy search

  const allResourceEntries = useMemo(() => {
    return Object.entries(allResources).map(([type, data]) => ({
      ...data,
      type,
    }))
  }, [allResources])

  // @note useDeferredValue allows React to defer updating the fuzzy search

  // results during rapid typing, keeping the input responsive. Debouncing is
  // already handled in handleSearchChange.

  const deferredSearch = useDeferredValue(search)

  const fuzzyResults = useFuzzySearch(allResourceEntries, deferredSearch, {
    keys: useMemo(
      () => ['type', 'title', 'name', 'provider', 'tags', 'keywords'],
      []
    ),
    threshold: 0.1, // @note lower works better for filtering
    debounce: 0, // @note debounce is handled in handleSearchChange
    limit: 100, // @note limit results for performance - we only need unique types
  })

  const matchedTypes = useMemo(() => {
    if (!deferredSearch?.trim()) {
      return null
    }

    return new Set(fuzzyResults.map((r) => r.type))
  }, [deferredSearch, fuzzyResults])

  const activeFacetEntries = useMemo(() => {
    return getToolbarFacetEntriesForActiveTab({
      activeTab: active,
      allResources,
      abilityResources,
      secretResources,
      danglingResources,
    })
  }, [
    active,
    allResources,
    abilityResources,
    secretResources,
    danglingResources,
  ])

  const activeFacetDefinitions = useMemo(() => {
    return getToolbarFacetDefinitions(active, activeFacetEntries)
  }, [active, activeFacetEntries])

  // @note current filter value for this tab, defaults based on tab type
  const activeFilter = useMemo(() => {
    return facetsByTab[active]?.filter || getToolbarDefaultFilter(active)
  }, [active, facetsByTab])

  const activeFacetEntryMap = useMemo(() => {
    return new Map(activeFacetEntries.map((entry) => [entry.type, entry]))
  }, [activeFacetEntries])

  const setActiveFilter = useCallback(
    (value) => {
      setFacetsByTab((current) => ({
        ...current,
        [active]: {
          ...(current[active] || {}),
          filter: value,
        },
      }))
    },
    [active]
  )

  // @note count how many entries match the current filter (for fallback)
  const filteredEntryCount = useMemo(() => {
    return activeFacetEntries.filter((entry) =>
      matchesToolbarTabFacets(entry, active, activeFilter)
    ).length
  }, [activeFacetEntries, active, activeFilter])

  // @note count how many entries match filter AND search (for search fallback)
  const searchFilteredCount = useMemo(() => {
    if (!matchedTypes) {
      return filteredEntryCount
    }

    return activeFacetEntries.filter(
      (entry) =>
        matchedTypes.has(entry.type) &&
        matchesToolbarTabFacets(entry, active, activeFilter)
    ).length
  }, [
    activeFacetEntries,
    active,
    activeFilter,
    matchedTypes,
    filteredEntryCount,
  ])

  // @note if filter yields no results (with or without search), fall back to all
  const effectiveFilter =
    filteredEntryCount > 0 && searchFilteredCount > 0 ? activeFilter : 'all'

  const filter = useCallback(
    ([type]) => {
      const entry = activeFacetEntryMap.get(type) || {
        ...(allResources[type] || {}),
        type,
      }

      // @note apply search filter first
      if (matchedTypes && !matchedTypes.has(type)) {
        return false
      }

      // @note then apply facet filter
      return matchesToolbarTabFacets(entry, active, effectiveFilter)
    },
    [active, activeFacetEntryMap, effectiveFilter, allResources, matchedTypes]
  )

  return (
    <div
      className={clsx(
        'toolbar',
        'w-12',
        'auto-bg-gray-50',
        'flex flex-col flex-shrink-0',
        'select-none',
        className
      )}
    >
      <div className="flex flex-col justify-center gap-1">
        <button
          className="w-full h-10 flex flex-row justify-center items-center auto-text-gray-700 hover:auto-text-gray-900 transition-colors duration-200"
          type="button"
          aria-label="Exit designer"
          onClick={() => {
            // @note using window.location to ensure the official dashboard is
            // loaded which may contain state for the widget
            window.location = `/blueprints/${blueprint.id}`
          }}
        >
          <ArrowLeftIcon className="w-[60%] h-[60%]" />
        </button>
        <ResourcesSidebar.Memo filter={filter} />
        <AbilitiesSidebar.Memo filter={filter} />
        <PacksSidebar.Memo filter={filter} />
        <McpsSidebar.Memo filter={filter} />
        <MocksSidebar.Memo filter={filter} />
        <SecretsSidebar.Memo filter={filter} />
        <ExamplesSidebar.Memo examples={examples} search={deferredSearch} />
        <DanglingSidebar.Memo resources={danglingResources} filter={filter} />
        <TemplatesSidebar.Memo search={deferredSearch} />
        {/* <EventsSidebar.Memo blueprint={blueprint} /> */}
        {/* <AssistantSidebar.Memo blueprint={blueprint} /> */}
      </div>
      <SideWidget
        className="left-11 auto-bg-gray-50 z-20"
        expandedClassName="border-l border-r auto-border-gray-200"
        side="left"
        pinned={true}
        stateSaveKey="designer.toolbar.sidebar"
        actions={
          <div className="!default-input tiny text-xs w-full flex flex-row items-center overflow-hidden">
            <input
              {...searchInputProps}
              className="none-input text-xs flex-1 min-w-0"
              type="text"
              placeholder="Search..."
              spellCheck={false}
            />
            {activeFacetDefinitions.length > 0 ? (
              <div className="flex items-center gap-0.5 -mr-0.5">
                {activeFacetDefinitions.map((option) => {
                  const isActive = effectiveFilter === option.value

                  return (
                    <button
                      key={option.value}
                      className={clsx(
                        'px-1 text-[9px] font-medium rounded transition-colors',
                        isActive
                          ? 'bg-black text-white dark:bg-white dark:text-black'
                          : 'auto-text-gray-500 hover:auto-text-gray-700'
                      )}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setActiveFilter(option.value)}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>
        }
      >
        {({ isExpanded, animationCompleted }) => {
          return (
            <div
              className="flex flex-col w-full h-full transition-opacity duration-300"
              style={{ opacity: animationCompleted ? 1 : 0 }}
            >
              <div
                className={clsx('flex-1 flex flex-col w-full h-full', {
                  hidden: !isExpanded,
                })}
              >
                <div
                  id="toolbar-sidebar"
                  className="flex-1 flex flex-col w-full h-full"
                />
                {children}
              </div>
            </div>
          )
        }}
      </SideWidget>
    </div>
  )
}

// --- Assistant ---

/**
 * Serialize blueprint nodes to a YAML text representation.
 * Converts the graph state into a readable/writable document format that the
 * AI assistant can read and modify, similar to working with a file.
 *
 * @param {Array} nodes - React Flow nodes
 * @param {Record<string, any>} allResources - All resource definitions
 * @returns {string} YAML text representation of the blueprint
 */
export function serializeBlueprintToText(nodes, _allResources) {
  const resources = {}
  const annotations = {}
  const tools = {}

  for (const node of nodes) {
    if (isToolNodeType(node.type)) {
      tools[node.id] = {
        type: node.type,
        data: node.data || {},
        position: node.position,
        width: node.width,
        height: node.height,
      }
    } else if (isAnnotationNodeType(node.type)) {
      annotations[node.id] = {
        type: node.type,
        data: node.data || {},
        position: node.position,
        width: node.width,
        height: node.height,
      }
    } else {
      resources[node.id] = {
        type: node.type,
        data: node.data || {},
      }
    }
  }

  return stringifyYaml({
    resources,
    ...(Object.keys(annotations).length ? { annotations } : {}),
    ...(Object.keys(tools).length ? { tools } : {}),
  })
}

/**
 * Apply dagre auto-layout to a set of nodes using their edges for ordering.
 * Mutates node positions in-place and returns the laid-out nodes.
 *
 * @param {Array} nodes - React Flow nodes to lay out
 * @param {Array} edges - React Flow edges defining the graph structure
 * @param {string} [direction='TB'] - Layout direction ('TB' or 'LR')
 * @returns {Array} The same nodes array with updated positions
 */
function layoutNodes(nodes, edges, direction = 'LR') {
  const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))

  dagreGraph.setGraph({ rankdir: direction, nodesep: 20, ranksep: 60 })

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: node.width || DEFAULT_BASEBOX_WIDTH,
      height: node.height || DEFAULT_BASEBOX_HEIGHT,
    })
  })

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target)
  })

  dagre.layout(dagreGraph)

  nodes.forEach((node) => {
    const position = dagreGraph.node(node.id)

    node.position = {
      x: position.x - (node.width || DEFAULT_BASEBOX_WIDTH) / 2,
      y: position.y - (node.height || DEFAULT_BASEBOX_HEIGHT) / 2,
    }
  })

  return nodes
}

/**
 * Map of resource type to its Zod blueprint schema for validation.
 */
export const blueprintSchemasByType = {
  bot: BotType,
  dataset: DatasetType,
  skillset: SkillsetType,
  ability: AbilityType,
  secret: SecretType,
  file: FileType,
  portal: PortalType,
  space: SpaceType,
  widgetIntegration: WidgetIntegrationType,
  slackIntegration: SlackIntegrationType,
  githubIntegration: GithubIntegrationType,
  discordIntegration: DiscordIntegrationType,
  whatsappIntegration: WhatsappIntegrationType,
  messengerIntegration: MessengerIntegrationType,
  telegramIntegration: TelegramIntegrationType,
  instagramIntegration: InstagramIntegrationType,
  googlechatIntegration: GooglechatIntegrationType,
  microsoftteamsIntegration: MicrosoftteamsIntegrationType,
  emailIntegration: EmailIntegrationType,
  twilioIntegration: TwilioIntegrationType,
  anamIntegration: AnamIntegrationType,
  avatarIntegration: AvatarIntegrationType,
  recallIntegration: RecallIntegrationType,
  sitemapIntegration: SitemapIntegrationType,
  notionIntegration: NotionIntegrationType,
  extractIntegration: ExtractIntegrationType,
  triggerIntegration: TriggerIntegrationType,
  supportIntegration: supportIntegrationType,
  mcpserverIntegration: McpserverIntegrationType,
  skillserverIntegration: SkillserverIntegrationType,
}

/**
 * Validate resource data against its blueprint schema.
 *
 * @param {string} type - The resource type
 * @param {object} data - The resource data
 * @returns {{ valid: boolean, errors?: string[] }}
 */
export function validateResourceData(type, data) {
  const schema = blueprintSchemasByType[type]

  if (!schema) {
    return { valid: true }
  }

  const result = schema.strict().safeParse(data)

  if (result.success) {
    return { valid: true }
  }

  const errors = result.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : type

    return `${path}: ${issue.message}`
  })

  return { valid: false, errors }
}

/**
 * Apply a YAML text blueprint to the graph, creating/updating/removing nodes
 * and edges as needed. This is a full reconciliation - nodes in the text
 * replace the current graph state for resource nodes.
 *
 * @param {string} text - YAML blueprint text
 * @param {Function} getNodes - React Flow getNodes
 * @param {Function} setNodes - React Flow setNodes
 * @param {Function} addNodes - React Flow addNodes
 * @param {Function} setEdges - React Flow setEdges
 * @param {Function} addEdges - React Flow addEdges
 * @param {Record<string, any>} allResources - All resource definitions
 * @param {Record<string, any>} nodeTypes - Node type dimensions
 * @throws {Error} if the text is invalid or missing required fields
 */
export function applyBlueprintFromText(
  text,
  {
    getNodes,
    setNodes,
    _addNodes,
    setEdges,
    _addEdges,
    allResources,
    nodeTypes,
  }
) {
  const parsed = tryParseYaml(text)

  if (!parsed || !parsed.resources) {
    throw new Error(
      'Invalid blueprint format. Expected YAML with a "resources" key containing resource entries.'
    )
  }

  const { resources, annotations = {}, tools = {} } = parsed

  // @note validate all resource data against their schemas before applying
  const validationErrors = []

  for (const [id, { type, data }] of Object.entries(resources)) {
    if (!type) {
      validationErrors.push(`${id}: missing resource type`)

      continue
    }

    if (data) {
      const { valid, errors } = validateResourceData(type, data)

      if (!valid) {
        validationErrors.push(...errors.map((e) => `${id} (${type}): ${e}`))
      }
    }
  }

  const currentNodes = getNodes()

  // @note separate resource nodes from non-resource nodes (annotations, tools)
  const currentNonResourceNodes = currentNodes.filter((n) =>
    isNonResourceNodeType(n.type)
  )
  const currentResourceIds = new Set(
    currentNodes.filter((n) => !isNonResourceNodeType(n.type)).map((n) => n.id)
  )

  // @note reconcile annotation and tool nodes from the incoming YAML
  // Existing nodes not mentioned in the YAML are preserved unchanged
  const incomingNonResourceEntries = [
    ...Object.entries(annotations).map(([id, n]) => [id, n]),
    ...Object.entries(tools).map(([id, n]) => [id, n]),
  ]

  const nonResourceNodes = currentNonResourceNodes.map((node) => {
    const incoming = annotations[node.id] || tools[node.id]

    if (incoming) {
      return {
        ...node,
        type: incoming.type || node.type,
        data: { ...node.data, ...incoming.data },
        ...(incoming.width != null ? { width: incoming.width } : {}),
        ...(incoming.height != null ? { height: incoming.height } : {}),
        ...(incoming.position != null ? { position: incoming.position } : {}),
      }
    }

    return node
  })

  const currentNonResourceIds = new Set(
    currentNonResourceNodes.map((n) => n.id)
  )

  for (const [id, incoming] of incomingNonResourceEntries) {
    if (!currentNonResourceIds.has(id)) {
      nonResourceNodes.push({
        id,
        type: incoming.type,
        data: incoming.data || {},
        position: incoming.position || { x: 0, y: 0 },
        width: incoming.width || DEFAULT_BASEBOX_WIDTH,
        height: incoming.height || DEFAULT_BASEBOX_HEIGHT,
        selected: false,
      })
    }
  }

  const incomingIds = new Set(Object.keys(resources))

  // @note nodes to remove (in current but not in incoming)
  const removedIds = new Set(
    [...currentResourceIds].filter((id) => !incomingIds.has(id))
  )

  // @note nodes to update (in both current and incoming)
  const updatedNodes = []
  // @note nodes to create (in incoming but not in current)
  const newNodes = []

  for (const [id, { type, data }] of Object.entries(resources)) {
    const existingNode = currentNodes.find((n) => n.id === id)

    if (existingNode) {
      updatedNodes.push({
        ...existingNode,
        type: type || existingNode.type,
        data: { ...existingNode.data, ...data },
      })
    } else {
      const nodeWidth =
        nodeTypes[type]?.dimensions?.width || DEFAULT_BASEBOX_WIDTH
      const nodeHeight =
        nodeTypes[type]?.dimensions?.height || DEFAULT_BASEBOX_HEIGHT

      newNodes.push({
        id,
        type,
        data: { ...(allResources[type]?.data || {}), ...data },
        width: nodeWidth,
        height: nodeHeight,
        position: { x: 0, y: 0 },
        selected: false,
      })
    }
  }

  // @note new abilities must be connected to a skillset to be usable by a bot
  const unlinkedAbilities = newNodes.filter(
    (n) => n.type === 'ability' && !n.data.skillsetId
  )

  if (unlinkedAbilities.length > 0) {
    const names = unlinkedAbilities.map((n) => n.data.name || n.id).join(', ')

    validationErrors.push(
      `The following abilities are not linked to any skillset: ${names}. Connect each ability to a skillset so that a bot can use it.`
    )
  }

  // @note new secrets must be referenced by at least one resource to be useful
  const newSecretIds = new Set(
    newNodes.filter((n) => n.type === 'secret').map((n) => n.id)
  )

  if (newSecretIds.size > 0) {
    const referencedSecretIds = new Set()

    for (const [, { data }] of Object.entries(resources)) {
      if (!data) {
        continue
      }

      if (data.linkedSecretId && typeof data.linkedSecretId === 'string') {
        referencedSecretIds.add(data.linkedSecretId)
      }

      if (data.instruction) {
        try {
          const { parameters } = parseTemplateInstruction(data.instruction)

          for (const [key, value] of Object.entries(parameters)) {
            if (key === 'secretId' && value && typeof value === 'string') {
              referencedSecretIds.add(value)
            }
          }
        } catch {
          // @note ignore instruction parsing errors
        }
      }
    }

    const unlinkedSecrets = newNodes.filter(
      (n) => n.type === 'secret' && !referencedSecretIds.has(n.id)
    )

    if (unlinkedSecrets.length > 0) {
      const names = unlinkedSecrets.map((n) => n.data.name || n.id).join(', ')

      validationErrors.push(
        `The following secrets are not linked to any ability: ${names}. Connect each secret to an ability so that it can be used for authentication.`
      )
    }
  }

  // @note throw all collected validation errors at once
  if (validationErrors.length > 0) {
    throw new Error(
      `Blueprint validation failed:\n${validationErrors.join('\n')}`
    )
  }

  // @note rebuild all edges from *Id connection fields in the incoming resources
  const newEdges = []

  for (const [id, { data }] of Object.entries(resources)) {
    if (!data) {
      continue
    }

    for (const [key, value] of Object.entries(data)) {
      if (key.endsWith('Id') && value && typeof value === 'string') {
        newEdges.push({
          id: getRandomId('#edge:::'),
          source: id,
          sourceHandle: key,
          target: value,
          targetHandle: getReferenceFieldType(key),
          type: 'default',
        })
      }
    }

    // @note handle ability instruction parameter edges
    if (data.instruction) {
      try {
        const { parameters } = parseTemplateInstruction(data.instruction)

        for (const [key, value] of Object.entries(parameters)) {
          if (
            value &&
            typeof value === 'string' &&
            isDynamicResourceField(key)
          ) {
            newEdges.push({
              id: getRandomId('#edge:::'),
              source: id,
              sourceHandle: createInstructionParamHandle(key),
              target: value,
              targetHandle: getReferenceFieldType(key),
              type: 'default',
            })
          }
        }
      } catch {
        // @note ignore instruction parsing errors
      }
    }
  }

  // @note filter edges to only valid node references
  const validNewEdges = newEdges.filter(
    (e) =>
      incomingIds.has(e.source) &&
      (incomingIds.has(e.target) ||
        nonResourceNodes.some((n) => n.id === e.target))
  )

  // @note auto-layout new nodes using dagre so they are organized
  if (newNodes.length > 0) {
    const allResultNodes = [...updatedNodes, ...newNodes]

    layoutNodes(allResultNodes, validNewEdges)
  }

  // @note apply changes: keep non-resource nodes, update existing, add new
  setNodes([...nonResourceNodes, ...updatedNodes, ...newNodes])

  // @note keep edges for non-resource nodes, replace resource edges
  setEdges((edges) => {
    const nonResourceEdges = edges.filter(
      (e) =>
        !currentResourceIds.has(e.source) && !currentResourceIds.has(e.target)
    )

    return [...nonResourceEdges, ...validNewEdges]
  })

  const created = newNodes.length
  const updated = updatedNodes.length
  const removed = removedIds.size

  if (created || updated || removed) {
    const parts = []

    if (created) {
      parts.push(`${created} created`)
    }

    if (updated) {
      parts.push(`${updated} updated`)
    }

    if (removed) {
      parts.push(`${removed} removed`)
    }

    toast.success(`Blueprint updated: ${parts.join(', ')}`)
  }

  return {
    success: true,
    created,
    updated,
    removed,
    totalNodes: Object.keys(resources).length,
    annotationCount: Object.keys(annotations).length,
    toolCount: Object.keys(tools).length,
  }
}

/**
 * Lint all resource nodes in the blueprint using the shared warning functions.
 *
 * @param {Array} nodes - React Flow nodes
 * @returns {Array<{nodeId: string, type: string, name: string, warnings: Array<{description: string, type: 'suggestion' | 'warning'}>}>}
 */
function lintBlueprintNodes(
  nodes,
  { abilityResources, secretResources, edges = [] } = {}
) {
  const results = []

  for (const node of nodes) {
    // @note skip non-resource nodes (annotations, tools)
    if (isNonResourceNodeType(node.type)) {
      continue
    }

    const data = node.data || {}
    const getWarnings = warningFunctionsByType[node.type]
    const warnings = getWarnings
      ? node.type === 'ability'
        ? getWarnings(data, abilityResources)
        : node.type === 'secret'
          ? getWarnings(data, secretResources, {
              connections: edges.filter((edge) => edge.target === node.id),
            })
          : getWarnings(data)
      : []

    if (warnings.length > 0) {
      results.push({
        nodeId: node.id,
        type: node.type,
        name: data.name || '(unnamed)',
        warnings,
      })
    }
  }

  return results
}

/**
 * @param {Array<{nodeId: string, type: string, name: string, warnings: Array<{description: string, type: 'suggestion' | 'warning'}>}>} results
 */
export function summarizeBlueprintLintResults(results) {
  const nodes = [...results]
    .sort((left, right) => {
      const leftHasWarning = left.warnings.some(
        (warning) => normalizeWarning(warning).type === 'warning'
      )
      const rightHasWarning = right.warnings.some(
        (warning) => normalizeWarning(warning).type === 'warning'
      )

      return Number(rightHasWarning) - Number(leftHasWarning)
    })
    .map((result) => ({
      nodeId: result.nodeId,
      nodeType: result.type,
      nodeName: result.name,
      warnings: result.warnings.map((warning) => normalizeWarning(warning)),
    }))

  const items = nodes.flatMap((node) =>
    node.warnings.map((warning) => ({
      ...warning,
      nodeId: node.nodeId,
      nodeType: node.nodeType,
      nodeName: node.nodeName,
    }))
  )

  const warningCount = items.filter((item) => item.type === 'warning').length
  const suggestionCount = items.filter(
    (item) => item.type === 'suggestion'
  ).length

  return {
    nodeCount: nodes.length,
    totalCount: items.length,
    warningCount,
    suggestionCount,
    hasWarnings: warningCount > 0,
    items,
    nodes,
  }
}

/**
 * Blueprint designer assistant. Operates on the blueprint as a whole document
 * using read/write methods, with platform search tools for discovery.
 */
export function Assistant({ blueprintId }) {
  const { getNodes, getEdges, setNodes, setEdges, addNodes, addEdges } =
    useReactFlow()

  const { allResources, abilityResources, secretResources, nodeTypes } =
    useResources()

  const { fetch: apiFetch } = useFetch()

  // @note track currently selected nodes for the assistant to query

  const [selectedNodes, setSelectedNodes] = useState([])

  useOnSelectionChange({
    onChange: useCallback(({ nodes }) => {
      setSelectedNodes(nodes)
    }, []),
  })

  // @note create fuzzy search function for resources

  const allResourceEntries = useMemo(() => {
    return Object.entries(allResources).map(([type, data]) => ({
      ...data,
      type,
    }))
  }, [allResources])

  const fuzzySearchResources = useFuzzySearchFunction(allResourceEntries, {
    keys: useMemo(
      () => [
        'type',
        'title',
        'name',
        'description',
        'provider',
        'tags',
        'keywords',
      ],
      []
    ),
    threshold: 0.4,
  })

  const functions = useFunctionPacks([
    // @note blueprint document read/write tools
    {
      id: 'blueprint-document',
      description:
        'Read and write the entire blueprint as a YAML document. The blueprint is a collection of connected resources (bots, datasets, skillsets, abilities, secrets, integrations, etc.).',
      functions: {
        readBlueprint: {
          description:
            'Read the entire blueprint as a YAML document. Returns the full blueprint text with all resource nodes, their types, and data properties. Use this to understand the current state before making changes.',
          parameters: {
            type: 'object',
            properties: {},
          },
          handler: async () => {
            const nodes = getNodes()
            const text = serializeBlueprintToText(nodes, allResources)

            return {
              success: true,
              text,
              nodeCount: nodes.filter((n) => !isNonResourceNodeType(n.type))
                .length,
              annotationCount: nodes.filter((n) => isAnnotationNodeType(n.type))
                .length,
              toolCount: nodes.filter((n) => isToolNodeType(n.type)).length,
            }
          },
        },
        writeBlueprint: {
          description:
            'Write (apply) a YAML blueprint document to the graph. This replaces all resource nodes with the content you provide. Nodes in the YAML that match existing IDs are updated; new IDs are created; nodes not in the YAML are removed. Non-resource nodes (annotations, tools) are preserved unless they appear in the optional "annotations" or "tools" YAML sections - in that case they are merged/created. New node IDs must start with # (e.g., "#my-bot"). Connection fields ending in Id (e.g., skillsetId, datasetId) automatically create visual edges between nodes.',
          parameters: {
            type: 'object',
            properties: {
              text: {
                type: 'string',
                description:
                  'The full YAML blueprint document. Format: resources: { nodeId: { type: "bot", data: { name: "...", ... } } }. Optionally include annotations: { nodeId: { type: "note"|"image"|"frame", data: {...}, position: {x,y}, width, height } } and tools: { nodeId: { type: "tool:...", data: {...}, position: {x,y}, width, height } }.',
              },
            },
            required: ['text'],
          },
          handler: async ({ text }) => {
            return applyBlueprintFromText(text, {
              getNodes,
              setNodes,
              addNodes,
              setEdges,
              addEdges,
              allResources,
              nodeTypes,
            })
          },
        },
      },
    },

    // @note selection and notification tools
    {
      id: 'graph-interaction',
      description:
        'Tools for interacting with the blueprint canvas selection and user notifications.',
      functions: {
        getSelectedNodes: {
          description:
            'Get the currently selected node(s) in the blueprint canvas. Returns their IDs, types, names, and full data.',
          parameters: {
            type: 'object',
            properties: {},
          },
          handler: async () => {
            return {
              selectedNodes: selectedNodes.map((node) => ({
                id: node.id,
                type: node.type,
                name: node.data?.name || 'Unnamed',
                data: node.data,
              })),
              count: selectedNodes.length,
            }
          },
        },
        showNotification: {
          description: 'Show a toast notification to the user.',
          parameters: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'The notification message to display',
              },
              type: {
                type: 'string',
                description: 'Notification type',
                enum: ['success', 'error', 'info'],
              },
            },
            required: ['message'],
          },
          handler: async ({ message, type = 'info' }) => {
            switch (type) {
              case 'success':
                toast.success(message)

                break
              case 'error':
                toast.error(message)

                break
              default:
                toast(message)
            }

            return { success: true }
          },
        },
      },
    },

    // @note blueprint linting tool
    {
      id: 'blueprint-lint',
      description:
        'Lint the blueprint to find warnings and issues across all resource nodes.',
      functions: {
        lint: {
          description:
            'Lint all resource nodes in the blueprint and return warnings. Use this after making changes to verify the blueprint is complete and well-configured. Returns per-node warnings for missing fields and misconfigurations.',
          parameters: {
            type: 'object',
            properties: {},
          },
          handler: async () => {
            const nodes = getNodes()
            const edges = getEdges()

            const results = lintBlueprintNodes(nodes, {
              abilityResources,
              secretResources,
              edges,
            })

            return {
              results,

              totalNodes: nodes.filter((n) => !isNonResourceNodeType(n.type))
                .length,

              nodesWithWarnings: results.length,

              totalWarnings: results.reduce(
                (sum, r) => sum + r.warnings.length,
                0
              ),
            }
          },
        },
      },
    },

    // @note generic fetch tool (like dashboard assistant)
    {
      id: 'platform-api',
      description:
        'Generic HTTP fetch for platform API calls. Use this to search ability templates, examples, manuals, and more.',
      functions: {
        fetch: {
          description: 'Perform an HTTP request to the platform API.',
          parameters: {
            type: 'object',
            properties: {
              method: {
                type: 'string',
                description: 'The HTTP method to use',
                enum: ['GET', 'POST'],
              },
              url: {
                type: 'string',
                description: 'The URL to fetch',
              },
              data: {
                type: 'object',
                description:
                  'The data to send in the request body (for POST requests)',
              },
            },
            required: ['url'],
          },
          handler: async ({ method, url, data }) => {
            // @note ensure we use relative URLs to stay within the platform
            // and include auth cookies

            const u = new URL(url, window.location.origin)

            // @note translate the deployment api host urls to local /api

            if (u.hostname === getExternalAPIHost()) {
              const localOrigin = new URL(window.location.origin)

              u.protocol = localOrigin.protocol
              u.host = localOrigin.host
              u.pathname = u.pathname.startsWith('/api/')
                ? u.pathname
                : `/api${u.pathname}`
            }

            // @note only allow same-origin requests for security

            if (u.origin !== window.location.origin) {
              return {
                error: 'Only same-origin URLs are allowed',
              }
            }

            const { error, data: responseData } = await apiFetch(u.href, {
              method,
              data,
            })

            return { error, data: responseData }
          },
        },
        searchResources: {
          description:
            'Search for available resource types and templates using fuzzy search. Returns matching resource/template metadata including type identifiers, descriptions, and setup instructions.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description:
                  'Search query to match against resource types, titles, descriptions, tags',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results (default: 10, max: 30)',
              },
            },
            required: ['query'],
          },
          handler: async ({ query, limit = 10 }) => {
            const effectiveLimit = Math.min(limit, 30)
            const results = fuzzySearchResources(query)

            return {
              resources: results.slice(0, effectiveLimit).map((r) => ({
                type: r.type,
                title: r.title,
                description: r.description,
                tags: r.tags,
                provider: r.provider,
                commentary: r.commentary,
                setup: r.setup,
              })),
              total: results.length,
            }
          },
        },
      },
    },
  ])

  useWidgetInstanceFunctions(
    {
      selector: '#assistant-widget',
      functions: functions,
    },
    [
      getNodes,
      getEdges,
      setNodes,
      setEdges,
      addNodes,
      addEdges,
      selectedNodes,
      allResources,
      nodeTypes,
      fuzzySearchResources,
      apiFetch,
    ]
  )

  useWebMCP(functions)

  return (
    <>
      <WidgetScript />
      <chatbotkit-widget
        id="assistant-widget"
        class="w-full h-full rounded-xl border auto-border-gray-200 dark:invert"
        widget={`/auto/widget/frame?type=blueprint-assistant&instance=${blueprintId}`}
      />
    </>
  )
}

Assistant.Memo = memo(Assistant)

// --- Buttons ---

/**
 *
 */
function CommandPaletteHint() {
  const isWideEnough = useMediaQuery('(min-width: 768px)')

  const [visible, setVisible] = useState(true)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    if (!isWideEnough) {
      return undefined
    }

    const fadeTimer = setTimeout(() => setFading(true), 4000)
    const hideTimer = setTimeout(() => setVisible(false), 5000)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(hideTimer)
    }
  }, [isWideEnough])

  const isMac =
    typeof navigator !== 'undefined' && navigator.platform.match('Mac')

  if (!isWideEnough || !visible) {
    return null
  }

  return (
    <span
      className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap transition-opacity duration-1000"
      style={{ opacity: fading ? 0 : 1 }}
    >
      <kbd className="font-mono">{isMac ? '⌘' : 'Ctrl'}+K</kbd> to open command
      palette
    </span>
  )
}

/**
 *
 */
export function TestButton() {
  const { open } = useSuperTools()

  const { build, hasChanges, loading } = useBlueprint()

  const confirm = useConfirm()

  const handleClick = useCallback(async () => {
    if (hasChanges) {
      const confirmed = await confirm(
        'You have unsaved changes. Would you like to build before testing?'
      )

      if (confirmed) {
        await build()
      }
    }

    open()
  }, [hasChanges, confirm, build, open])

  return (
    <div className="flex flex-row items-center gap-2">
      <CommandPaletteHint />
      <button
        className="default-button push h-8 text-sm"
        type="button"
        onClick={handleClick}
        disabled={loading}
      >
        Test
      </button>
    </div>
  )
}

function BlueprintIssuesList({ summary, onSelectNode }) {
  if (!summary.totalCount) {
    return (
      <p className="text-sm italic auto-text-gray-500">
        No warnings or best-practice suggestions right now.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <span className="tag text-xs">nodes: {summary.nodeCount}</span>
        <span className="tag text-xs">total: {summary.totalCount}</span>
        <span className="tag text-xs">warnings: {summary.warningCount}</span>
        <span className="tag text-xs">
          best practices: {summary.suggestionCount}
        </span>
      </div>

      <div className="max-h-80 overflow-y-auto divide-y auto-divide-gray-100">
        {summary.nodes.map((node) => (
          <div key={node.nodeId} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium auto-text-gray-900">
                {node.nodeName}
              </span>
              <span className="tag text-xs">{node.nodeType}</span>
              <span className="text-xs auto-text-gray-400">{node.nodeId}</span>
            </div>

            <ul className="space-y-2">
              {node.warnings.map((warning, index) => (
                <li key={`${node.nodeId}-${index}`} className="text-sm">
                  <button
                    type="button"
                    className="w-full flex items-start gap-2 text-left rounded-lg px-2 py-1.5 hover:auto-bg-gray-100 transition-colors"
                    onClick={() => onSelectNode?.(node.nodeId)}
                  >
                    <ExclamationTriangleIcon
                      className={clsx(
                        'h-4 w-4 mt-0.5 shrink-0',
                        getWarningIconClassName(warning.type)
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="tag text-xs">{warning.type}</span>
                      </div>
                      <p className="auto-text-gray-600">
                        {warning.description}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

export function BlueprintIssuesButton() {
  const { nodes, edges, setNodes } = useBlueprint()
  const { abilityResources, secretResources } = useResources()
  const { fitView } = useReactFlow()

  const { popup, openPopup, closePopup } = usePopup({
    title: 'Blueprint Issues',
    description:
      'Warnings and best-practice suggestions across the current blueprint.',
    cancelButtonCaption: 'Close',
  })

  const summary = useMemo(() => {
    const results = lintBlueprintNodes(nodes, {
      abilityResources,
      secretResources,
      edges,
    })

    return summarizeBlueprintLintResults(results)
  }, [nodes, edges, abilityResources, secretResources])

  const handleSelectNode = useCallback(
    (nodeId) => {
      setNodes((nodes) =>
        nodes.map((node) => ({ ...node, selected: node.id === nodeId }))
      )

      fitView({
        nodes: [{ id: nodeId }],
        duration: 300,
        padding: 0.35,
        maxZoom: 1.2,
      })

      closePopup()
    },
    [setNodes, fitView, closePopup]
  )

  const handleClick = useCallback(() => {
    openPopup(
      <BlueprintIssuesList summary={summary} onSelectNode={handleSelectNode} />,
      {
        noActions: true,
      }
    )
  }, [openPopup, summary, handleSelectNode])

  return (
    <>
      <GlobalRootPortal>{popup}</GlobalRootPortal>
      <div className="relative group/tooltip">
        <button
          className="default-button push h-8 text-sm relative overflow-visible"
          type="button"
          onClick={handleClick}
          aria-label="Blueprint issues"
        >
          Issues
          {summary.totalCount ? (
            <span
              className={clsx(
                'absolute -top-1 -right-1 h-3 w-3 rounded-full',
                summary.hasWarnings ? 'bg-red-500' : 'bg-yellow-500'
              )}
            />
          ) : null}
        </button>
        <div className="tooltip -bottom-3 w-44">
          {summary.totalCount ? 'View blueprint issues' : 'No blueprint issues'}
        </div>
      </div>
    </>
  )
}

/**
 *
 */
export function BuildButton() {
  const { build, hasChanges, loading } = useBlueprint()

  return (
    <>
      <div className="flex flex-row gap-2">
        <button
          className="primary-button push h-8 text-sm"
          type="button"
          onClick={() => build()}
          disabled={!hasChanges || loading}
        >
          Build
        </button>
      </div>
    </>
  )
}

/**
 *
 */
export function RenameButton() {
  const { popup, openPopup, closePopup } = usePopup({
    title: 'Rename Blueprint',
  })

  const { name, updateName } = useBlueprint()

  return (
    <>
      {popup}
      <div className="flex flex-row gap-2">
        <button
          // @note without size-8 it does not work in safari
          className="default-button push size-8 text-sm aspect-square rounded-full p-0"
          type="button"
          onClick={() => {
            openPopup(
              <div>
                <input
                  className="default-input w-full"
                  name="name"
                  type="text"
                  defaultValue={name}
                  placeholder="New Blueprint Name"
                />
              </div>,
              {
                actions: {
                  Save: {
                    default: true,
                    fn: ({ name }) => {
                      updateName(name)

                      closePopup()
                    },
                  },
                },
              }
            )
          }}
        >
          <EllipsisHorizontalIcon className="size-[60%]" />
        </button>
      </div>
    </>
  )
}

// --- Canvas and Graph ---

/**
 *
 */
export function Canvas({
  panOnScroll,
  zoomOnScroll,

  controls,

  className,

  children,

  disabled,

  ...props
}) {
  const { allResources, nodeTypes } = useResources()

  const router = useRouter()

  const hideControls = router.query?.hideControls === 'true'
  const minZoom = parseFloat(router.query?.minZoom) || 0.2
  const maxZoom = parseFloat(router.query?.maxZoom) || 2

  const { theme } = useTheme()

  const [colorMode, setColorMode] = useState()

  useEffect(() => {
    setColorMode(theme === 'dark' ? 'dark' : 'light')
  }, [theme])

  const {
    nodes,
    setNodes,
    onNodesChange,

    edges,
    setEdges,
    onEdgesChange,

    importBlueprint,

    download,

    undo,
    redo,
    canUndo,
    canRedo,

    autoLayout,

    onNodeDragStart,
    onNodeDragStop,

    suppressEdgeSyncRef,
  } = useBlueprint()

  const {
    screenToFlowPosition,
    getNodes,
    getEdges,
    getNode,
    fitView,
    updateNode,
  } = useReactFlow()

  // @note useNodesInitialized returns true once all nodes have been measured.
  // We use this to trigger fitView after nodes are ready, since the fitView prop
  // on ReactFlow may fire before nodes have their dimensions calculated.

  const nodesInitialized = useNodesInitialized()
  const hasFittedView = useRef(false)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (nodesInitialized && !hasFittedView.current) {
      hasFittedView.current = true

      // @note allow the fit to zoom out past the interactive minZoom so the
      // entire blueprint - including notes/frames/images placed away from the
      // core graph - is framed instead of being clipped at the edges
      fitView({
        padding: 0.1,
        duration: 0,
        minZoom: Math.min(minZoom, FIT_VIEW_MIN_ZOOM),
      })

      // @note delay showing canvas until fitView animation completes
      setTimeout(() => setIsReady(true), 50)
    }
  }, [nodesInitialized, fitView, minZoom])

  const isValidConnection = useCallback(
    (conn) => {
      const sourceHandle = isInstructionParamHandle(conn.sourceHandle)
        ? getParamNameFromHandle(conn.sourceHandle)
        : conn.sourceHandle

      const sourceNodeType = getNode(conn.source)?.type
      const targetNodeType = getNode(conn.target)?.type
      const validErrorLogConnection = isValidErrorLogToolConnection({
        sourceHandle,
        sourceNodeType,
        targetHandle: conn.targetHandle,
        targetNodeType,
      })

      if (validErrorLogConnection != null) {
        return validErrorLogConnection
      }

      // @note skillsetForAbility only accepts connections from abilities
      if (conn.targetHandle === 'skillsetForAbility') {
        return sourceHandle === 'skillsetId' && sourceNodeType === 'ability'
      }

      // @note the main skillset target rejects connections from abilities
      // (they should use skillsetForAbility instead)
      if (conn.targetHandle === 'skillset' && sourceHandle === 'skillsetId') {
        return sourceNodeType !== 'ability'
      }

      // @note when dragging from target handles, conn.sourceHandle is the
      // target and conn.targetHandle is what we're connecting to
      if (conn.sourceHandle === 'skillsetForAbility') {
        return (
          conn.targetHandle === 'skillsetId' && targetNodeType === 'ability'
        )
      }

      if (
        conn.sourceHandle === 'skillset' &&
        conn.targetHandle === 'skillsetId'
      ) {
        const targetNodeType = getNode(conn.target)?.type

        return targetNodeType !== 'ability'
      }

      return isReferenceFieldFor(sourceHandle, conn.targetHandle)
    },
    [getNode]
  )

  const onConnect = useCallback(
    (edge) => {
      const normalizedEdge = normalizeErrorLogToolConnectionEdge(edge, getNode)

      // @note Manual connections add the edge before handle-level callbacks
      // persist source node data. Suppress sync briefly and persist the source
      // data here so edge sync does not see a transient dangling edge.
      suppressEdgeSyncRef.current = true

      updateNode(normalizedEdge.source, (node) =>
        applyConnectionEdgeToNode(node, normalizedEdge)
      )

      setEdges((edges) =>
        addEdge({ ...normalizedEdge, type: 'default' }, edges)
      )

      requestAnimationFrame(() => {
        suppressEdgeSyncRef.current = false
      })
    },
    [getNode, setEdges, updateNode]
  )

  // @note double-clicking a node selects the entire bot constellation it
  // belongs to: the ancestor bot, all datasets and skillsets connected from
  // that bot, and all abilities connected to those skillsets. This lets users
  // quickly grab a whole bot group regardless of which node they double-click.
  const onNodeDoubleClick = useCallback(
    (event, clickedNode) => {
      // @note ignore double-clicks that originate inside editable elements so
      // that normal text selection inside configurator inputs is not disrupted
      const tag = event?.target?.tagName?.toLowerCase()

      if (
        tag === 'input' ||
        tag === 'textarea' ||
        event?.target?.isContentEditable
      ) {
        return
      }

      // @note popups/menus are rendered through a portal into #global-root, but
      // React synthetic events bubble through the React tree (not the DOM tree),
      // so a double-click inside such a popup still reaches this node handler.
      // Ignore those: otherwise double-clicking inside the ability tester (or any
      // configurator popup) selects the whole canvas constellation, which swaps
      // the active configurator and unmounts the popup's owner - closing it.
      if (event?.target?.closest?.('#global-root, [role="dialog"]')) {
        return
      }

      const allNodes = getNodes()
      const allEdges = getEdges()

      const nodeMap = new Map(allNodes.map((n) => [n.id, n]))

      // Resolve the ancestor bot for the clicked node.
      // Graph edges: bot->dataset, bot->skillset, ability->skillset
      let botNode = null

      if (clickedNode.type === 'bot') {
        botNode = clickedNode
      } else if (
        clickedNode.type === 'dataset' ||
        clickedNode.type === 'skillset'
      ) {
        // The bot has an outgoing edge pointing to this dataset/skillset
        const botEdge = allEdges.find(
          (e) =>
            e.target === clickedNode.id && nodeMap.get(e.source)?.type === 'bot'
        )

        if (botEdge) {
          botNode = nodeMap.get(botEdge.source)
        }
      } else if (clickedNode.type === 'ability') {
        // Ability points to a skillset; follow that to the owning bot
        const skillsetEdge = allEdges.find(
          (e) =>
            e.source === clickedNode.id &&
            nodeMap.get(e.target)?.type === 'skillset'
        )

        if (skillsetEdge) {
          const botEdge = allEdges.find(
            (e) =>
              e.target === skillsetEdge.target &&
              nodeMap.get(e.source)?.type === 'bot'
          )

          if (botEdge) {
            botNode = nodeMap.get(botEdge.source)
          }
        }
      }

      // Fall back to selecting only the clicked node when no bot group is found
      if (!botNode) {
        setNodes((nodes) =>
          nodes.map((node) => ({
            ...node,
            selected: node.id === clickedNode.id,
          }))
        )

        return
      }

      // Collect the full bot constellation:
      // bot + all datasets/skillsets it points to + abilities of those skillsets
      const groupIds = new Set([botNode.id])
      const skillsetIds = new Set()

      for (const edge of allEdges) {
        if (edge.source === botNode.id) {
          const target = nodeMap.get(edge.target)

          if (target?.type === 'dataset' || target?.type === 'skillset') {
            groupIds.add(edge.target)

            if (target.type === 'skillset') {
              skillsetIds.add(edge.target)
            }
          }
        }
      }

      for (const edge of allEdges) {
        if (
          skillsetIds.has(edge.target) &&
          nodeMap.get(edge.source)?.type === 'ability'
        ) {
          groupIds.add(edge.source)
        }
      }

      setNodes((nodes) =>
        nodes.map((node) => ({
          ...node,
          selected: groupIds.has(node.id),
        }))
      )
    },
    [getNodes, getEdges, setNodes]
  )

  const buildResourceNode = useCallback(
    (type, data, position) => {
      const { id = getRandomId(`#${type}:::`), ...rest } = data || {}

      return {
        id: id,

        type: allResources[type]?.type || type,
        icon: allResources[type]?.icon,

        position: position,

        data: {
          ...allResources[type]?.data,
          ...rest,
        },

        width: nodeTypes[type]?.dimensions?.width || DEFAULT_BASEBOX_WIDTH,
        height: nodeTypes[type]?.dimensions?.height || DEFAULT_BASEBOX_HEIGHT,

        // @note frames render behind other annotations, other annotations behind resources
        ...(type === 'frame'
          ? {
              zIndex: -2,
              // @note wrapper is pass-through; only border strips inside FrameNode capture clicks
              style: { pointerEvents: 'none' },
            }
          : isAnnotationNodeType(type)
            ? { zIndex: -1 }
            : {}),
      }
    },
    [allResources, nodeTypes]
  )

  const [dndResourceType, _, dndResourceData] = useResourceDnD()

  const onDragOver = useCallback(
    (event) => {
      event.preventDefault()

      if (!dndResourceType) {
        return
      }

      if (nodeTypes[dndResourceType] === undefined) {
        return
      }

      event.dataTransfer.dropEffect = 'move'
    },
    [dndResourceType, nodeTypes]
  )

  const onDrop = useCallback(
    (event) => {
      event.preventDefault()

      if (!dndResourceType) {
        return
      }

      // @note snap position to grid to prevent visual jump when node is clicked
      const position = snapPositionToGrid(
        screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        })
      )

      if (dndResourceType === 'example') {
        importBlueprint(stringifyYaml(dndResourceData.blueprint), {
          relativePosition: position,
        })

        return
      }

      if (nodeTypes[dndResourceType] === undefined) {
        return
      }

      // Build the main resource node.

      const mainResourceNode = buildResourceNode(
        dndResourceType,
        dndResourceData,
        position
      )

      // @note Suppress edge sync during auto-connect to prevent race
      // conditions. When we add edges AND update node data, these are separate
      // state updates. If edge sync runs between them, it can see stale data
      // and incorrectly remove/recreate edges, causing onConnect/onDisconnect
      // to fire in a loop.
      suppressEdgeSyncRef.current = true

      setNodes((nodes) => nodes.concat(mainResourceNode))

      // Each resource can have pre-defined connections to other resources and
      // this is where we are handling of this in a generic way.

      for (const connectedType of [
        'dataset',
        'skillset',
        'secret',
        // 'bot', // @note disabled for now
        // 'file', // @note disabled for now
        // 'space' // @note disabled for now
      ]) {
        const connectedConfig = allResources[dndResourceType]?.[connectedType]

        // @note the main resource's own reference field for this type - an
        // ability links through `linkedSecretId`, everything else through
        // `${type}Id`

        const connectedField =
          Object.keys(allResources[dndResourceType]?.schema || {}).find(
            (field) => isReferenceFieldFor(field, connectedType)
          ) || `${connectedType}Id`

        if (connectedConfig) {
          // Check if a resource of the same type, name and description already
          // exist before creating a new one.

          const existingResource = getNodes().find(
            ({ type, data }) =>
              type === connectedType &&
              data.name === connectedConfig.name &&
              data.description === connectedConfig.description
          )

          let connectedResourceNode

          if (existingResource) {
            connectedResourceNode = existingResource
          } else {
            connectedResourceNode = buildResourceNode(
              connectedType,
              connectedConfig,
              {
                x:
                  mainResourceNode.position.x + mainResourceNode.width / 2 + 10,
                y: mainResourceNode.position.y + mainResourceNode.height * 1.5,
              }
            )

            setNodes((nodes) => nodes.concat(connectedResourceNode))
          }

          // Create an edge between the main resource node and the connected
          // resource node.

          setEdges((edges) =>
            edges.concat({
              id: getRandomId(`#edge:::`),
              source: mainResourceNode.id,
              sourceHandle: connectedField,
              target: connectedResourceNode.id,
              targetHandle: connectedType,
              type: 'default',
            })
          )

          // Extend the main resource node with the connected resource node id.

          setNodes((nodes) =>
            nodes.map((node) => {
              if (node.id === mainResourceNode.id) {
                return {
                  ...node,

                  data: {
                    ...node.data,

                    [connectedField]: connectedResourceNode.id,
                  },
                }
              }

              return node
            })
          )
        }
      }

      // @note Apply auto-connections using the extracted pure function

      const { nodeUpdates, edgesToCreate } = computeAutoConnections({
        newNode: mainResourceNode,
        existingNodes: getNodes(),
        existingEdges: getEdges(),
        resourceType: dndResourceType,
        allResources,
      })

      // Apply node updates
      for (const update of nodeUpdates) {
        if (update.isNewNode) {
          // @note Use setNodes instead of updateNode because mainResourceNode
          // was just added and isn't in the store yet.
          setNodes((nodes) =>
            nodes.map((node) =>
              node.id === update.nodeId
                ? {
                    ...node,
                    data: { ...node.data, [update.field]: update.value },
                  }
                : node
            )
          )
        } else {
          // @note Use updateNode for existing nodes that are already in the store.
          updateNode(update.nodeId, (node) => ({
            ...node,
            data: { ...node.data, [update.field]: update.value },
          }))
        }
      }

      // Create edges
      for (const edge of edgesToCreate) {
        setEdges((edges) => edges.concat(edge))
      }

      // @note Re-enable edge sync after React has processed the state updates.
      // Using requestAnimationFrame ensures this runs after the render cycle.
      requestAnimationFrame(() => {
        suppressEdgeSyncRef.current = false
      })
    },
    [
      dndResourceType,
      dndResourceData,
      screenToFlowPosition,
      setNodes,
      setEdges,
      updateNode,
      getNodes,
      getEdges,
      importBlueprint,
      allResources,
      nodeTypes,
      buildResourceNode,
      suppressEdgeSyncRef,
    ]
  )

  const [snapToGrid, setSnapToGrid] = useState(true)

  const {
    getRootProps,
    getInputProps,

    // @todo maybe use to show a different ui
    // isDragActive,
    // isDragReject,
  } = useDropzone({
    noClick: true,
    noKeyboard: true,
    noDragEventsBubbling: true,

    onDropAccepted: async (acceptedFiles, event) => {
      for (const file of acceptedFiles) {
        // @todo also check if it is an actual importable file

        // @note snap position to grid to prevent visual jump when node is clicked
        const position = snapPositionToGrid(
          screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          })
        )

        if (isJsonFile(file) || isYamlFile(file)) {
          const text = await file.text()

          importBlueprint(text, { relativePosition: position })
        } else {
          const mainResourceNode = buildResourceNode(
            'file',
            {
              name: file.name,
            },
            position
          )

          fileMap[mainResourceNode.id] = file

          setNodes((nodes) => nodes.concat(mainResourceNode))
        }
      }
    },

    disabled,
  })

  const [minimap, setMinimap] = useState(false)

  return (
    <div
      {...props}
      {...getRootProps()}
      className={className}
      style={{
        opacity: isReady ? 1 : 0,
        transition: 'opacity 150ms ease-in',
      }}
    >
      <input {...getInputProps()} />
      {nodes.length === 0 && isReady ? (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="text-gray-400 dark:text-gray-600 text-lg font-medium select-none">
            Drag and drop resources from the left sidebar to start building
          </div>
        </div>
      ) : null}
      <ReactFlow
        // options
        proOptions={proOptions}
        defaultEdgeOptions={defaultEdgeOptions}
        // types
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        // nodes
        nodes={nodes}
        onNodesChange={onNodesChange}
        // edges
        edges={edges}
        onEdgesChange={onEdgesChange}
        // connection
        connectionLineStyle={connectionLineStyle}
        connectionLineType={connectionLineType}
        connectionRadius={200} // @note allows edges to snap to handles when mouse is near them
        // connect
        isValidConnection={isValidConnection}
        onConnect={!disabled ? onConnect : undefined}
        // drag
        onDragOver={!disabled ? onDragOver : undefined}
        onDrop={!disabled ? onDrop : undefined}
        // node drag (for undo/redo position changes)
        onNodeDragStart={!disabled ? onNodeDragStart : undefined}
        onNodeDragStop={!disabled ? onNodeDragStop : undefined}
        // node double click (chain selection)
        onNodeDoubleClick={onNodeDoubleClick}
        // theme
        colorMode={colorMode}
        // snap
        snapToGrid={snapToGrid}
        // effect
        elevateEdgesOnSelect={true}
        elevateNodesOnSelect={true}
        // zoom
        panOnScroll={panOnScroll}
        zoomOnScroll={zoomOnScroll}
        // theming
        style={
          colorMode === 'light'
            ? {
                // light theme
                '--xy-edge-stroke-default': 'var(--color-gray-500)',
                '--xy-edge-stroke-selected-default': 'var(--color-pink-500)',
                '--xy-controls-button-background-color-default':
                  'var(--color-gray-100)',
                '--xy-controls-button-background-color-hover-default':
                  'var(--color-gray-200)',
                '--xy-controls-button-border-color-default':
                  'var(--color-gray-50)',
                '--xy-minimap-background-color-default':
                  'var(--color-gray-100)',
                '--xy-background-color-default': 'var(--color-gray-50)',
                '--xy-background-pattern-dots-color-default':
                  'var(--color-gray-400)',
                // @todo customize the minimap further
              }
            : {
                // dark theme
                '--xy-edge-stroke-default': 'var(--color-gray-500)',
                '--xy-edge-stroke-selected-default': 'var(--color-pink-500)',
                '--xy-controls-button-background-color-default':
                  'var(--color-gray-900)',
                '--xy-controls-button-background-color-hover-default':
                  'var(--color-gray-800)',
                '--xy-controls-button-border-color-default':
                  'var(--color-gray-950)',
                '--xy-minimap-background-color-default':
                  'var(--color-gray-900)',
                '--xy-background-color-default': 'var(--color-gray-950)',
                '--xy-background-pattern-dots-color-default':
                  'var(--color-gray-800)',
                // @todo customize the minimap further
              }
        }
        // zoom
        minZoom={minZoom}
        maxZoom={maxZoom}
      >
        <Background />
        {controls && !hideControls ? (
          <Controls showInteractive={false} position="bottom-right">
            {!disabled && (
              <>
                <ControlButton
                  onClick={undo}
                  disabled={!canUndo}
                  title="Undo (Ctrl/⌘+Z)"
                  style={{ opacity: canUndo ? 1 : 0.5 }}
                >
                  <RxReset style={{ fill: 'currentColor' }} />
                </ControlButton>
                <ControlButton
                  onClick={redo}
                  disabled={!canRedo}
                  title="Redo (Ctrl/⌘+Shift+Z)"
                  style={{ opacity: canRedo ? 1 : 0.5 }}
                >
                  <RxReset
                    style={{ fill: 'currentColor', transform: 'scaleX(-1)' }}
                  />
                </ControlButton>
              </>
            )}
            <ControlButton onClick={() => setSnapToGrid((grid) => !grid)}>
              {snapToGrid ? <RxGrid /> : <RxGroup />}
            </ControlButton>
            <ControlButton onClick={autoLayout} title="Auto-Layout">
              <RxLayout />
            </ControlButton>
            <ControlButton onClick={() => download()}>
              <RxDownload />
            </ControlButton>
            <ControlButton onClick={() => setMinimap((m) => !m)}>
              <RxMargin />
            </ControlButton>
          </Controls>
        ) : null}
        {minimap ? (
          <MiniMap
            className="!right-11"
            position="bottom-right"
            pannable={true}
            zoomable={true}
          />
        ) : null}
      </ReactFlow>
      {children}
    </div>
  )
}

// --- Configurator Panel ---

/**
 *
 */
export function Configurator() {
  const { mode } = useSchemaPanelMode()

  const isDocked = mode === 'docked'

  // @note directly offset the ProfileBar element when docked, so the profile
  //   icon and buttons don't overlap the configurator panel
  useEffect(() => {
    const el = document.querySelector('.profile-bar')

    if (!el) {
      return
    }

    if (isDocked) {
      el.style.right = '24rem' // matches w-96
    } else {
      el.style.right = ''
    }

    return () => {
      el.style.right = ''
    }
  }, [isDocked])

  return (
    <div
      id="configurator-area"
      className={clsx(
        isDocked && 'w-96 flex-shrink-0 h-full overflow-y-auto',
        isDocked && 'border-l border-gray-200 dark:border-gray-800'
      )}
    >
      {isDocked ? (
        <div
          className={clsx(
            'hidden only:flex',
            'items-center justify-center',
            'h-full',
            'text-xs text-gray-400 dark:text-gray-600',
            'select-none'
          )}
        >
          Select a node to configure
        </div>
      ) : null}
    </div>
  )
}

// --- Getting Started ---

const GETTING_STARTED_SEARCH_KEYS = ['title', 'description', 'slug', 'keywords']

/**
 * Searchable grid of examples rendered inside the getting started popup.
 */
function GettingStartedExampleList({ examples, onSelect }) {
  const { value: search, inputProps: searchInputProps } = useDebouncedInput({
    delay: 200,
  })

  const deferredSearch = useDeferredValue(search)

  const orderedExamples = useMemo(() => {
    const starter = examples.filter(
      ({ slug }) => slug === BLUEPRINT_STARTER_EXAMPLE_SLUG
    )
    const rest = examples.filter(
      ({ slug }) => slug !== BLUEPRINT_STARTER_EXAMPLE_SLUG
    )

    return [...starter, ...rest]
  }, [examples])

  const filteredExamples = useFuzzySearch(orderedExamples, deferredSearch, {
    keys: GETTING_STARTED_SEARCH_KEYS,
    threshold: 0.3,
    debounce: 0,
    disabled: !deferredSearch,
  })

  return (
    <div className="flex flex-col gap-4 max-h-[70vh]">
      <p className="text-sm">
        Get started by selecting an example below. You can also start from
        scratch by selecting the blank example.
      </p>
      <input
        {...searchInputProps}
        className="default-input w-full"
        type="search"
        placeholder="Search examples..."
        autoFocus
      />
      <div className="overflow-auto flex-1">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredExamples.map(({ slug, title, description, keywords }) => (
            <div
              key={slug}
              role="button"
              tabIndex={0}
              className="p-5 h-52 border border-gray-100 dark:border-gray-900 hover:border-gray-500 dark:hover:border-gray-500 rounded-xl cursor-pointer transition-border duration-300"
              onClick={() => onSelect(slug)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  onSelect(slug)
                }
              }}
            >
              <h2 className="text-base font-bold h-[3em] line-clamp-2">
                <span>{title}</span>
              </h2>
              <p className="mt-2 text-sm line-clamp-3">{description}</p>
              {keywords && keywords.length > 0 && (
                <div className="mt-2 flex flex-row flex-wrap gap-1">
                  {keywords.slice(0, 3).map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Detail view for a single example with an iframe preview.
 *
 * @note the iframe src is set after a short delay so the popup open animation
 *   can complete before the heavy ReactFlow graph starts rendering, which
 *   prevents a visible stutter.
 */
function GettingStartedDetailView({ example }) {
  const [iframeSrc, setIframeSrc] = useState(null)
  const [iframeLoaded, setIframeLoaded] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIframeSrc(
        `/examples/${example.slug}/designer?controls=false&minZoom=0.2`
      )
    }, 300)

    return () => clearTimeout(timer)
  }, [example.slug])

  return (
    <div className="flex flex-col gap-4">
      <div className="border auto-border-200 rounded-xl overflow-hidden relative">
        {!iframeLoaded && (
          <div className="w-full aspect-video animate-pulse bg-[var(--color-neutral-50)] dark:bg-[var(--color-neutral-900)]" />
        )}
        {iframeSrc && (
          <iframe
            className={`w-full aspect-video ${
              iframeLoaded
                ? 'block'
                : 'absolute inset-0 opacity-0 pointer-events-none'
            }`}
            src={iframeSrc}
            onLoad={() => setIframeLoaded(true)}
          />
        )}
      </div>
    </div>
  )
}

/**
 * Prompt asking the user what they want to build.
 */
function GettingStartedPrompt({ defaultValue }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        Describe what you want to build and the assistant will help you get
        started. Or browse the examples library to start from a template.
      </p>
      <textarea
        name="prompt"
        className="default-input w-full resize-none"
        rows={4}
        placeholder="e.g. A customer support bot that can answer questions about my product..."
        defaultValue={defaultValue}
        autoFocus
      />
    </div>
  )
}

/**
 *
 */
export function GettingStarted({ examples, userGoal }) {
  const { importBlueprint } = useBlueprint()

  const [, setActive] = useToolbar()

  const assistantWidget = useWidgetInstance('#assistant-widget')

  // @note the widget element only mounts after setActive('assistant') makes the
  //   sidebar visible, so we store the intended message and send it once the
  //   instance resolves

  const pendingMessageRef = useRef(null)

  useEffect(() => {
    if (!assistantWidget || !pendingMessageRef.current) {
      return
    }

    assistantWidget.sendMessage({
      text: pendingMessageRef.current,
      respond: true,
    })

    pendingMessageRef.current = null
  }, [assistantWidget])

  const { popup, openPopup } = usePopup({
    closePopupOnClickOutside: false,
  })

  // @note shared ref so each navigation function can call the others without
  //   stale closure issues - updated on every render

  const navigateRef = useRef({})

  const openDetailScreen = useCallback(
    (slug) => {
      const example = examples.find((e) => e.slug === slug)

      if (!example) {
        return
      }

      openPopup(<GettingStartedDetailView example={example} />, {
        title: example.title,
        description: example.description,

        dialogClassName: '!max-w-4xl',

        closePopupOnClickOutside: false,
        cancelButtonCaption: 'Exit',

        actions: {
          Back: {
            fn: () => navigateRef.current.openListScreen(),
          },

          'Use template': {
            default: true,

            fn: (_data, { close }) => {
              if (example.blueprint) {
                importBlueprint(stringifyYaml(example.blueprint), {
                  selected: false,
                })
              }

              close()
            },
          },
        },
      })
    },
    [examples, openPopup, importBlueprint]
  )

  const openListScreen = useCallback(() => {
    openPopup(
      <GettingStartedExampleList
        examples={examples}
        onSelect={(slug) => navigateRef.current.openDetailScreen(slug)}
      />,
      {
        title: 'Browse Examples',

        dialogClassName: 'w-screen h-auto lg:max-w-5xl',

        closePopupOnClickOutside: false,
        cancelButtonCaption: 'Exit',

        // @note no Back action - the prompt screen it returned to is disabled
        //   while the assistant sidebar is off
      }
    )
  }, [openPopup, examples])

  const openPromptScreen = useCallback(() => {
    openPopup(<GettingStartedPrompt defaultValue={userGoal} />, {
      title: 'Getting Started',

      closePopupOnClickOutside: false,
      cancelButtonCaption: 'Skip',

      actions: {
        'Browse examples': {
          fn: () => navigateRef.current.openListScreen(),
        },

        'Build it': {
          default: true,

          fn: (data, { close }) => {
            const text = data?.prompt?.trim()

            if (text) {
              pendingMessageRef.current = text

              setActive('assistant')
            }

            close()
          },
        },
      },
    })
  }, [openPopup, setActive, userGoal])

  // @note update ref every render so callbacks always see the latest functions

  navigateRef.current = { openDetailScreen, openListScreen, openPromptScreen }

  // @note track if popup has been shown to prevent duplicate displays

  const hasShownPopup = useRef(false)

  useEffect(() => {
    // @note only show popup once on initial mount

    if (hasShownPopup.current) {
      return
    }

    hasShownPopup.current = true

    // @note the assistant sidebar is currently disabled, so the prompt/"Build
    //   it" flow has nowhere to send its message - open the examples library
    //   directly instead of the prompt screen
    // navigateRef.current.openPromptScreen()
    navigateRef.current.openListScreen()
  }, [])

  return popup
}

// --- Command Palette ---

const PALETTE_COMMANDS = [
  {
    id: 'layout',
    label: 'Auto-layout',
    description: 'Auto-arrange all nodes on the canvas',
    keywords: ['arrange', 'layout', 'dagre'],
  },
  {
    id: 'fit',
    label: 'Fit view',
    description: 'Fit all nodes into view',
    keywords: ['zoom', 'fit', 'center'],
  },
  {
    id: 'download',
    label: 'Download blueprint',
    description: 'Download the blueprint as a YAML file',
    keywords: ['export', 'save'],
  },
  {
    id: 'undo',
    label: 'Undo',
    description: 'Undo the last change',
    keywords: [],
  },
  {
    id: 'redo',
    label: 'Redo',
    description: 'Redo the last undone change',
    keywords: [],
  },
]

/**
 * GitHub-style command palette for the blueprint designer.
 *
 * Open with Ctrl/Cmd+P. Three modes:
 *  - Prefix > or / : command mode - run canvas actions
 *  - Plain text    : filter existing blueprint nodes by name/type; pressing
 *                    Enter with no selection (or no results) sends the text
 *                    as a message to the blueprint assistant
 */
function CommandPalette() {
  const [open, setOpen] = useState(false)

  const [query, setQuery] = useState('')

  const inputRef = useRef(null)

  const itemRefs = useRef([])

  const [selectedIndex, setSelectedIndex] = useState(0)

  const { allResources } = useResources()

  const { autoLayout, download, undo, redo, nodes, setNodes } = useBlueprint()

  const { fitView } = useReactFlow()

  const [, setActive] = useToolbar()

  const assistantWidget = useWidgetInstance('#assistant-widget')

  // @note store pending messages so they can be sent once the widget mounts,
  // mirroring the same pattern used in GettingStarted

  const pendingMessageRef = useRef(null)

  useEffect(() => {
    if (!assistantWidget || !pendingMessageRef.current) {
      return
    }

    assistantWidget.sendMessage({
      text: pendingMessageRef.current,
      respond: true,
    })

    pendingMessageRef.current = null
  }, [assistantWidget])

  // @note open via Ctrl/Cmd+P/K, bypassing the default skip list so it works
  // even when an input is focused

  useEffect(() => {
    function onKeyDown(e) {
      const isMac = navigator.platform.match('Mac')
      const hasModifier = isMac ? e.metaKey : e.ctrlKey

      if (hasModifier && (e.key === 'p' || e.key === 'k')) {
        e.preventDefault()
        e.stopPropagation()

        setOpen((v) => !v)
      }

      if (e.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown, true)

    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)

      // @note defer focus so the element is visible before focusing
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const isCommandMode = query.startsWith('>') || query.startsWith('/')

  const rawQuery = isCommandMode ? query.slice(1).trimStart() : query.trim()

  // --- Command mode ---

  const filteredCommands = useMemo(() => {
    if (!isCommandMode || !rawQuery) {
      return isCommandMode ? PALETTE_COMMANDS : []
    }

    const lower = rawQuery.toLowerCase()

    return PALETTE_COMMANDS.filter(
      ({ label, description, keywords }) =>
        label.toLowerCase().includes(lower) ||
        description.toLowerCase().includes(lower) ||
        keywords.some((k) => k.includes(lower))
    )
  }, [isCommandMode, rawQuery])

  // --- Resource filter mode ---

  const canvasNodes = useMemo(() => {
    if (isCommandMode || !open) {
      return []
    }

    return nodes
      .filter((node) => !isNonResourceNodeType(node.type))
      .map((node) => {
        const typeConfig = allResources[node.type] || {}

        return {
          id: node.id,
          label:
            node.data?.name || node.data?.title || typeConfig.title || node.id,
          description: node.data?.description || typeConfig.description || '',
          icon: typeConfig.icon,
          type: node.type,
        }
      })
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [isCommandMode, open, nodes, allResources])

  const filteredNodes = useMemo(() => {
    if (isCommandMode || !rawQuery) {
      return isCommandMode ? [] : canvasNodes
    }

    const lower = rawQuery.toLowerCase()

    return canvasNodes.filter(
      ({ label, description, type }) =>
        label.toLowerCase().includes(lower) ||
        description.toLowerCase().includes(lower) ||
        type.toLowerCase().includes(lower)
    )
  }, [isCommandMode, rawQuery, canvasNodes])

  const items = isCommandMode ? filteredCommands : filteredNodes

  // @note clamp selection when list shrinks

  const clampedIndex = Math.min(selectedIndex, Math.max(0, items.length - 1))

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  function runCommand(id) {
    switch (id) {
      case 'layout':
        autoLayout()

        break
      case 'fit':
        // @note see FIT_VIEW_MIN_ZOOM - let the fit zoom out past the
        // interactive minZoom so notes/frames/images aren't left clipped
        fitView({ padding: 0.1, duration: 300, minZoom: FIT_VIEW_MIN_ZOOM })

        break
      case 'download':
        download()

        break
      case 'undo':
        undo()

        break
      case 'redo':
        redo()

        break
    }

    setOpen(false)
  }

  function focusNode(nodeId) {
    setNodes((nodes) => nodes.map((n) => ({ ...n, selected: n.id === nodeId })))

    fitView({
      nodes: [{ id: nodeId }],
      duration: 300,
      padding: 0.35,
      maxZoom: 1.2,
    })

    setOpen(false)
  }

  function handleSelect(index) {
    const item = items[index]

    if (!item) {
      return
    }

    if (isCommandMode) {
      runCommand(item.id)
    } else {
      focusNode(item.id)
    }
  }

  function handleSubmit() {
    if (items.length > 0) {
      handleSelect(clampedIndex)

      return
    }

    const text = rawQuery.trim()

    if (!text) {
      setOpen(false)

      return
    }

    // @note no matching result - send plain text to the assistant.
    // If the widget is already mounted, send directly; otherwise open the tab
    // first and let the useEffect deliver it once the widget resolves.

    setActive('assistant')

    if (assistantWidget) {
      assistantWidget.sendMessage({ text, respond: true })
    } else {
      pendingMessageRef.current = text
    }

    setOpen(false)
  }

  function handleKeyDown(e) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()

        setSelectedIndex((i) => Math.min(i + 1, items.length - 1))

        itemRefs.current[
          Math.min(clampedIndex + 1, items.length - 1)
        ]?.scrollIntoView?.({ block: 'nearest' })

        break

      case 'ArrowUp':
        e.preventDefault()

        setSelectedIndex((i) => Math.max(i - 1, 0))

        itemRefs.current[Math.max(clampedIndex - 1, 0)]?.scrollIntoView?.({
          block: 'nearest',
        })

        break

      case 'Enter':
        e.preventDefault()

        handleSubmit()

        break

      case 'Escape':
        setOpen(false)

        break
    }
  }

  if (!open) {
    return null
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          setOpen(false)
        }
      }}
    >
      <div className="w-full max-w-xl mx-4 rounded-xl border auto-border-200 auto-bg-white shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <span className="auto-text-gray-400 text-sm select-none flex-shrink-0">
            {isCommandMode ? '>' : '#'}
          </span>
          <input
            ref={inputRef}
            className="flex-1 none-input text-sm auto-text-gray-900 placeholder:text-gray-400"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isCommandMode
                ? 'Type a command...'
                : 'Filter nodes, or type a message for the assistant...'
            }
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono border auto-border-200 rounded auto-text-gray-400 select-none">
            esc
          </kbd>
        </div>
        <div className="max-h-80 overflow-y-auto overscroll-contain">
          {items.length > 0 ? (
            <div className="py-1">
              {items.map((item, index) => (
                <button
                  key={item.id}
                  ref={(el) => {
                    itemRefs.current[index] = el
                  }}
                  type="button"
                  className={clsx(
                    'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
                    index === clampedIndex
                      ? 'auto-bg-gray-100'
                      : 'hover:auto-bg-gray-100'
                  )}
                  onClick={() => handleSelect(index)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  {!isCommandMode && (
                    <DynamicIcon
                      className="w-6 h-6 flex-shrink-0 text-[1.5rem] auto-text-gray-400"
                      icon={item.icon || '@heroicons/cube-transparent'}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium auto-text-gray-900 truncate">
                      {item.label}
                    </div>
                    {item.description && (
                      <div className="text-xs auto-text-gray-500 truncate">
                        {item.description}
                      </div>
                    )}
                  </div>
                  {isCommandMode && (
                    <span className="text-xs auto-text-gray-400 flex-shrink-0">
                      command
                    </span>
                  )}
                  {!isCommandMode && item.type && (
                    <span className="tag flex-shrink-0">{item.type}</span>
                  )}
                </button>
              ))}
            </div>
          ) : rawQuery ? (
            <div className="px-3 py-4 text-sm auto-text-gray-500">
              {isCommandMode ? (
                'No matching commands.'
              ) : (
                <>
                  No matching nodes.{' '}
                  <span className="auto-text-gray-400">
                    Press Enter to send &ldquo;{rawQuery}&rdquo; to the
                    assistant.
                  </span>
                </>
              )}
            </div>
          ) : (
            <div className="px-3 py-3 text-xs auto-text-gray-400 space-y-1 select-none">
              <div>
                Type to filter nodes &mdash; press Enter to send to assistant
              </div>
              <div>
                Start with <kbd className="font-mono">&gt;</kbd> or{' '}
                <kbd className="font-mono">/</kbd> for commands
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// --- Main ---

/**
 *
 */
export function Designer({
  className,

  blueprint,

  examples,

  danglingResources,

  userGoal,

  disabled,

  ...props
}) {
  const { data: platformTemplatesData, loading } = useCache(
    'blueprint.designer.platformTemplates',
    async () => {
      const client = createClient({
        endpoint: new URL('/api/v1/graphql', window.location.origin).href,
      })

      // @todo come up with a better way to fetch the templates

      try {
        return await client.platformTemplates()
      } catch (e) {
        // @note silently ignore 401 errors - this is a public page where
        // authentication is optional, so unauthenticated users are expected
        if (e?.response?.status === 401) {
          return null
        }

        throw e
      }
    },
    {
      ttl: 30 * 60 * 1000, // cache for 30 minutes
      disabled: isDevelopment,
      staleWhileRevalidate: true,
    },
    []
  )

  const getSchemaProperties = useCallback((schema) => {
    if (!schema || typeof schema !== 'object') {
      return {}
    }

    const properties = schema.properties || {}

    if (!properties || typeof properties !== 'object') {
      return {}
    }

    const required = Array.isArray(schema.required) ? schema.required : []

    if (required.length === 0) {
      return properties
    }

    return Object.fromEntries(
      Object.entries(properties).map(([key, value]) => [
        key,
        {
          ...value,

          required: required.includes(key),
        },
      ])
    )
  }, [])

  const platformAbilitiesData = useMemo(() => {
    if (!platformTemplatesData) {
      return {}
    }

    return Object.fromEntries(
      (platformTemplatesData?.platformAbilities?.edges || [])
        .map((edge) => edge.node)
        .filter((item) => item?.id)
        .map((item) => [
          item.template,
          {
            name: item.name ?? '',
            description: item.description ?? '',

            instruction: item.instruction ?? '',

            properties: getSchemaProperties(item.schema),

            provider: item.provider ?? null,

            icon: item.icon ?? null,
            tags: Array.isArray(item.tags) ? item.tags : [],

            commentary: item.commentary ?? null,
            setup: item.setup ?? null,

            bot: item.bot ?? null,
            file: item.file ?? null,
            secret: item.secret ?? null,
            space: item.space ?? null,
          },
        ])
    )
  }, [platformTemplatesData, getSchemaProperties])

  const platformSecretsData = useMemo(() => {
    if (!platformTemplatesData) {
      return {}
    }

    return Object.fromEntries(
      (platformTemplatesData?.platformSecrets?.edges || [])
        .map((edge) => edge.node)
        .filter((item) => item?.id)
        .map((item) => [
          item.template,
          {
            name: item.name ?? '',
            description: item.description ?? '',

            type: item.type ?? 'basic',
            kind: item.kind ?? 'personal',
            config: item.config ?? null,

            icon: item.icon ?? null,
            commentary: item.commentary ?? null,
            setup: item.setup ?? null,

            tags: Array.isArray(item.tags) ? item.tags : [],
          },
        ])
    )
  }, [platformTemplatesData])

  const abilityResources = useMemo(
    () => buildAbilityResources(platformAbilitiesData, platformSecretsData),
    [platformAbilitiesData, platformSecretsData]
  )

  const secretResources = useMemo(
    () => buildSecretResources(platformSecretsData),
    [platformSecretsData]
  )

  const allResources = useMemo(
    () => buildAllResources(abilityResources, secretResources),
    [abilityResources, secretResources]
  )

  const nodeTypes = useMemo(
    () => buildNodeTypes(allResources, abilityResources, secretResources),
    [allResources, abilityResources, secretResources]
  )

  const resourcesContext = useMemo(
    () => ({
      allResources,
      abilityResources,
      secretResources,
      nodeTypes,
      loading,
    }),
    [allResources, abilityResources, secretResources, nodeTypes, loading]
  )

  const hasBlueprint = !!Object.values(blueprint)
    .filter((v) => Array.isArray(v))
    .filter((v) => v.length > 0).length

  return (
    <ResourcesContext.Provider value={resourcesContext}>
      <ResourceDnDProvider {...props}>
        <div
          className={clsx(
            'designer',
            'flex flex-row',
            'relative overflow-hidden',
            className
          )}
        >
          <ReactFlowProvider>
            <BlueprintProvider blueprint={blueprint} disabled={disabled}>
              <ToolbarProvider>
                <Toolbar
                  className="border-r border-gray-200 dark:border-gray-800"
                  blueprint={blueprint}
                  examples={examples}
                  danglingResources={danglingResources}
                />
                <ConfiguratorProvider>
                  <Portal query="#profile-bar-buttons">
                    <TestButton />
                    <BlueprintIssuesButton />
                    <BuildButton />
                    <RenameButton />
                  </Portal>
                  <Canvas
                    className="w-full"
                    controls={true}
                    disabled={disabled}
                  />
                  <Configurator />
                  {!hasBlueprint ? (
                    <GettingStarted examples={examples} userGoal={userGoal} />
                  ) : null}
                  <CommandPalette />
                </ConfiguratorProvider>
              </ToolbarProvider>
            </BlueprintProvider>
          </ReactFlowProvider>
        </div>
      </ResourceDnDProvider>
    </ResourcesContext.Provider>
  )
}

/**
 *
 */
export function Context() {
  const { isSwitched: isTeamSwitched } = useTeamSwitch()
  const { isSwitched: isUserSwitched } = useUserSwitch()

  const isSwitched = isTeamSwitched || isUserSwitched

  return (
    <>
      {isSwitched ? (
        <div
          className={clsx(
            'absolute z-40 top-0 left-1/2 -translate-x-1/2 w-full h-0.5',
            'bg-orange-600 text-white',
            'text-[10px]',
            'cursor-default'
          )}
        />
      ) : null}
    </>
  )
}

/**
 *
 */
export default function Page(props) {
  const partner = usePartner()

  return (
    <DeploymentConfigContext.Provider
      value={{ emailIntegrationDomain: props.emailIntegrationDomain }}
    >
      <ProfileBar
        withDashboard={false}
        withBilling={partner?.whitelabel ? false : true}
        withDarkModeSwitch={true}
      >
        <div className="flex flex-row gap-2" id="profile-bar-buttons" />
      </ProfileBar>
      <div className="w-full h-full flex flex-col">
        <Designer {...props} className="w-full h-full" />
      </div>
      <SuperTools.Memo
        className="[&_.handle]:ml-32"
        theme="dark"
        blueprintId={props.blueprint?.id}
        force
      />
    </DeploymentConfigContext.Provider>
  )
}

Page.getLayout = function (children, { blueprint }) {
  return (
    <>
      <Meta title={blueprint.name || 'Blueprint'} />
      <NoRubberBand />
      <Context />
      <Confirm>
        <div className="w-screen h-screen">{children}</div>
      </Confirm>
    </>
  )
}

/**
 *
 */
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

  const queryResources = {
    ...basicResources,
    ...advancedResources,
    ...complianceResources,
    ...integrationResources,
  }

  const blueprint = await prisma.blueprint.findUnique({
    where: {
      id: context.query.blueprintId,
    },

    include: {
      ...Object.fromEntries(
        Object.entries(queryResources).map(([type, { schema }]) => {
          const collection = getCollection(type)

          return [
            collection,
            {
              select: {
                id: true,

                ...Object.fromEntries(
                  Object.entries(schema).map(([key]) => [key, true])
                ),
              },
            },
          ]
        })
      ),
    },
  })

  if (!blueprint) {
    return {
      notFound: true,
    }
  }

  if (blueprint.userId !== session.user.id) {
    return {
      notFound: true,
    }
  }

  const examples = examplesData
    .filter(
      ({ hidden, slug }) => !hidden || slug === BLUEPRINT_STARTER_EXAMPLE_SLUG
    )
    .filter(({ blueprint }) => !!blueprint)
    .map(({ slug, icon, title, description, keywords, blueprint }) => ({
      slug,
      icon,
      title,
      description,
      keywords,
      blueprint,
    }))

  const excludedDanglingTypes = ['file', 'space']

  // @todo query disconnectedResource via a graphql query from the client rather
  // than returning them from the server directly

  // @note we use Promise.all instead of prisma.$transaction here because these
  // are read-only queries that don't require ACID consistency. Using a
  // transaction holds a single database connection for all queries, which can
  // lead to connection timeouts. With Promise.all, each query uses its own
  // connection and can complete independently.

  const disconnectedResources = await Promise.all(
    Object.entries(queryResources)
      .filter(([type]) => !excludedDanglingTypes.includes(type))
      .map(([type, { schema }]) => {
        return prisma[type].findMany({
          where: {
            userId: session.user.id,
            blueprintId: null,
          },

          select: {
            id: true,

            ...Object.fromEntries(
              Object.entries(schema).map(([key]) => [key, true])
            ),
          },
        })
      })
  )

  // @note these props are serialized with `unsafeKeys: null` so the default
  // `#` key strip does not apply - drop the platform-internal meta keys here,
  // mirroring what `getMeta` does on write

  const danglingResources = Object.fromEntries(
    Object.keys(queryResources)
      .filter((type) => !excludedDanglingTypes.includes(type))
      .map((type, index) => [
        type,

        disconnectedResources[index].map((resource) =>
          'meta' in resource
            ? { ...resource, meta: getPublicMeta(resource.meta) }
            : resource
        ),
      ])
  )

  // @note fetch user goal for onboarding flow pre-fill

  let userGoal = null

  if (context.query.onboarding === 'completed') {
    const user = await prisma.user.findUnique({
      where: {
        id: session.user.id,
      },
      select: {
        goal: true,
      },
    })

    userGoal = user?.goal || null
  }

  return {
    props: makeJsonSafe(
      {
        blueprint,

        examples,

        danglingResources,

        userGoal,

        // @note the address scheme's domain part, derived from the email
        // module's behavior so the client can compose unsaved nodes' inbox
        // addresses without pulling the email module into the client bundle
        // (the import above is used in getServerSideProps only)
        emailIntegrationDomain: formatIntegrationInbox('id').split('@')[1],
      },
      {
        unsafeKeys: null,
      }
    ),
  }
}
