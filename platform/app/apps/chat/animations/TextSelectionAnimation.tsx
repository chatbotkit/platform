import type React from 'react'
import { forwardRef, useEffect, useRef, useState } from 'react'
import { FaMousePointer } from 'react-icons/fa'
import { LuMessageCircleMore } from 'react-icons/lu'

import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'

// --- Types ---

export interface TextSelectionAnimationProps {
  className?: string
}

// --- Sub-Components ---

const AnimatedPointer: React.FC<{
  x: number
  y: number
  isSelecting: boolean
}> = ({ x, y }) => {
  return (
    <motion.div
      animate={{ x, y }}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
      className="absolute pointer-events-none z-10"
      style={{ left: 0, top: 0 }}
    >
      <FaMousePointer size={20} className="text-black dark:text-white" />
    </motion.div>
  )
}

AnimatedPointer.displayName = 'AnimatedPointer'

const SelectionHighlight = forwardRef<
  HTMLSpanElement,
  {
    text: string
    isSelected: boolean
  }
>(({ text, isSelected }, ref) => {
  return (
    <span
      ref={ref}
      className={clsx(
        'transition-all duration-300 rounded px-1',
        isSelected ? 'bg-blue-100 dark:bg-blue-900/50' : ''
      )}
    >
      {text}
    </span>
  )
})

SelectionHighlight.displayName = 'SelectionHighlight'

const PopupButton = forwardRef<
  HTMLButtonElement,
  {
    visible: boolean
    onClick: () => void
  }
>(({ visible, onClick }, ref) => {
  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          ref={ref}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClick}
          className="absolute left-1/2 -translate-x-1/2 -top-12 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2"
        >
          <LuMessageCircleMore
            size={20}
            className="text-slate-600 dark:text-slate-400"
          />
        </motion.button>
      )}
    </AnimatePresence>
  )
})

PopupButton.displayName = 'PopupButton'

const ClipForm = forwardRef<
  HTMLButtonElement,
  {
    visible: boolean
    text: string
  }
>(({ visible, text }, submitButtonRef) => {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 10 }}
          transition={{ duration: 0.3 }}
          className="absolute left-1/2 -translate-x-1/2 -top-48 w-80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-4"
        >
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                Selected Text
              </label>
              <div className="text-sm text-slate-700 dark:text-slate-300 bg-transparent border border-dashed border-slate-300 dark:border-slate-600 rounded px-3 py-2 max-h-20 overflow-y-auto">
                {text}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                Your Feedback
              </label>
              <input
                type="text"
                placeholder="Add your comment or correction..."
                className="w-full text-sm px-3 py-2 bg-transparent border border-dashed border-slate-300 dark:border-slate-600 rounded"
                readOnly
                tabIndex={-1}
                aria-hidden="true"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                ref={submitButtonRef}
                type="button"
                className="text-sm px-3 py-1.5 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded opacity-60 cursor-default"
                disabled
                aria-hidden="true"
              >
                Submit
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})

ClipForm.displayName = 'ClipForm'

// --- Main Component ---

const DEMO_SELECTED_TEXT = 'this response'

export const TextSelectionAnimation: React.FC<TextSelectionAnimationProps> = ({
  className,
}) => {
  const [step, setStep] = useState(0)
  const [pointerPos, setPointerPos] = useState({ x: 80, y: 150 })
  const [isSelecting, setIsSelecting] = useState(false)
  const [isSelected, setIsSelected] = useState(false)
  const [showPopup, setShowPopup] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const popupRef = useRef<HTMLButtonElement>(null)
  const submitButtonRef = useRef<HTMLButtonElement>(null)

  const getRelativePosition = (
    element: HTMLElement | null,
    offsetX: number = 0,
    offsetY: number = 0
  ) => {
    if (!element || !containerRef.current) {
      return { x: 0, y: 0 }
    }

    const containerRect = containerRef.current.getBoundingClientRect()
    const elementRect = element.getBoundingClientRect()

    return {
      x: elementRect.left - containerRect.left + offsetX,
      y: elementRect.top - containerRect.top + offsetY,
    }
  }

  useEffect(() => {
    const timeline = [
      // Step 0: Initial state
      { delay: 0, action: () => {} },

      // Step 1: Move pointer to start of text
      {
        delay: 300,
        action: () => {
          if (textRef.current) {
            const pos = getRelativePosition(textRef.current, 0, 0)

            setPointerPos(pos)
          }
        },
      },

      // Step 2: Start selecting
      {
        delay: 500,
        action: () => {
          setIsSelecting(true)
        },
      },

      // Step 3: Move pointer to end of selection
      {
        delay: 650,
        action: () => {
          if (textRef.current) {
            const rect = textRef.current.getBoundingClientRect()
            const pos = getRelativePosition(textRef.current, rect.width, 0)

            setPointerPos(pos)
          }

          setIsSelected(true)
        },
      },

      // Step 4: End selecting, show popup button
      {
        delay: 800,
        action: () => {
          setIsSelecting(false)
          setShowPopup(true)
        },
      },

      // Step 5: Move pointer to popup button
      {
        delay: 1000,
        action: () => {
          // Wait a bit for popup to render, then calculate position
          setTimeout(() => {
            if (popupRef.current) {
              const buttonRect = popupRef.current.getBoundingClientRect()
              const pos = getRelativePosition(
                popupRef.current,
                buttonRect.width / 2,
                buttonRect.height / 2
              )

              setPointerPos(pos)
            }
          }, 100)
        },
      },

      // Step 6: Click popup button, show form
      {
        delay: 1400,
        action: () => {
          setShowPopup(false)
          setShowForm(true)
        },
      },

      // Step 7: Move pointer to Submit button
      {
        delay: 1800,
        action: () => {
          setTimeout(() => {
            if (submitButtonRef.current) {
              const buttonRect = submitButtonRef.current.getBoundingClientRect()
              const pos = getRelativePosition(
                submitButtonRef.current,
                buttonRect.width / 2,
                buttonRect.height / 2
              )

              setPointerPos(pos)
            }
          }, 100)
        },
      },

      // Step 8: Hold on form
      {
        delay: 2500,
        action: () => {},
      },

      // Step 9: Reset
      {
        delay: 2700,
        action: () => {
          setIsSelected(false)
          setShowForm(false)

          if (textRef.current) {
            const pos = getRelativePosition(textRef.current, 0, 0)

            setPointerPos(pos)
          }

          setStep(0)
        },
      },
    ]

    const timer = setTimeout(() => {
      if (step < timeline.length) {
        timeline[step].action()
        setStep(step + 1)
      } else {
        // Loop animation
        setStep(0)
      }
    }, timeline[step]?.delay || 0)

    return () => clearTimeout(timer)
  }, [step])

  return (
    <div
      className={clsx(
        'relative flex items-center justify-center select-none',
        className
      )}
      aria-label="Text selection demonstration"
      role="img"
    >
      {/* Container for the message */}
      <div ref={containerRef} className="relative w-full max-w-2xl">
        {/* Mock chat message */}
        <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                AI
              </span>
            </div>
            <div className="flex-1 text-slate-700 dark:text-slate-300 text-base leading-relaxed">
              <p className="relative">
                Select{' '}
                <span className="relative inline-block">
                  <SelectionHighlight
                    ref={textRef}
                    text={DEMO_SELECTED_TEXT}
                    isSelected={isSelected}
                  />
                  {/* Popup button positioned relative to the selected text */}
                  <PopupButton
                    ref={popupRef}
                    visible={showPopup}
                    onClick={() => {
                      setShowPopup(false)
                      setShowForm(true)
                    }}
                  />
                  {/* Feedback form */}
                  <ClipForm
                    ref={submitButtonRef}
                    visible={showForm}
                    text={DEMO_SELECTED_TEXT}
                  />
                </span>{' '}
                to provide feedback or corrections to help improve the AI.
              </p>
            </div>
          </div>
        </div>

        {/* Animated pointer */}
        <AnimatedPointer
          x={pointerPos.x}
          y={pointerPos.y}
          isSelecting={isSelecting}
        />
      </div>
    </div>
  )
}

export default TextSelectionAnimation
