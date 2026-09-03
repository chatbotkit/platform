import { useEffect, useReducer } from 'react'

import { readSource } from '@/lib/source'
import { makeJsonSafe } from '@/lib/struct'

import Demo, { SideBySidePage } from '@/layouts/Demo'

import DotsLoader from '@/components/DotsLoader'
import List from '@/components/List'

// source start
import useWidgetInstance from '@chatbotkit/react/hooks/useWidgetInstance'
import {
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline'

import clsx from 'clsx'

const VULNERABILITIES = [
  {
    id: 'vuln-001',
    title: 'Outdated OpenSSL Version',
    severity: 'critical',
    description:
      'Server is running OpenSSL 1.0.2k which has known CVE vulnerabilities. Should be upgraded to 3.0.x or later.',
    affectedSystem: 'Web Server (nginx)',
    cve: 'CVE-2022-0778, CVE-2021-3712',
    status: 'pending',
  },
  {
    id: 'vuln-002',
    title: 'Unpatched SSH Daemon',
    severity: 'high',
    description:
      'SSH daemon version 7.4 is vulnerable to authentication bypass. Update to version 8.0 or later recommended.',
    affectedSystem: 'SSH Server',
    cve: 'CVE-2021-28041',
    status: 'pending',
  },
  {
    id: 'vuln-003',
    title: 'Weak TLS Configuration',
    severity: 'medium',
    description:
      'TLS 1.0 and 1.1 are still enabled. These protocols are deprecated and should be disabled.',
    affectedSystem: 'Load Balancer',
    cve: 'N/A',
    status: 'pending',
  },
  {
    id: 'vuln-004',
    title: 'Kernel Security Patch Missing',
    severity: 'high',
    description:
      'Linux kernel 4.15.0 is missing critical security patches. Update to latest stable kernel recommended.',
    affectedSystem: 'Operating System',
    cve: 'CVE-2023-32233, CVE-2023-2002',
    status: 'pending',
  },
  {
    id: 'vuln-005',
    title: 'Docker Container Running as Root',
    severity: 'medium',
    description:
      'Application containers are running with root privileges, increasing attack surface.',
    affectedSystem: 'Container Runtime',
    cve: 'N/A',
    status: 'pending',
  },
]

const SEVERITY_COLORS = {
  critical: 'text-red-600 dark:text-red-400',
  high: 'text-orange-600 dark:text-orange-400',
  medium: 'text-yellow-600 dark:text-yellow-400',
  low: 'text-blue-600 dark:text-blue-400',
}

const SEVERITY_BG = {
  critical: 'bg-red-100 dark:bg-red-900/30',
  high: 'bg-orange-100 dark:bg-orange-900/30',
  medium: 'bg-yellow-100 dark:bg-yellow-900/30',
  low: 'bg-blue-100 dark:bg-blue-900/30',
}

/**
 * The reducer function manages the state of all vulnerabilities
 */
function reducer(state, action) {
  const { type, id, data } = action

  switch (type) {
    case 'SET_SELECTED': {
      return {
        ...state,
        selectedId: id,
      }
    }

    case 'UPDATE_STATUS': {
      return {
        ...state,
        vulnerabilities: state.vulnerabilities.map((vuln) =>
          vuln.id === id ? { ...vuln, status: data.status } : vuln
        ),
      }
    }

    case 'UPDATE_VULNERABILITY': {
      return {
        ...state,
        vulnerabilities: state.vulnerabilities.map((vuln) =>
          vuln.id === id ? { ...vuln, ...data } : vuln
        ),
      }
    }

    default: {
      return state
    }
  }
}

/**
 * VulnerabilityList component displays all security vulnerabilities
 */
function VulnerabilityList({ vulnerabilities, selectedId, onSelect }) {
  const widget = useWidgetInstance('chatbotkit-widget')

  return (
    <div className="w-full h-full overflow-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold auto-text-gray-900">
          Security Vulnerabilities
        </h2>
        <p className="mt-2 text-sm auto-text-gray-600">
          Click on a vulnerability to discuss patching options with the AI
          assistant
        </p>
      </div>
      <List>
        {vulnerabilities.map((vuln) => (
          <List.Item
            key={vuln.id}
            icon={
              <div
                className={clsx(
                  'flex items-center justify-center w-12 h-12 rounded-full',
                  SEVERITY_BG[vuln.severity]
                )}
              >
                {vuln.severity === 'critical' ? (
                  <ShieldExclamationIcon
                    className={clsx('w-6 h-6', SEVERITY_COLORS[vuln.severity])}
                  />
                ) : (
                  <ExclamationTriangleIcon
                    className={clsx('w-6 h-6', SEVERITY_COLORS[vuln.severity])}
                  />
                )}
              </div>
            }
            title={vuln.title}
            body={vuln.description}
            selected={selectedId === vuln.id}
            onClick={() => onSelect(vuln.id)}
            actions={{
              Explain: () => {
                if (widget) {
                  widget.sendMessage({
                    message: `Tell me about the vulnerability: ${vuln.id}`,
                    hidden: true,
                    respond: true,
                  })
                }
              },
            }}
          >
            <div className="flex flex-wrap gap-2">
              <span
                className={clsx(
                  'px-2 py-1 text-xs font-medium rounded',
                  SEVERITY_BG[vuln.severity],
                  SEVERITY_COLORS[vuln.severity]
                )}
              >
                {vuln.severity.toUpperCase()}
              </span>
              <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 dark:bg-gray-800 auto-text-gray-700">
                {vuln.affectedSystem}
              </span>
              {vuln.status === 'patching' && (
                <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                  PATCHING...
                </span>
              )}
              {vuln.status === 'patched' && (
                <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                  PATCHED
                </span>
              )}
            </div>
          </List.Item>
        ))}
      </List>
    </div>
  )
}

/**
 * The example demonstrates how to build an intelligent security patching widget
 * that helps users understand and remediate infrastructure vulnerabilities.
 */
export default function Page() {
  const [state, dispatch] = useReducer(reducer, {
    vulnerabilities: VULNERABILITIES,
    selectedId: null,
  })

  const widget = useWidgetInstance('chatbotkit-widget', {
    waitForReady: true,
  })

  useEffect(() => {
    if (!widget) {
      return
    }

    // Setup the functions available to the AI assistant

    widget.functions = {
      getVulnerabilities: {
        description:
          'Get a list of all security vulnerabilities that need patching',
        parameters: {
          type: 'object',
          properties: {},
        },
        handler: async () => {
          return {
            vulnerabilities: state.vulnerabilities.map((v) => ({
              id: v.id,
              title: v.title,
              severity: v.severity,
              description: v.description,
              affectedSystem: v.affectedSystem,
              cve: v.cve,
              status: v.status,
            })),
          }
        },
      },

      getVulnerabilityDetails: {
        description: 'Get detailed information about a specific vulnerability',
        parameters: {
          type: 'object',
          properties: {
            vulnerabilityId: {
              type: 'string',
              description: 'The ID of the vulnerability to get details for',
            },
          },
          required: ['vulnerabilityId'],
        },
        handler: async ({ vulnerabilityId }) => {
          const vuln = state.vulnerabilities.find(
            (v) => v.id === vulnerabilityId
          )

          if (!vuln) {
            return {
              error: 'Vulnerability not found',
            }
          }

          dispatch({ type: 'SET_SELECTED', id: vulnerabilityId })

          return {
            vulnerability: vuln,
          }
        },
      },

      patchVulnerability: {
        description:
          'Apply a patch to fix a security vulnerability. This simulates running the patching process.',
        parameters: {
          type: 'object',
          properties: {
            vulnerabilityId: {
              type: 'string',
              description: 'The ID of the vulnerability to patch',
            },
            patchMethod: {
              type: 'string',
              description:
                'The method to use for patching (e.g., "upgrade", "configuration-change", "hotfix")',
            },
          },
          required: ['vulnerabilityId'],
        },
        handler: async ({ vulnerabilityId, patchMethod = 'upgrade' }) => {
          const vuln = state.vulnerabilities.find(
            (v) => v.id === vulnerabilityId
          )

          if (!vuln) {
            return {
              error: 'Vulnerability not found',
            }
          }

          if (vuln.status === 'patched') {
            return {
              message: 'This vulnerability has already been patched',
              vulnerability: vuln,
            }
          }

          // Simulate patching process
          dispatch({
            type: 'UPDATE_STATUS',
            id: vulnerabilityId,
            data: { status: 'patching' },
          })

          // Simulate delay for patching
          await new Promise((resolve) => setTimeout(resolve, 2000))

          dispatch({
            type: 'UPDATE_STATUS',
            id: vulnerabilityId,
            data: { status: 'patched' },
          })

          return {
            success: true,
            message: `Successfully patched ${vuln.title} using ${patchMethod} method`,
            vulnerability: {
              ...vuln,
              status: 'patched',
            },
          }
        },
      },

      getSeverityStats: {
        description:
          'Get statistics about vulnerabilities grouped by severity level',
        parameters: {
          type: 'object',
          properties: {},
        },
        handler: async () => {
          const stats = state.vulnerabilities.reduce(
            (acc, vuln) => {
              acc[vuln.severity] = (acc[vuln.severity] || 0) + 1

              if (vuln.status === 'patched') {
                acc.patched = (acc.patched || 0) + 1
              }

              return acc
            },
            { patched: 0 }
          )

          return {
            total: state.vulnerabilities.length,
            ...stats,
          }
        },
      },
    }
  }, [widget, state, dispatch])

  return (
    <SideBySidePage>
      <VulnerabilityList
        vulnerabilities={state.vulnerabilities}
        selectedId={state.selectedId}
        onSelect={(id) => dispatch({ type: 'SET_SELECTED', id })}
      />
      <div className="relative border border-1 border-gray-200 rounded-xl overflow-hidden flex min-w-[30rem] max-w-[60rem] shadow-lg">
        <chatbotkit-widget
          class="flex-1 w-full h-full"
          widget="/examples/patch-assistant/frame"
        />
        <div
          className={clsx('absolute inset-0 flex items-center justify-center', {
            hidden: !!widget,
          })}
        >
          <DotsLoader className="text-xl text-gray-500 dark:text-gray-500" />
        </div>
      </div>
    </SideBySidePage>
  )
}

// source end

Page.getLayout = function getLayout(children, { source }) {
  return (
    <Demo
      title="Security Vulnerability Patching"
      description="This demo shows how to build an intelligent widget for patching security vulnerabilities with conversational AI assistance."
      slug="patch-assistant"
      source={source}
    >
      {children}
    </Demo>
  )
}

Page.theme = 'light'

export async function getStaticProps() {
  const source = readSource('./pages/examples/patch-assistant/demo/index.jsx')

  return {
    props: makeJsonSafe({
      source,
    }),
  }
}
