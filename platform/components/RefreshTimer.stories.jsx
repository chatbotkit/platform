/* eslint-disable import/no-anonymous-default-export */
import { useState } from 'react'

import RefreshTimer from './RefreshTimer'

export default {
  title: 'Components/RefreshTimer',
  component: RefreshTimer,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    interval: {
      control: { type: 'number', min: 0, max: 120, step: 5 },
      description: 'Refresh interval in seconds (0 to disable)',
    },
    loading: {
      control: 'boolean',
      description: 'Whether a refresh is currently in progress',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
    onRefresh: {
      action: 'refreshed',
      description: 'Callback when refresh is triggered',
    },
  },
}

// Default story with controls
export const Default = {
  args: {
    interval: 30,
    loading: false,
  },
}

// Short interval to see countdown in action
export const ShortInterval = {
  args: {
    interval: 10,
    loading: false,
  },
}

// Loading state
export const Loading = {
  args: {
    interval: 30,
    loading: true,
  },
}

// Disabled (interval = 0)
export const Disabled = {
  args: {
    interval: 0,
    loading: false,
  },
}

// Interactive example with simulated loading
const InteractiveExample = () => {
  const [loading, setLoading] = useState(false)
  const [refreshCount, setRefreshCount] = useState(0)
  const [lastRefresh, setLastRefresh] = useState(null)

  const handleRefresh = async () => {
    setLoading(true)
    setRefreshCount((c) => c + 1)

    // Simulate async work
    await new Promise((resolve) => setTimeout(resolve, 1500))

    setLastRefresh(new Date())
    setLoading(false)
  }

  return (
    <div className="space-y-4 p-4">
      <h3 className="text-lg font-semibold">Interactive RefreshTimer</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Hover over the timer to see the refresh button. Click to trigger a
        refresh immediately.
      </p>

      <div className="flex items-center gap-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <span className="text-sm font-medium">Data Panel</span>
        <div className="flex-1" />
        <RefreshTimer
          interval={15}
          onRefresh={handleRefresh}
          loading={loading}
        />
      </div>

      <div className="text-sm space-y-1">
        <p>
          Refresh count: <strong>{refreshCount}</strong>
        </p>
        <p>
          Last refresh:{' '}
          <strong>{lastRefresh?.toLocaleTimeString() || 'Never'}</strong>
        </p>
      </div>
    </div>
  )
}

export const Interactive = {
  render: () => <InteractiveExample />,
  parameters: {
    controls: { disable: true },
  },
}

// Urgency colors demonstration
const UrgencyColorsExample = () => {
  return (
    <div className="space-y-4 p-4">
      <h3 className="text-lg font-semibold">Urgency Color Transitions</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Watch the color change as countdown decreases: amber (&gt;5s) → orange
        (2-5s) → red (≤2s)
      </p>

      <div className="flex items-center gap-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <span className="text-sm font-medium">Watch the colors</span>
        <div className="flex-1" />
        <RefreshTimer interval={12} />
      </div>
    </div>
  )
}

export const UrgencyColors = {
  render: () => <UrgencyColorsExample />,
  parameters: {
    controls: { disable: true },
  },
}

// Multiple timers with different intervals
const MultipleTimersExample = () => {
  const [logs, setLogs] = useState([])

  const addLog = (name) => {
    setLogs((prev) => [
      { name, time: new Date().toLocaleTimeString() },
      ...prev.slice(0, 9),
    ])
  }

  return (
    <div className="space-y-4 p-4">
      <h3 className="text-lg font-semibold">Multiple Timers</h3>

      <div className="space-y-2">
        <div className="flex items-center gap-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
          <span className="text-sm font-medium">Fast (5s)</span>
          <div className="flex-1" />
          <RefreshTimer interval={5} onRefresh={() => addLog('Fast')} />
        </div>

        <div className="flex items-center gap-4 p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
          <span className="text-sm font-medium">Medium (15s)</span>
          <div className="flex-1" />
          <RefreshTimer interval={15} onRefresh={() => addLog('Medium')} />
        </div>

        <div className="flex items-center gap-4 p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
          <span className="text-sm font-medium">Slow (30s)</span>
          <div className="flex-1" />
          <RefreshTimer interval={30} onRefresh={() => addLog('Slow')} />
        </div>
      </div>

      <div className="mt-4">
        <h4 className="text-sm font-medium mb-2">Refresh Log</h4>
        <div className="h-32 overflow-auto bg-gray-50 dark:bg-gray-900 rounded p-2 text-xs font-mono">
          {logs.length === 0 ? (
            <span className="text-gray-400">No refreshes yet...</span>
          ) : (
            logs.map((log, i) => (
              <div key={i}>
                [{log.time}] {log.name} refreshed
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export const MultipleTimers = {
  render: () => <MultipleTimersExample />,
  parameters: {
    controls: { disable: true },
  },
}

// In context - simulating the File Preview header
const FilePreviewContextExample = () => {
  const [loading, setLoading] = useState(false)
  const [content, setContent] = useState('Hello, World!')

  const handleRefresh = async () => {
    setLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setContent(`Updated at ${new Date().toLocaleTimeString()}`)
    setLoading(false)
  }

  return (
    <div className="w-80">
      <div className="rounded-lg overflow-hidden border border-amber-300 dark:border-amber-600">
        {/* Header - like FilePreviewToolNode */}
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-100 dark:bg-amber-800/50">
          <svg
            className="w-4 h-4 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <span className="flex-1 text-xs font-medium truncate">
            File Preview
            <span className="ml-1 text-gray-500">(example.txt)</span>
          </span>
          <RefreshTimer
            interval={20}
            onRefresh={handleRefresh}
            loading={loading}
            className="text-[9px]"
          />
        </div>

        {/* Content */}
        <div className="p-3 bg-amber-50 dark:bg-amber-900/30 min-h-[100px]">
          <pre className="text-xs font-mono text-gray-700 dark:text-gray-300">
            {content}
          </pre>
        </div>
      </div>
    </div>
  )
}

export const FilePreviewContext = {
  render: () => <FilePreviewContextExample />,
  parameters: {
    controls: { disable: true },
  },
}
