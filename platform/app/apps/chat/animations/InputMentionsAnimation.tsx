import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { LuAtSign, LuBot, LuCpu, LuHash, LuUser } from 'react-icons/lu'

import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'

// --- Types ---

export interface MenuItem {
  id: string
  label: string
  type: 'agent' | 'source' | 'model'
  description?: string
}

export interface TokenData {
  id: string
  text: string
  type: 'agent' | 'source' | 'model'
}

export interface MenuState {
  isOpen: boolean
  items: MenuItem[]
  activeIndex: number
  position: { x: number; y: number }
}

// --- Sub-Components ---

const Cursor: React.FC = () => {
  return (
    <motion.div
      animate={{ opacity: [1, 0] }}
      transition={{
        duration: 0.8,
        repeat: Infinity,
        ease: 'linear',
      }}
      className="w-[2px] h-6 bg-slate-400 dark:bg-slate-500 ml-0.5"
    />
  )
}

interface TokenProps {
  data: TokenData
}

const Token: React.FC<TokenProps> = ({ data }) => {
  let Icon = LuBot
  let colorClass =
    'bg-slate-100/50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600'

  if (data.type === 'agent') {
    Icon = LuAtSign
    colorClass =
      'bg-blue-50/50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-700 border-dashed'
  } else if (data.type === 'source') {
    Icon = LuHash
    colorClass =
      'bg-emerald-50/50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700 border-dashed'
  } else if (data.type === 'model') {
    Icon = LuCpu
    colorClass =
      'bg-purple-50/50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-700 border-dashed'
  }

  return (
    <motion.div
      layout
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={clsx(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-sm font-medium',
        colorClass
      )}
    >
      <Icon size={14} strokeWidth={2} />
      <span>{data.text.replace(/^[@#^]/, '')}</span>
    </motion.div>
  )
}

interface WireframeMenuProps {
  items: MenuItem[]
  activeIndex: number
}

const WireframeMenu: React.FC<WireframeMenuProps> = ({
  items,
  activeIndex,
}) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'agent':
        return LuUser
      case 'source':
        return LuHash
      case 'model':
        return LuCpu
      default:
        return LuBot
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="absolute left-0 top-full mt-2 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 shadow-xl overflow-hidden z-10"
    >
      <div className="p-1.5 flex flex-col gap-0.5">
        {items.map((item, index) => {
          const isActive = index === activeIndex
          const Icon = getIcon(item.type)

          return (
            <div
              key={item.id}
              className={clsx(
                'relative flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors duration-200',
                isActive
                  ? 'bg-slate-100/50 dark:bg-slate-800/50'
                  : 'bg-transparent'
              )}
            >
              {/* Wireframe Highlight Box */}
              {isActive && (
                <motion.div
                  layoutId="activeItem"
                  className="absolute inset-0 border border-dashed border-slate-300 dark:border-slate-600 rounded-md bg-slate-100/30 dark:bg-slate-800/30 z-0"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.3 }}
                />
              )}

              {/* Icon Box */}
              <div
                className={clsx(
                  'relative z-10 flex items-center justify-center w-8 h-8 rounded border border-dashed bg-transparent',
                  isActive
                    ? 'border-slate-400 dark:border-slate-500 text-slate-700 dark:text-slate-300'
                    : 'border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500'
                )}
              >
                <Icon size={16} />
              </div>

              {/* Content */}
              <div className="relative z-10 flex flex-col">
                <span
                  className={clsx(
                    'text-sm font-medium',
                    isActive
                      ? 'text-slate-900 dark:text-slate-100'
                      : 'text-slate-500 dark:text-slate-400'
                  )}
                >
                  {item.label}
                </span>
                {item.description && (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                    {item.description}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer (Wireframe details) */}
      <div className="px-3 py-1.5 border-t border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full border border-slate-300 dark:border-slate-600" />
          <div className="w-2 h-2 rounded-full border border-slate-300 dark:border-slate-600" />
        </div>
        <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">
          TAB to navigate
        </span>
      </div>
    </motion.div>
  )
}

// --- Main Component ---

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

interface WelcomeAnimationProps {
  className?: string
}

export const InputMentionsAnimation: React.FC<WelcomeAnimationProps> = ({
  className,
}) => {
  const [tokens, setTokens] = useState<TokenData[]>([])

  const [inputValue, setInputValue] = useState('')

  const [menu, setMenu] = useState<MenuState>({
    isOpen: false,
    items: [],
    activeIndex: 0,
    position: { x: 0, y: 0 },
  })

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let mounted = true

    const typeText = async (text: string, speed: number = 60) => {
      for (const char of text) {
        if (!mounted) {
          return
        }

        setInputValue((prev) => prev + char)

        await delay(speed + Math.random() * 30) // slight variation
      }
    }

    const backspace = async (count: number, speed: number = 40) => {
      for (let i = 0; i < count; i++) {
        if (!mounted) {
          return
        }

        setInputValue((prev) => prev.slice(0, -1))
        await delay(speed)
      }
    }

    const runSequence = async () => {
      while (mounted) {
        // Initial Pause
        await delay(1000)

        // --- PHASE 1: AGENTS (@) ---
        await typeText('@ag')
        await delay(100)
        await typeText('e')

        if (!mounted) {
          break
        }

        setMenu({
          isOpen: true,
          activeIndex: 0,
          position: { x: 0, y: 40 }, // simplified positioning relative to container
          items: [
            {
              id: '1',
              label: 'Agent Smith',
              type: 'agent',
              description: 'Matrix Analysis',
            },
            {
              id: '2',
              label: 'Agent Carter',
              type: 'agent',
              description: 'SSR Logistics',
            },
            {
              id: '3',
              label: 'Agent 47',
              type: 'agent',
              description: 'Problem Solver',
            },
          ],
        })

        await delay(600)

        if (!mounted) {
          break
        }

        // Navigate menu
        setMenu((prev) => ({ ...prev, activeIndex: 1 })) // Highlight Carter
        await delay(400)
        setMenu((prev) => ({ ...prev, activeIndex: 0 })) // Highlight Smith
        await delay(600)

        // Select Item
        setMenu((prev) => ({ ...prev, isOpen: false }))
        await backspace(4) // Remove @age
        setTokens((prev) => [
          ...prev,
          { id: 't1', text: '@Agent Smith', type: 'agent' },
        ])

        await delay(300)
        await typeText(' analyze the q3 reports')
        await delay(1500)

        // Fade out / Clear
        setTokens([])
        setInputValue('')
        await delay(800)

        // --- PHASE 2: SOURCES (#) ---
        await typeText('#sou')
        await delay(100)
        await typeText('r')

        if (!mounted) {
          break
        }

        setMenu({
          isOpen: true,
          activeIndex: 0,
          position: { x: 0, y: 40 },
          items: [
            {
              id: 's1',
              label: '#quarterly-financials',
              type: 'source',
              description: 'PDF • 4.2MB',
            },
            {
              id: 's2',
              label: '#slack-general',
              type: 'source',
              description: 'Channel History',
            },
            {
              id: 's3',
              label: '#github-issues',
              type: 'source',
              description: 'Active Tickets',
            },
          ],
        })

        await delay(500)

        if (!mounted) {
          break
        }

        setMenu((prev) => ({ ...prev, activeIndex: 1 })) // Highlight slack
        await delay(300)
        setMenu((prev) => ({ ...prev, activeIndex: 2 })) // Highlight github
        await delay(600)

        // Select Item
        setMenu((prev) => ({ ...prev, isOpen: false }))
        await backspace(5) // Remove #sour
        setTokens((prev) => [
          ...prev,
          { id: 't2', text: '#github-issues', type: 'source' },
        ])

        await delay(300)
        await typeText(' summarize blockers')
        await delay(1500)

        // Fade out / Clear
        setTokens([])
        setInputValue('')
        await delay(800)

        // --- PHASE 3: MODELS (^) ---
        await typeText('^mo')
        await delay(150)
        await typeText('d')

        if (!mounted) {
          break
        }

        setMenu({
          isOpen: true,
          activeIndex: 0,
          position: { x: 0, y: 40 },
          items: [
            {
              id: 'm1',
              label: 'Claude 4.5 Sonnet',
              type: 'model',
              description: 'Advanced Reasoning',
            },
            {
              id: 'm2',
              label: 'GPT-5',
              type: 'model',
              description: 'Latest from OpenAI',
            },
            {
              id: 'm3',
              label: 'Gemini 3 Pro',
              type: 'model',
              description: 'Multimodal • Fast',
            },
          ],
        })

        await delay(800)
        // Select first item immediately
        setMenu((prev) => ({ ...prev, isOpen: false }))
        await backspace(4)
        setTokens((prev) => [
          ...prev,
          { id: 't3', text: 'Claude 4.5 Sonnet', type: 'model' },
        ])

        await delay(200)
        await typeText(' generate unit tests')
        await delay(2000)

        // Final Clear
        setTokens([])
        setInputValue('')
        await delay(500)
      }
    }

    void runSequence()

    return () => {
      mounted = false
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={clsx(
        'overflow-hidden w-full flex flex-col justify-center select-none',
        className
      )}
    >
      <div className="relative">
        {/* Input Container */}
        <div className="relative flex flex-wrap items-center gap-2 px-4 h-[64px] bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg shadow-sm transition-all duration-300">
          {/* Render Tokens */}
          <AnimatePresence mode="popLayout">
            {tokens.map((token) => (
              <Token key={token.id} data={token} />
            ))}
          </AnimatePresence>

          {/* Current Typing Input */}
          <div className="flex items-center">
            <span className="whitespace-pre text-lg text-slate-800 dark:text-slate-200">
              {inputValue}
            </span>
            <Cursor />
          </div>

          {/* Placeholder when empty */}
          {tokens.length === 0 && inputValue === '' && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 pointer-events-none text-lg">
              Type @ to start...
            </div>
          )}
        </div>

        {/* Floating Menu */}
        <AnimatePresence>
          {menu.isOpen && (
            <WireframeMenu items={menu.items} activeIndex={menu.activeIndex} />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default InputMentionsAnimation
