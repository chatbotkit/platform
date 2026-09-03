import { Form } from './index'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('@/prisma/client', () => ({}))

// @note the generated prisma enums map each name onto itself, and the secrets
// built below carry the same values a real one would - mocking them as labels
// would leave nothing here matching anything
jest.mock('@/prisma/enums', () => ({
  SecretKind: {
    shared: 'shared',
    personal: 'personal',
  },
  SecretType: {
    plain: 'plain',
    basic: 'basic',
    bearer: 'bearer',
    jwt: 'jwt',
    oauth: 'oauth',
    template: 'template',
    reference: 'reference',
  },
  SecretVisibility: {
    private: 'private',
    protected: 'protected',
    public: 'public',
  },
}))
jest.mock('@/prisma/zod', () => ({ SecretConfig: {} }))

jest.mock('@/lib/form', () => ({ formToData: jest.fn(() => ({})) }))
jest.mock('@/lib/secret.name', () => ({
  normalizeSecretName: jest.fn((value) => value || ''),
}))
jest.mock('@/lib/session.get', () => ({ getSoftSession: jest.fn() }))
jest.mock('@/lib/solution', () => ({ withSecretResources: jest.fn() }))
jest.mock('@/lib/struct', () => ({ makeJsonSafe: jest.fn((value) => value) }))
jest.mock('@/lib/toast', () => ({
  error: jest.fn(),
  success: jest.fn(),
}))

jest.mock(
  '@/layouts/Dashboard',
  () =>
    function Dashboard({ children }) {
      return <div data-testid="dashboard-layout">{children}</div>
    }
)

jest.mock(
  '@/components/AutoTextarea',
  () =>
    function AutoTextarea(props) {
      return <textarea {...props} />
    }
)
jest.mock(
  '@/components/BackLink',
  () =>
    function BackLink({ children, href, ...props }) {
      return (
        <a href={href} {...props}>
          {children}
        </a>
      )
    }
)
jest.mock(
  '@/components/CodeAction',
  () =>
    function CodeAction() {
      return null
    }
)
jest.mock('@/components/Confirm', () => ({
  useConfirmDelete: jest.fn(() => jest.fn()),
}))
jest.mock('@/components/CopyButton', () => ({
  copyTextToClipboard: jest.fn(),
}))
jest.mock(
  '@/components/EventLog',
  () =>
    function EventLog() {
      return null
    }
)
jest.mock(
  '@/components/Expando',
  () =>
    function Expando({ children }) {
      return <div>{children}</div>
    }
)
jest.mock(
  '@/components/FAQ',
  () =>
    function FAQ() {
      return null
    }
)
jest.mock(
  '@/components/Headline',
  () =>
    function Headline({ children }) {
      return <div>{children}</div>
    }
)
jest.mock(
  '@/components/List',
  () =>
    function List({ children }) {
      return <div>{children}</div>
    }
)
jest.mock(
  '@/components/MetaInput',
  () =>
    function MetaInput() {
      return <div data-testid="meta-input" />
    }
)
jest.mock(
  '@/components/NavHeader',
  () =>
    function NavHeader({ children }) {
      return <div>{children}</div>
    }
)
jest.mock(
  '@/components/SecretConfigInput',
  () =>
    function SecretConfigInput() {
      return <div data-testid="secret-config-input" />
    }
)
jest.mock(
  '@/components/PageSections',
  () =>
    function PageSections({ children }) {
      return <div>{children}</div>
    }
)
jest.mock(
  '@/components/RevealTextarea',
  () =>
    function RevealTextarea({ token, setToken, ...props }) {
      return (
        <textarea
          {...props}
          value={token || ''}
          onChange={(event) => setToken(event.target.value)}
        />
      )
    }
)
jest.mock(
  '@/components/ThisSolution',
  () =>
    function ThisSolution() {
      return null
    }
)

jest.mock('@/hooks/useFetch', () =>
  jest.fn(() => ({
    code: null,
    fetch: jest.fn(),
  }))
)
jest.mock('@/hooks/useRouter', () => jest.fn(() => ({ push: jest.fn() })))

jest.mock('@/content/faqs/platform-secret-instance.yaml', () => ({}))

function buildSecret(overrides = {}) {
  return {
    id: 'secret_123',
    name: 'Test Secret',
    description: 'Description',
    kind: 'shared',
    type: 'oauth',
    value: '',
    config: {
      clientId: 'client-id',
      clientSecret: 'client-secret',
      authorizationUrl: 'https://example.com/authorize',
      tokenUrl: 'https://example.com/token',
    },
    alias: '',
    visibility: 'private',
    meta: {},
    abilities: [],
    ...overrides,
  }
}

function renderAuthenticateButton(overrides) {
  render(<Form secret={buildSecret(overrides)} />)

  return screen.getByRole('button', { name: 'Authenticate' })
}

describe('Secret Form', () => {
  it('enables Authenticate for shared secrets', () => {
    expect(renderAuthenticateButton({ kind: 'shared' })).toBeEnabled()
  })

  it('enables Authenticate for a template secret naming its template', () => {
    expect(
      renderAuthenticateButton({
        type: 'template',
        config: { template: '@platform/google' },
      })
    ).toBeEnabled()
  })

  it('enables Authenticate for an oauth secret using the discovery flow', () => {
    expect(
      renderAuthenticateButton({
        config: { resourceUrl: 'https://example.com/.well-known/resource' },
      })
    ).toBeEnabled()
  })

  it('disables Authenticate for personal secrets', () => {
    expect(renderAuthenticateButton({ kind: 'personal' })).toBeDisabled()
  })

  it('disables Authenticate for an oauth secret missing its config', () => {
    expect(
      renderAuthenticateButton({ config: { clientId: 'client-id' } })
    ).toBeDisabled()
  })

  it('disables Authenticate for a template secret naming no template', () => {
    expect(
      renderAuthenticateButton({ type: 'template', config: {} })
    ).toBeDisabled()
  })

  // @note these have no authentication flow to complete - they are values you
  // type in, and the authenticate manager rejects them outright
  it.each(['plain', 'basic', 'bearer', 'jwt', 'reference'])(
    'disables Authenticate for %s secrets',
    (type) => {
      expect(
        renderAuthenticateButton({
          type,
          value: 'a-typed-in-value',
          config: {},
        })
      ).toBeDisabled()
    }
  )
})
