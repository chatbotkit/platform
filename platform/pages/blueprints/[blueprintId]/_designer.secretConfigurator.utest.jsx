import { SecretConfigurator } from './designer'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('@/prisma/client', () => ({}))
jest.mock('@/lib/toast', () => ({ success: jest.fn(), error: jest.fn() }))
jest.mock('@chatbotkit/react/hooks/useWidgetInstance', () => ({
  __esModule: true,
  default: jest.fn(),
}))
jest.mock('@chatbotkit/react/hooks/useWidgetInstanceFunctions', () => ({
  __esModule: true,
  default: jest.fn(),
}))
jest.mock('@/hooks/useDOMQuerySelector', () => ({
  __esModule: true,
  default: jest.fn(() => [document.body]),
}))
jest.mock('@/hooks/useRouter', () => ({
  __esModule: true,
  default: jest.fn(() => ({ push: jest.fn(), refresh: jest.fn() })),
}))
jest.mock('@/hooks/useFetch', () => ({
  __esModule: true,
  default: jest.fn(() => ({ code: null, fetch: jest.fn() })),
}))
jest.mock('@/components/TooltipButton', () => ({
  __esModule: true,
  default: function TooltipButton({ caption, children, ...props }) {
    return <div {...props}>{caption || children}</div>
  },
}))
jest.mock('@/components/CopyButton', () => ({
  __esModule: true,
  default: function CopyButton({ children, ...props }) {
    return (
      <button type="button" {...props}>
        {children}
      </button>
    )
  },
  copyTextToClipboard: jest.fn(),
}))
// @note the configurator renders its actions as children of the panel, which is
// what we are here to look at
jest.mock('@/components/SchemaPanel', () => ({
  __esModule: true,
  default: {
    Saving: function MockSchemaPanelSaving({ children }) {
      return <div>{children}</div>
    },
  },
}))
jest.mock('@xyflow/react', () => ({
  Background: jest.fn(),
  BaseEdge: jest.fn(),
  ConnectionLineType: {},
  ControlButton: jest.fn(),
  Controls: jest.fn(),
  EdgeLabelRenderer: jest.fn(),
  Handle: jest.fn(),
  MiniMap: jest.fn(),
  NodeResizer: jest.fn(),
  Position: {},
  ReactFlow: jest.fn(),
  ReactFlowProvider: jest.fn(),
  addEdge: jest.fn(),
  getSmoothStepPath: jest.fn(),
  useConnection: jest.fn(),
  useEdgesState: jest.fn(() => [[], jest.fn(), jest.fn()]),
  useNodeConnections: jest.fn(),
  useNodesInitialized: jest.fn(() => false),
  useNodesState: jest.fn(() => [[], jest.fn(), jest.fn()]),
  useOnSelectionChange: jest.fn(),
  useReactFlow: jest.fn(() => ({
    getNodes: jest.fn(() => []),
    getEdges: jest.fn(() => []),
    getNode: jest.fn(() => ({ position: { x: 0, y: 0 } })),
    setNodes: jest.fn(),
    setEdges: jest.fn(),
    addNodes: jest.fn(),
    addEdges: jest.fn(),
    fitView: jest.fn(),
    screenToFlowPosition: jest.fn(),
    updateNode: jest.fn(),
    deleteElements: jest.fn(),
  })),
  useUpdateNodeInternals: jest.fn(),
}))
jest.mock('@dagrejs/dagre', () => ({
  graphlib: {
    Graph: jest.fn(() => ({
      setDefaultEdgeLabel: jest.fn().mockReturnThis(),
      setGraph: jest.fn(),
      setNode: jest.fn(),
      setEdge: jest.fn(),
      node: jest.fn(() => ({ x: 0, y: 0 })),
    })),
  },
  layout: jest.fn(),
}))

const OAUTH_CONFIG = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  authorizationUrl: 'https://example.com/authorize',
  tokenUrl: 'https://example.com/token',
}

function renderAuthenticateButton({ id = 'secret_123', ...data } = {}) {
  render(
    <SecretConfigurator
      id={id}
      data={{ kind: 'shared', type: 'oauth', config: OAUTH_CONFIG, ...data }}
      // @note the configurator reshapes this by kind and type, and expects the
      // value field to be there to reshape
      schema={{ value: {} }}
    />
  )

  return screen.getByRole('button', { name: 'Authenticate' })
}

describe('SecretConfigurator', () => {
  describe('the Authenticate button', () => {
    it('is enabled for a saved oauth secret carrying its config', () => {
      expect(renderAuthenticateButton()).toBeEnabled()
    })

    it('is enabled for an oauth secret using the discovery flow', () => {
      expect(
        renderAuthenticateButton({
          config: { resourceUrl: 'https://example.com/.well-known/resource' },
        })
      ).toBeEnabled()
    })

    it('is enabled for a template secret naming its template', () => {
      expect(
        renderAuthenticateButton({
          type: 'template',
          config: { template: '@platform/google' },
        })
      ).toBeEnabled()
    })

    // @note a node which is yet to be saved has no secret to authenticate
    it('is disabled while the secret is still a temporary node', () => {
      expect(renderAuthenticateButton({ id: '#draft' })).toBeDisabled()
    })

    it('is disabled for personal secrets', () => {
      expect(renderAuthenticateButton({ kind: 'personal' })).toBeDisabled()
    })

    it('is disabled for an oauth secret missing its config', () => {
      expect(
        renderAuthenticateButton({ config: { clientId: 'client-id' } })
      ).toBeDisabled()
    })

    it('is disabled for a template secret naming no template', () => {
      expect(
        renderAuthenticateButton({ type: 'template', config: {} })
      ).toBeDisabled()
    })

    // @note these have no authentication flow to complete - they are values you
    // type in, and the authenticate manager rejects them outright
    it.each(['plain', 'basic', 'bearer', 'jwt', 'reference'])(
      'is disabled for %s secrets',
      (type) => {
        expect(renderAuthenticateButton({ type, config: {} })).toBeDisabled()
      }
    )
  })

  describe('the disabled hint', () => {
    it('explains that a temporary node must be saved first', () => {
      renderAuthenticateButton({ id: '#draft' })

      expect(screen.getByText(/save this secret/i)).toBeInTheDocument()
    })

    it('explains that personal secrets are authenticated per contact', () => {
      renderAuthenticateButton({ kind: 'personal' })

      expect(screen.getByText(/each contact/i)).toBeInTheDocument()
    })

    it('shows no hint once the secret can be authenticated', () => {
      renderAuthenticateButton()

      expect(
        screen.queryByText(/before you can authenticate/i)
      ).not.toBeInTheDocument()
    })
  })
})
