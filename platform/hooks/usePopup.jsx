'use client'

import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { formToData } from '@/lib/form'
import { isComponent } from '@/lib/react'

import { Dialog, Transition } from '@headlessui/react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'

import clsx from 'clsx'

export function Content({ content, props }) {
  const Component = useMemo(() => {
    return isComponent(content.render) ? content.render : () => content.render
  }, [content])

  return <Component {...props} />
}

/**
 * Smoothly animates height changes when its children change size.
 */
export function AnimatedHeight({ children, className }) {
  const outerRef = useRef(null)
  const innerRef = useRef(null)

  // @note set an explicit pixel height on the outer div so CSS transition works
  useLayoutEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current

    if (!outer || !inner) {
      return
    }

    const update = () => {
      // @note added 1px to compensate for occasional rounding issues that cause
      // a 1px gap at the bottom or hidding of bottom borders
      outer.style.height = `${inner.offsetHeight + 1}px`
    }

    // @note set immediately on first render to avoid wrong starting height
    update()

    const ro = new ResizeObserver(update)

    ro.observe(inner)

    return () => ro.disconnect()
  }, [])

  // @note re-measure when children change (content swap inside popup)
  useEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current

    if (outer && inner) {
      // @note added 1px to compensate for occasional rounding issues that cause
      // a 1px gap at the bottom or hidding of bottom borders
      outer.style.height = `${inner.offsetHeight + 1}px`
    }
  })

  return (
    <div
      ref={outerRef}
      className={clsx(
        'overflow-hidden transition-[height] duration-300 ease-in-out -mx-1 -mt-1',
        className
      )}
    >
      <div ref={innerRef} className="px-1 pt-1">
        {children}
      </div>
    </div>
  )
}

export function PopupContent({ animateHeight = true, children }) {
  return animateHeight ? <AnimatedHeight>{children}</AnimatedHeight> : children
}

export default function usePopup(defaultOptions) {
  // @note store defaultOptions in a ref to avoid re-renders when caller passes
  // inline objects - we only care about the values, not object identity

  const defaultOptionsRef = useRef(defaultOptions)

  defaultOptionsRef.current = defaultOptions

  const [tempOptions, setTempOptions] = useState({})

  const options = useMemo(() => {
    return { ...defaultOptionsRef.current, ...tempOptions }
    // @note intentionally omit defaultOptionsRef from deps - we read from ref
  }, [tempOptions])

  const onClose = options.onClose

  const [closePopupOnClickOutside, setClosePopupOnClickOutside] = useState(
    defaultOptions?.closePopupOnClickOutside ?? true
  )

  const [content, setContent] = useState({})

  const popupSessionRef = useRef(0)

  const [open, setOpen] = useState(options.open || false)

  const [disabled, setDisabled] = useState(false)

  const [actionsDisabled, setActionsDisabled] = useState(false)

  const [props, setProps] = useState({})

  const optionsRef = useRef(options)

  const formRef = useRef()

  /** @type {(render: any, options?: Record<string, any>) => void} */
  const openPopup = useCallback((render, options) => {
    const popupSession = popupSessionRef.current + 1

    popupSessionRef.current = popupSession

    if (options) {
      optionsRef.current = options

      setTempOptions(options)

      setClosePopupOnClickOutside(
        Object.prototype.hasOwnProperty.call(
          options,
          'closePopupOnClickOutside'
        )
          ? options.closePopupOnClickOutside
          : (defaultOptionsRef.current?.closePopupOnClickOutside ?? true)
      )
    } else {
      optionsRef.current = {}
      setTempOptions({})
      setClosePopupOnClickOutside(
        defaultOptionsRef.current?.closePopupOnClickOutside ?? true
      )
    }

    setContent({ render, popupSession })

    setOpen(true)
  }, [])

  const closePopup = useCallback(() => {
    // setTempOptions({}) // @note disabled because it causes flickering, instead we use afterLeave

    setOpen(false)

    const thisOnClose = onClose || optionsRef.current.onClose

    if (thisOnClose) {
      const data = formToData(formRef.current)

      thisOnClose(data)
    }
  }, [onClose])

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault()
      event.stopPropagation()

      for (const action of Object.entries(options.actions || {})) {
        if (typeof action === 'object' && action !== null && action.default) {
          const data = formToData(formRef.current)

          setActionsDisabled(true)

          try {
            await action.fn(data, { close: closePopup })
          } catch {
            // @todo maybe handle error
          }

          setActionsDisabled(false)

          break
        }
      }
    },
    [options.actions, closePopup]
  )

  const popup = useMemo(() => {
    // @note keep the popup tree mounted until after the leave transition clears
    // content, then return null when it is fully idle

    if (!open && !content.render) {
      return null
    }

    return (
      <Transition.Root show={open} as={Fragment}>
        <Dialog
          as="form"
          className="relative z-50"
          ref={formRef}
          onSubmit={handleSubmit}
          onClose={
            closePopupOnClickOutside && !disabled ? closePopup : () => {}
          }
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
            afterLeave={() => {
              if (content.popupSession !== popupSessionRef.current) {
                return
              }

              setTempOptions({})

              // @note clear buffered popup content after the leave transition
              // so popup-only components fully unmount while the close
              // animation still works
              setContent({})
            }}
          >
            <div className="fixed inset-0 bg-black bg-opacity-70 transition-opacity" />
          </Transition.Child>
          <fieldset
            className="fixed inset-0 z-10 overflow-y-auto"
            disabled={disabled}
          >
            <div className="flex flex-col justify-center items-center min-h-full">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <Dialog.Panel
                  className={clsx(
                    'relative',

                    'overflow-hidden',

                    'shadow-xl',

                    'w-full max-w-xl',

                    'auto-bg-white',

                    'border auto-border-gray-300',

                    'divide-y auto-divide-gray-100',

                    'font-sans',

                    'sm:rounded-2xl',

                    'sm:my-6',

                    'flex flex-col',

                    'transition-all duration-300 ease-in-out',

                    options.dialogClassName
                  )}
                >
                  <div
                    className={clsx(
                      'px-6 py-6',
                      'flex-1 flex flex-col gap-4',
                      options.dialogInnerClassName
                    )}
                  >
                    {options.type === 'alert' ? (
                      <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                        <ExclamationTriangleIcon
                          className="h-6 w-6 text-red-600"
                          aria-hidden="true"
                        />
                      </div>
                    ) : null}
                    <div className="flex-1 flex flex-col gap-4">
                      {options.title ? (
                        <Dialog.Title
                          as="h3"
                          className={clsx(
                            'popup-title',
                            'text-lg font-medium !font-sans leading-6 line-clamp-2',
                            'auto-text-gray-900',
                            options.titleClassName
                          )}
                        >
                          {options.title}
                        </Dialog.Title>
                      ) : null}
                      {options.description ? (
                        <Dialog.Description
                          className={clsx(
                            'popup-description',
                            'text-sm line-clamp-5',
                            'auto-text-gray-500',
                            options.descriptionClassName
                          )}
                        >
                          {options.description}
                        </Dialog.Description>
                      ) : null}
                      <div
                        className={clsx(
                          'popup-content',
                          'flex-1',
                          'auto-text-gray-500',
                          options.contentClassName
                        )}
                      >
                        <PopupContent
                          animateHeight={options.animateContentHeight !== false}
                        >
                          <Content content={content} props={props} />
                        </PopupContent>
                      </div>
                    </div>
                  </div>
                  {!options.noActions ? (
                    <div className="px-6 py-3 flex flex-row gap-4">
                      <button
                        type="button"
                        className="default-button"
                        onClick={closePopup}
                        disabled={disabled}
                      >
                        {options.cancelButtonCaption || 'Cancel'}
                      </button>
                      <div className="flex-1" />
                      {Object.entries(options.actions || {}).map(
                        ([title, fn], index) => {
                          let isDefault = false
                          let isDanger = false

                          if (typeof fn === 'object' && fn !== null) {
                            isDefault = fn.default
                            isDanger = fn.danger

                            fn = fn.fn
                          }

                          return (
                            <button
                              key={index}
                              type="button"
                              className={clsx({
                                'primary-button': isDefault,
                                'danger-button': isDanger,
                                'default-button': !isDefault && !isDanger,
                              })}
                              onClick={async () => {
                                const data = formToData(formRef.current)

                                setActionsDisabled(true)

                                try {
                                  await fn(data, { close: closePopup })
                                } catch {
                                  // @todo maybe handle error
                                }

                                setActionsDisabled(false)
                              }}
                              disabled={disabled || actionsDisabled}
                            >
                              {title}
                            </button>
                          )
                        }
                      )}
                    </div>
                  ) : null}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </fieldset>
        </Dialog>
      </Transition.Root>
    )
  }, [
    actionsDisabled,
    closePopup,
    closePopupOnClickOutside,
    content,
    disabled,
    handleSubmit,
    open,
    options.dialogClassName,
    options.dialogInnerClassName,
    options.titleClassName,
    options.descriptionClassName,
    options.contentClassName,
    options.animateContentHeight,
    options.title,
    options.description,
    options.cancelButtonCaption,
    options.noActions,
    options.actions,
    options.type,
    props,
  ])

  return {
    popup,
    openPopup,
    closePopup,

    disabled,
    setDisabled,

    actionsDisabled,
    setActionsDisabled,

    props,
    setProps,
  }
}
