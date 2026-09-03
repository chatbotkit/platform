import {
  Fragment,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { captureUnknownException } from '@/lib/response'
import toast from '@/lib/toast'

import BackButton from '@/components/BackButton'
import CodeAction from '@/components/CodeAction'
import Confirm from '@/components/Confirm'
import { ConfirmDangerButton } from '@/components/ConfirmButton'
import DotsLoader from '@/components/DotsLoader'
import ForwardButton from '@/components/ForwardButton'
import Meta from '@/components/Meta'

import useFetch from '@/hooks/useFetch'
import useRouter from '@/hooks/useRouter'

import { CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/outline'

import clsx from 'clsx'

export const wizardContext = createContext()

export function useWizard() {
  return useContext(wizardContext)
}

function CloseButton({ disabled }) {
  const router = useRouter()

  return (
    <>
      <ConfirmDangerButton
        className="focus:outline-none disabled:opacity-20 disabled:pointer-events-none p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-md"
        message={{
          title: 'Your Changes Will be Lost',
          message: 'Are you sure you want to continue?',
        }}
        onConfirm={() => router.replace('/overview')}
        disabled={disabled}
      >
        <XMarkIcon height="16px" width="16px" />
      </ConfirmDangerButton>
    </>
  )
}

export function Heading({ title, description }) {
  return (
    <div className="bg-white dark:bg-black border-b md:border-0 border-gray-100 dark:border-gray-900 mb-10 md:mb-0 py-10 md:py-8 flex flex-col justify-center items-start lg:bg-transparent w-full px-8 md:px-0">
      <h2 className="text-xl lg:text-2xl mb-1 lg:mb-2 font-medium">{title}</h2>
      <p className="text-xs lg:text-sm text-gray-500 dark:text-gray-500">
        {description}
      </p>
    </div>
  )
}

function SideSection({ caption, title, description, disabled }) {
  const router = useRouter()

  const { currentTemplate } = useContext(wizardContext)

  let currentPageIndex = currentTemplate?.steps
    ? currentTemplate?.steps?.indexOf(router.pathname)
    : 0

  let totalPages = currentTemplate.steps?.length || 0

  if (currentTemplate?.steps?.[0] === ':disabled') {
    currentPageIndex--
    totalPages--
  }

  return (
    <>
      {/* Desktop Section */}
      <aside className="hidden fixed top-0 h-full left-0 min-w-[30rem] max-w-[30rem] auto-bg-gray-50 border-r auto-border-gray-200 overflow-hidden px-10 py-10 lg:flex flex-col justify-between">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="587.106"
          height="945.001"
          viewBox="0 0 587.106 945.001"
          className="absolute left-0 top-0"
        >
          <defs>
            <linearGradient
              id="linear-gradient"
              x1="0.5"
              x2="0.5"
              y2="1"
              gradientUnits="objectBoundingBox"
            >
              <stop offset="0" stopColor="#fafafa" stopOpacity="0" />
              <stop offset="0.478" stopColor="#b2b2b2" stopOpacity="0.314" />
              <stop offset="1" stopColor="#fafafa" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            id="Subtraction_30"
            data-name="Subtraction 30"
            d="M4601.605,1973h-40v-39.581h40V1973Zm141.5-4.947h-1v-37.108h-45v37.108h-1v-37.108h-45v37.108h-1v-37.108h-45v37.108h-1v-37.108h-45v37.108h-1v-37.108h-45v37.108h-1v-37.108h-45v37.108h-1v-37.108h-45v37.108h-1v-37.108h-45v37.108h-1v-37.108h-45v37.108h-1v-37.108h-45v37.108h-1v-37.108h-45v37.108h-1v-37.108H4202v-.99h34.105v-44.529H4202v-.99h34.105v-44.531H4202v-.99h34.105V1794.39H4202v-.99h34.105v-44.529H4202v-.99h34.105v-44.529H4202v-.988h34.105v-44.529H4202v-.988h34.105v-44.532H4202v-.99h34.105V1566.8H4202v-.99h34.105V1521.28H4202v-.99h34.105v-44.528H4202v-.991h34.105v-44.528H4202v-.99h34.105v-44.531H4202v-.99h34.105v-44.528H4202v-.99h34.105v-44.531H4202v-.988h34.105V1248.17H4202v-.99h34.105v-44.529H4202v-.991h34.105v-44.528H4202v-.99h34.105v-44.529H4202v-.988h34.105V1066.1H4202v-.99h34.105V1028h1v37.106h45V1028h1v37.106h45V1028h1v37.106h45V1028h1v37.106h45V1028h1v37.106h45V1028h1v37.106h45V1028h1v37.106h45V1028h1v37.106h45V1028h1v37.106h45V1028h1v37.106h45V1028h1v37.106h45V1028h1v37.106h45V1028h1v.494H4789v939.063h.106v.494h-1v-37.108h-45v37.108Zm0-82.627h0v44.529h45v-44.529Zm-46,0h0v44.529h45v-44.529Zm-46,0h0v44.529h45v-44.529Zm-46,0h0v44.529h45v-44.529Zm-46,0h0v44.529h45v-44.529Zm-46,0h0v44.529h45v-44.529Zm-46,0h0v44.529h45v-44.529Zm-46,0h0v44.529h45v-44.529Zm-46,0h0v44.529h45v-44.529Zm-46,0h0v44.529h45v-44.529Zm-46,0h0v44.529h45v-44.529Zm-46,0h0v44.529h45v-44.529Zm506-45.52v44.53h45v-44.531Zm-46,0v44.53h45v-44.531Zm-46,0v44.53h45v-44.531Zm-46,0v44.53h45v-44.531Zm-46,0v44.53h45v-44.531Zm-46,0v44.53h45v-44.531Zm-46,0v44.53h45v-44.531Zm-46,0v44.53h45v-44.531Zm-46,0v44.53h45v-44.531Zm-46,0v44.53h45v-44.531Zm-46,0v44.53h45v-44.531Zm-46,0v44.53h45v-44.531Zm506-45.517v44.527h45V1794.39Zm-46,0v44.527h45V1794.39Zm-46,0v44.527h45V1794.39Zm-46,0v44.527h45V1794.39Zm-46,0v44.527h45V1794.39Zm-46,0v44.527h45V1794.39Zm-46,0v44.527h45V1794.39Zm-46,0v44.527h45V1794.39Zm-46,0v44.527h45V1794.39Zm-46,0v44.527h45V1794.39Zm-46,0v44.527h45V1794.39Zm-46,0v44.527h45V1794.39Zm506-45.519V1793.4h45v-44.529Zm-46,0V1793.4h45v-44.529Zm-46,0V1793.4h45v-44.529Zm-46,0V1793.4h45v-44.529Zm-46,0V1793.4h45v-44.529Zm-46,0V1793.4h45v-44.529Zm-46,0V1793.4h45v-44.529Zm-46,0V1793.4h45v-44.529Zm-46,0V1793.4h45v-44.529Zm-46,0V1793.4h45v-44.529Zm-46,0V1793.4h45v-44.529Zm-46,0V1793.4h45v-44.529Zm506-45.519h0v44.529h45v-44.529Zm-46,0h0v44.529h45v-44.529Zm-46,0h0v44.529h45v-44.529Zm-46,0h0v44.529h45v-44.529Zm-46,0h0v44.529h45v-44.529Zm-46,0h0v44.529h45v-44.529Zm-46,0h0v44.529h45v-44.529Zm-46,0h0v44.529h45v-44.529Zm-46,0h0v44.529h45v-44.529Zm-46,0h0v44.529h45v-44.529Zm-46,0h0v44.529h45v-44.529Zm-46,0h0v44.529h45v-44.529Zm506-45.517v44.529h45v-44.529Zm-46,0v44.529h45v-44.529Zm-46,0v44.529h45v-44.529Zm-46,0v44.529h45v-44.529Zm-46,0v44.529h45v-44.529Zm-46,0v44.529h45v-44.529Zm-46,0v44.529h45v-44.529Zm-46,0v44.529h45v-44.529Zm-46,0v44.529h45v-44.529Zm-46,0v44.529h45v-44.529Zm-46,0v44.529h45v-44.529Zm-46,0v44.529h45v-44.529Zm506-45.52v44.532h45v-44.532Zm-46,0v44.532h45v-44.532Zm-46,0v44.532h45v-44.532Zm-46,0v44.532h45v-44.532Zm-46,0v44.532h45v-44.532Zm-46,0v44.532h45v-44.532Zm-46,0v44.532h45v-44.532Zm-46,0v44.532h45v-44.532Zm-46,0v44.532h45v-44.532Zm-46,0v44.532h45v-44.532Zm-46,0v44.532h45v-44.532Zm-46,0v44.532h45v-44.532Zm506-45.519h0v44.529h45V1566.8Zm-46,0h0v44.529h45V1566.8Zm-46,0h0v44.529h45V1566.8Zm-46,0h0v44.529h45V1566.8Zm-46,0h0v44.529h45V1566.8Zm-46,0h0v44.529h45V1566.8Zm-46,0h0v44.529h45V1566.8Zm-46,0h0v44.529h45V1566.8Zm-46,0h0v44.529h45V1566.8Zm-46,0h0v44.529h45V1566.8Zm-46,0h0v44.529h45V1566.8Zm-46,0h0v44.529h45V1566.8Zm506-45.517v44.527h45V1521.28Zm-46,0v44.527h45V1521.28Zm-46,0v44.527h45V1521.28Zm-46,0v44.527h45V1521.28Zm-46,0v44.527h45V1521.28Zm-46,0v44.527h45V1521.28Zm-46,0v44.527h45V1521.28Zm-46,0v44.527h45V1521.28Zm-46,0v44.527h45V1521.28Zm-46,0v44.527h45V1521.28Zm-46,0v44.527h45V1521.28Zm-46,0v44.527h45V1521.28Zm506-45.517v44.528h45v-44.528h-45Zm-46,0v44.528h45v-44.528h-45Zm-46,0v44.528h45v-44.528h-45Zm-46,0v44.528h45v-44.528h-45Zm-46,0v44.528h45v-44.528h-45Zm-46,0v44.528h45v-44.528h-45Zm-46,0v44.528h45v-44.528h-45Zm-46,0v44.528h45v-44.528h-45Zm-46,0v44.528h45v-44.528h-45Zm-46,0v44.528h45v-44.528h-45Zm-46,0v44.528h45v-44.528h-45Zm-46,0v44.528h45v-44.528h-45Zm506-45.518v44.527h45v-44.528Zm-46,0v44.527h45v-44.528Zm-46,0v44.527h45v-44.528Zm-46,0v44.527h45v-44.528Zm-46,0v44.527h45v-44.528Zm-46,0v44.527h45v-44.528Zm-46,0v44.527h45v-44.528Zm-46,0v44.527h45v-44.528Zm-46,0v44.527h45v-44.528Zm-46,0v44.527h45v-44.528Zm-46,0v44.527h45v-44.528Zm-46,0v44.527h45v-44.528Zm506-45.52v44.53h45v-44.531Zm-46,0v44.53h45v-44.531Zm-46,0v44.53h45v-44.531Zm-46,0v44.53h45v-44.531Zm-46,0v44.53h45v-44.531Zm-46,0v44.53h45v-44.531Zm-46,0v44.53h45v-44.531Zm-46,0v44.53h45v-44.531Zm-46,0v44.53h45v-44.531Zm-46,0v44.53h45v-44.531Zm-46,0v44.53h45v-44.531Zm-46,0v44.53h45v-44.531Zm506-45.517v44.527h45v-44.528h-45Zm-46,0v44.527h45v-44.528h-45Zm-46,0v44.527h45v-44.528h-45Zm-46,0v44.527h45v-44.528h-45Zm-46,0v44.527h45v-44.528h-45Zm-46,0v44.527h45v-44.528h-45Zm-46,0v44.527h45v-44.528h-45Zm-46,0v44.527h45v-44.528h-45Zm-46,0v44.527h45v-44.528h-45Zm-46,0v44.527h45v-44.528h-45Zm-46,0v44.527h45v-44.528h-45Zm-46,0v44.527h45v-44.528h-45Zm506-45.52v44.53h45v-44.531Zm-46,0v44.53h45v-44.531Zm-46,0v44.53h45v-44.531Zm-46,0v44.53h45v-44.531Zm-46,0v44.53h45v-44.531Zm-46,0v44.53h45v-44.531Zm-46,0v44.53h45v-44.531Zm-46,0v44.53h45v-44.531Zm-46,0v44.53h45v-44.531Zm-46,0v44.53h45v-44.531Zm-46,0v44.53h45v-44.531Zm-46,0v44.53h45v-44.531Zm506-45.517V1292.7h45V1248.17Zm-46,0V1292.7h45V1248.17Zm-46,0V1292.7h45V1248.17Zm-46,0V1292.7h45V1248.17Zm-46,0V1292.7h45V1248.17Zm-46,0V1292.7h45V1248.17Zm-46,0V1292.7h45V1248.17Zm-46,0V1292.7h45V1248.17Zm-46,0V1292.7h45V1248.17Zm-46,0V1292.7h45V1248.17Zm-46,0V1292.7h45V1248.17Zm-46,0V1292.7h45V1248.17Zm506-45.519v44.529h45v-44.529h-45Zm-46,0v44.529h45v-44.529h-45Zm-46,0v44.529h45v-44.529h-45Zm-46,0v44.529h45v-44.529h-45Zm-46,0v44.529h45v-44.529h-45Zm-46,0v44.529h45v-44.529h-45Zm-46,0v44.529h45v-44.529h-45Zm-46,0v44.529h45v-44.529h-45Zm-46,0v44.529h45v-44.529h-45Zm-46,0v44.529h45v-44.529h-45Zm-46,0v44.529h45v-44.529h-45Zm-46,0v44.529h45v-44.529h-45Zm506-45.519v44.528h45v-44.528Zm-46,0v44.528h45v-44.528Zm-46,0v44.528h45v-44.528Zm-46,0v44.528h45v-44.528Zm-46,0v44.528h45v-44.528Zm-46,0v44.528h45v-44.528Zm-46,0v44.528h45v-44.528Zm-46,0v44.528h45v-44.528Zm-46,0v44.528h45v-44.528Zm-46,0v44.528h45v-44.528Zm-46,0v44.528h45v-44.528Zm-46,0v44.528h45v-44.528Zm506-45.519v44.529h45v-44.529Zm-46,0v44.529h45v-44.529Zm-46,0v44.529h45v-44.529Zm-46,0v44.529h45v-44.529Zm-46,0v44.529h45v-44.529Zm-46,0v44.529h45v-44.529Zm-46,0v44.529h45v-44.529Zm-46,0v44.529h45v-44.529Zm-46,0v44.529h45v-44.529Zm-46,0v44.529h45v-44.529Zm-46,0v44.529h45v-44.529Zm-46,0v44.529h45v-44.529Zm506-45.518h0v44.53h45V1066.1Zm-46,0h0v44.53h45V1066.1Zm-46,0h0v44.53h45V1066.1Zm-46,0h0v44.53h45V1066.1Zm-46,0h0v44.53h45V1066.1Zm-46,0h0v44.53h45V1066.1Zm-46,0h0v44.53h45V1066.1Zm-46,0h0v44.53h45V1066.1Zm-46,0h0v44.53h45V1066.1Zm-46,0h0v44.53h45V1066.1Zm-46,0h0v44.53h45V1066.1Zm-46,0h0v44.53h45V1066.1Zm180.5,542.758h-40v-39.581h40v39.581Zm230-318.628h-40v-39.581h40v39.581Z"
            transform="translate(-4202 -1028)"
            fill="url(#linear-gradient)"
          />
        </svg>
        <div className="relative z-10 flex items-center space-x-3 -ml-2">
          {/* Close Modal */}
          {router.pathname !== '/new/success' ? (
            currentTemplate?.closable !== false ? (
              <CloseButton disabled={disabled} />
            ) : null
          ) : (
            <CheckCircleIcon className="w-8 h-8 text-green-600" />
          )}
          <p className="text-sm">
            {router.pathname === '/new/success'
              ? 'You are ready!'
              : (caption || '').trim() +
                (currentPageIndex > 0 && totalPages > 0
                  ? ` (Step ${currentPageIndex + 1} of ${totalPages})`
                  : '')}
          </p>
        </div>
        <div className="relative z-10">
          {router.pathname !== '/new/success' && currentPageIndex > 0 && (
            <p
              className={clsx(
                'text-xs text-gray-500 dark:text-gray-500 font-bold font-mono mb-6 uppercase tracking-widest',
                {
                  'opacity-20': disabled,
                }
              )}
            >
              Step {currentPageIndex + 1}
            </p>
          )}
          <h1
            className={clsx('text-4xl mb-2', {
              'opacity-20': disabled,
            })}
          >
            {title}
          </h1>
          <p
            className={clsx(
              'text-sm max-w-md text-gray-500 dark:text-gray-500',
              {
                'opacity-20': disabled,
              }
            )}
          >
            {description}
          </p>
          <div
            style={{
              gridTemplateColumns: `repeat(${
                currentTemplate?.steps?.length + 1
              }, minmax(0, 1fr))`,
            }}
            className={clsx('grid grid-cols-6 gap-4 mt-12', {
              'opacity-20': disabled,
            })}
          >
            {[...Array(currentTemplate?.steps?.length || 5).keys()].map(
              (item) => (
                <div
                  key={item}
                  className={clsx(
                    'h-2 rounded-full',

                    item + 1 <= currentPageIndex + 1
                      ? 'bg-gray-500 dark:bg-gray-500'
                      : 'bg-gray-200 dark:bg-gray-800',

                    currentPageIndex + 1 === item + 1
                      ? 'col-span-2'
                      : 'col-span-1'
                  )}
                ></div>
              )
            )}
          </div>
        </div>
      </aside>
      {/* Mobile Section */}
      <div className="fixed w-full left-0 px-8 z-40 top-0 bg-white flex items-center justify-between space-x-6 py-4 lg:hidden auto-bg-white border-b auto-border-gray-100">
        <div className="relative z-10 flex items-center space-x-3 -ml-2">
          {router.pathname !== '/new/success' ? (
            currentTemplate?.closable !== false ? (
              <CloseButton disabled={disabled} />
            ) : null
          ) : (
            <CheckCircleIcon height="32px" width="32px" color="#0d9488" />
          )}
          <p className="text-xs text-gray-500 dark:text-gray-500">
            {router.pathname === '/new/success'
              ? 'You are ready!'
              : caption || ''}
          </p>
        </div>
        {router.pathname !== '/new/success' && totalPages > 0 && (
          <div className="flex flex-row gap-2">
            {[...Array(totalPages).keys()].map((item, index) => (
              <div
                key={item}
                className={clsx(
                  'col-span-1 h-8 w-8 uppercase rounded-lg flex items-center justify-center text-[0.6rem] font-mono tracking-widest',

                  item + 1 <= currentPageIndex + 1
                    ? 'default-button'
                    : 'auto-bg-gray-100 opacity-40'
                )}
              >
                {index + 1}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

export function FormContainer({ children }) {
  return <div className="space-y-4 px-8 md:p-0">{children}</div>
}

export function NavigationButtons({
  backButton = true,
  backButtonCaption = 'Previous',

  forwardButtonCaption = 'Next step',
  forwardButtonLastCaption = 'Create',

  onForward,

  disabled,
}) {
  const router = useRouter()

  const {
    currentTemplate,

    loading,

    handleSubmit,

    form,
  } = useContext(wizardContext)

  const currentPageIndex = currentTemplate?.steps?.indexOf(router.pathname)

  const lastStep = currentTemplate?.steps?.length - 1 === currentPageIndex

  return (
    <div className="fixed bottom-0 left-0 lg:relative z-20 flex items-stretch lg:flex-row justify-between mt-10 w-full py-4 lg:py-0 px-6 lg:px-0 border-t border-gray-100 dark:border-gray-900 lg:border-transparent lg:pb-20 gap-3 bg-white dark:bg-black">
      {backButton &&
      currentTemplate.steps?.[currentPageIndex - 1] &&
      currentTemplate.steps?.[currentPageIndex - 1] !== ':disabled' ? (
        <BackButton
          className="default-button"
          type="button"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()

            router.replace(currentTemplate.steps[currentPageIndex - 1])
          }}
          disabled={loading}
        >
          {currentTemplate.backButtonCaption || backButtonCaption}
        </BackButton>
      ) : null}
      <ForwardButton
        className={`primary-button lg:ml-auto flex items-center justify-center flex-1`}
        type="button"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()

          if (form && !form.checkValidity()) {
            form.reportValidity()

            return
          }

          // @note steps that carry state through the url (e.g. the example
          // browse step) can take over the forward navigation
          if (onForward) {
            onForward()

            return
          }

          if (lastStep) {
            handleSubmit()
          } else {
            router.replace(currentTemplate.steps[currentPageIndex + 1])
          }
        }}
        disabled={disabled || loading}
      >
        {lastStep ? (
          loading ? (
            <>
              <DotsLoader />
            </>
          ) : (
            currentTemplate.forwardButtonLastCaption || forwardButtonLastCaption
          )
        ) : (
          currentTemplate.forwardButtonCaption || forwardButtonCaption
        )}
      </ForwardButton>
    </div>
  )
}

export default function Wizard({
  breadcrumbs,
  caption,
  title,
  description,
  keywords,
  image,

  options: _options = {},
  values: _values = {},

  children,
}) {
  const router = useRouter()

  const { code, fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  const [options, setOptions] = useState(_options)

  useEffect(() => {
    // @todo serialize
  }, [options])

  const [values, setValues] = useState(_values)

  useEffect(() => {
    // @todo serialize
  }, [values])

  const [currentTemplate, setCurrentTemplate] = useState({})

  useEffect(() => {
    setOptions((options) => ({ ...options, ...currentTemplate.options }))
    setValues((values) => ({ ...values, ...currentTemplate.values }))
  }, [currentTemplate])

  const isInitialized = !(
    router.pathname !== '/new' && !currentTemplate.templateId
  )

  useEffect(() => {
    if (isInitialized) {
      return
    }

    router.push(
      `/new?${new URLSearchParams({
        ...router.query,

        template: router.pathname.split('/')[2],
      }).toString()}`
    )
  }, [isInitialized, router])

  const formRef = useRef()

  const [loading, setLoading] = useState(false)

  const handleSubmit = useCallback(
    async function () {
      setLoading(true)

      try {
        const result = await currentTemplate.task({
          options,
          setOptions,

          values,
          setValues,

          fetch,
        })

        if (result) {
          setOptions((options) => ({
            ...options,
            ...result,
          }))
        }
      } catch (e) {
        toast.error(e.message || 'Generic error')

        setLoading(false)

        await captureUnknownException(e)

        return
      }

      // @note do not setLoading to false because it will re-activate the UI
      // before navigating away and this is not what we want

      router.replace('/new/success')
    },
    [currentTemplate, fetch, options, router, values]
  )

  const contextValue = useMemo(() => {
    return {
      currentTemplate,
      setCurrentTemplate,

      options,
      setOptions,

      values,
      setValues,

      loading,
      setLoading,

      handleSubmit,

      form: formRef.current,
    }
  }, [currentTemplate, options, values, loading, handleSubmit])

  return (
    <>
      <Meta
        breadcrumbs={breadcrumbs || ['ChatBotKit']}
        title={title}
        description={description}
        keywords={keywords}
        image={image}
      />
      <Confirm>
        <wizardContext.Provider value={contextValue}>
          <CodeAction code={code} />
          {!isInitialized ? (
            <main className="flex items-center space-x-4 h-screen justify-center flex-col space-y-4">
              <DotsLoader />
            </main>
          ) : (
            <main className="relative bg-white dark:bg-black flex h-screen items-stretch">
              <div className="hidden lg:block min-w-[30rem] max-w-[30rem]" />
              <div className="md:w-[50rem] w-full mx-auto mt-0 lg:mt-32 md:px-8">
                <div className="pt-16 w-full lg:pt-0 pb-[10rem] md:pb-0">
                  <SideSection
                    caption={caption}
                    title={title}
                    description={description}
                  />
                  <form ref={formRef} onSubmit={(e) => e.preventDefault()}>
                    <fieldset className="w-full" disabled={loading}>
                      {children}
                    </fieldset>
                  </form>
                </div>
              </div>
            </main>
          )}
        </wizardContext.Provider>
      </Confirm>
    </>
  )
}
