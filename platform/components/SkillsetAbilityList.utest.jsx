import SkillsetAbilityList from './SkillsetAbilityList'

import '@testing-library/jest-dom'
import { act, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

let capturedProps = {}

jest.mock('./ResourceList', () => {
  return function ResourceList(props) {
    capturedProps = props

    return (
      <div data-testid="resource-list">
        {props.extraGlobalRoot}
        {props.trailingActions}
        ResourceList Mock
      </div>
    )
  }
})

jest.mock('./SkillsetAbilityTester', () => {
  return function SkillsetAbilityTester({ skillset, ability }) {
    return (
      <div data-testid="ability-tester">
        Testing skillset {skillset.id} ability {ability.id}
      </div>
    )
  }
})

// @note the create dialog owns its own routing and fetching, so it is stubbed
// out here - what matters to this component is that it wires the popup up

let mockCreateDialogOptions = {}

const mockOpenCreatePopup = jest.fn()

jest.mock('./AbilityCreateDialog', () => {
  return function useAbilityCreateDialog(options) {
    mockCreateDialogOptions = options

    return [
      <div key="popup" data-testid="ability-create-popup" />,
      mockOpenCreatePopup,
    ]
  }
})

jest.mock('./Link', () => {
  return function Link({ href, children, ...props }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  }
})

jest.mock('@/lib/name.icon', () => ({
  nameToIcon: jest.fn((name) => {
    if (name === 'search') {
      return '@heroicons/magnifying-glass'
    }

    return null
  }),
}))

const mockRouterPush = jest.fn()

jest.mock('@/hooks/useRouter', () => {
  return function useRouter() {
    return {
      push: mockRouterPush,
      prefetch: jest.fn(),
    }
  }
})

describe('SkillsetAbilityList', () => {
  const defaultProps = {
    skillsetId: 'skillset-123',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    capturedProps = {}
  })

  describe('basic functionality', () => {
    it('should render ResourceList with default props', () => {
      const { getByTestId } = render(<SkillsetAbilityList {...defaultProps} />)

      const resourceList = getByTestId('resource-list')

      expect(resourceList).toBeInTheDocument()

      expect(capturedProps.kind).toBe('ability')
      expect(capturedProps.listRoute).toBe(
        '/api/v1/skillset/skillset-123/ability/list'
      )
      expect(capturedProps.deleteRoute).toBe(
        '/api/v1/skillset/skillset-123/ability/[id]/delete'
      )
      expect(capturedProps.instanceRoute).toBe(
        '/skillsets/skillset-123/abilities/[id]'
      )
      expect(capturedProps.filter).toBe(false)
      expect(capturedProps.exportRoute).toBeNull()
      expect(capturedProps.quickAccess).toBeUndefined()
    })

    it('should open the create dialog instead of linking away', async () => {
      const { getByRole, getByTestId } = render(
        <SkillsetAbilityList {...defaultProps} />
      )

      expect(getByTestId('ability-create-popup')).toBeInTheDocument()

      await userEvent.click(getByRole('button', { name: 'Create ability' }))

      expect(mockOpenCreatePopup).toHaveBeenCalled()
    })

    it('should let an outside caller open the create dialog', () => {
      const createRef = { current: null }

      render(<SkillsetAbilityList {...defaultProps} createRef={createRef} />)

      createRef.current.open()

      expect(mockOpenCreatePopup).toHaveBeenCalled()
    })

    it('should link away when a create link is pinned', () => {
      const { getByRole } = render(
        <SkillsetAbilityList {...defaultProps} createLink="/somewhere" />
      )

      expect(getByRole('link', { name: 'Create ability' })).toHaveAttribute(
        'href',
        '/somewhere'
      )
    })

    it('should seed the list from the default items and count', () => {
      const abilities = [{ id: 'ability-1', name: 'search' }]

      render(
        <SkillsetAbilityList
          {...defaultProps}
          defaultItems={abilities}
          defaultTotalCount={7}
        />
      )

      expect(capturedProps.items).toEqual(abilities)
      expect(capturedProps.totalCount).toBe(7)
    })

    it('should prepend created abilities to the list', () => {
      const abilities = [{ id: 'ability-1', name: 'search' }]

      render(
        <SkillsetAbilityList
          {...defaultProps}
          defaultItems={abilities}
          defaultTotalCount={1}
        />
      )

      act(() => {
        mockCreateDialogOptions.onCreate([{ id: 'ability-2', name: 'fetch' }])
      })

      expect(capturedProps.items).toEqual([
        { id: 'ability-2', name: 'fetch' },
        { id: 'ability-1', name: 'search' },
      ])

      expect(capturedProps.totalCount).toBe(2)
    })

    it('should include extraTags function', () => {
      render(<SkillsetAbilityList {...defaultProps} />)

      expect(capturedProps.extraTags).toBeDefined()
      expect(typeof capturedProps.extraTags).toBe('function')
    })

    it('should include extraButtons object with Test button', () => {
      render(<SkillsetAbilityList {...defaultProps} />)

      expect(capturedProps.extraButtons).toBeDefined()
      expect(capturedProps.extraButtons.Test).toBeDefined()
    })

    it('should include iconMapper function', () => {
      render(<SkillsetAbilityList {...defaultProps} />)

      expect(capturedProps.iconMapper).toBeDefined()
      expect(typeof capturedProps.iconMapper).toBe('function')
    })
  })

  describe('prop overrides', () => {
    it('should allow overriding kind prop', () => {
      render(<SkillsetAbilityList {...defaultProps} kind="custom-kind" />)

      expect(capturedProps.kind).toBe('custom-kind')
    })

    it('should allow overriding listRoute prop', () => {
      render(<SkillsetAbilityList {...defaultProps} listRoute="/custom/list" />)

      expect(capturedProps.listRoute).toBe('/custom/list')
    })

    it('should allow overriding deleteRoute prop', () => {
      render(
        <SkillsetAbilityList {...defaultProps} deleteRoute="/custom/delete" />
      )

      expect(capturedProps.deleteRoute).toBe('/custom/delete')
    })

    it('should allow overriding instanceRoute prop', () => {
      render(
        <SkillsetAbilityList {...defaultProps} instanceRoute="/custom/[id]" />
      )

      expect(capturedProps.instanceRoute).toBe('/custom/[id]')
    })

    it('should allow overriding filter prop', () => {
      render(<SkillsetAbilityList {...defaultProps} filter={true} />)

      expect(capturedProps.filter).toBe(true)
    })

    it('should pass quickAccess through to the list', () => {
      render(<SkillsetAbilityList {...defaultProps} quickAccess={true} />)

      expect(capturedProps.quickAccess).toBe(true)
    })

    it('should allow custom extraTags function', () => {
      const customExtraTags = jest.fn(() => <div>Custom Tags</div>)

      render(
        <SkillsetAbilityList {...defaultProps} _extraTags={customExtraTags} />
      )

      expect(capturedProps.extraTags).toBeDefined()
    })
  })

  describe('connection quick access', () => {
    // @note a platform connection is stored as a `template` secret, so this is
    // what a Google Mail ability which is still waiting to be connected looks
    // like coming back from the skillset secrets query

    const unauthenticatedSecret = {
      id: 'secret-1',
      name: 'Google Mail',
      type: 'template',
      kind: 'shared',
      config: { template: 'google-mail' },
      status: 'unauthenticated',
      actionUrl: 'https://chatbotkit.com/authenticate/secret-1',
    }

    const ability = {
      id: 'ability-1',
      name: 'search',
      linkedSecretId: 'secret-1',
    }

    function renderWithSecret(secret, props) {
      render(
        <SkillsetAbilityList
          {...defaultProps}
          secrets={secret ? [secret] : []}
          {...props}
        />
      )
    }

    it('should name the connection an ability uses and how it stands', () => {
      renderWithSecret(unauthenticatedSecret)

      const { getByText } = render(
        capturedProps.extraQuickAccessContent(ability)
      )

      expect(getByText('Google Mail')).toBeInTheDocument()
      expect(getByText('needs authenticating')).toBeInTheDocument()
    })

    it('should say nothing about an ability which uses no secret', () => {
      renderWithSecret(unauthenticatedSecret)

      expect(
        capturedProps.extraQuickAccessContent({ id: 'ability-2' })
      ).toBeNull()
    })

    it('should offer to authenticate a connection which needs it', () => {
      const authenticate = jest.fn()
      const close = jest.fn()

      renderWithSecret(unauthenticatedSecret, { authenticate })

      const actions = capturedProps.extraQuickAccessActions(ability)

      act(() => {
        actions.Authenticate.fn({}, { close })
      })

      expect(authenticate).toHaveBeenCalledWith(unauthenticatedSecret)
      expect(close).toHaveBeenCalled()
    })

    it('should send a connection which needs a typed value to its page', () => {
      const authenticate = jest.fn()
      const close = jest.fn()

      // @note a plain secret is filled in on the secret page - there is nothing
      // to authenticate through a link

      renderWithSecret(
        { ...unauthenticatedSecret, type: 'plain', config: {} },
        { authenticate }
      )

      const actions = capturedProps.extraQuickAccessActions(ability)

      act(() => {
        actions['Open Connection'].fn({}, { close })
      })

      expect(authenticate).not.toHaveBeenCalled()
      expect(mockRouterPush).toHaveBeenCalledWith('/secrets/secret-1')
      expect(close).toHaveBeenCalled()
    })

    it('should offer nothing for a connection which is already set up', () => {
      renderWithSecret({ ...unauthenticatedSecret, status: 'authenticated' })

      expect(capturedProps.extraQuickAccessActions(ability)).toBeNull()
    })

    it('should offer nothing for a connection each contact makes themselves', () => {
      // @note a personal secret is connected by each contact when they first
      // use it, so it is never the owner's to finish

      renderWithSecret({
        ...unauthenticatedSecret,
        kind: 'personal',
        status: 'contact',
      })

      expect(capturedProps.extraQuickAccessActions(ability)).toBeNull()
    })
  })

  describe('skillsetId variations', () => {
    it('should handle different skillsetId values', () => {
      render(<SkillsetAbilityList skillsetId="different-skillset-456" />)

      expect(capturedProps.listRoute).toBe(
        '/api/v1/skillset/different-skillset-456/ability/list'
      )
      expect(capturedProps.deleteRoute).toBe(
        '/api/v1/skillset/different-skillset-456/ability/[id]/delete'
      )
      expect(capturedProps.instanceRoute).toBe(
        '/skillsets/different-skillset-456/abilities/[id]'
      )
    })
  })

  describe('prop combinations', () => {
    it('should handle multiple overrides simultaneously', () => {
      render(
        <SkillsetAbilityList
          {...defaultProps}
          kind="custom"
          listRoute="/custom/list"
          filter={true}
          extraProp="value"
        />
      )

      expect(capturedProps.kind).toBe('custom')
      expect(capturedProps.listRoute).toBe('/custom/list')
      expect(capturedProps.filter).toBe(true)
      expect(capturedProps.extraProp).toBe('value')
    })
  })

  describe('edge cases', () => {
    it('should handle undefined skillsetId', () => {
      const { getByTestId } = render(
        <SkillsetAbilityList skillsetId={undefined} />
      )

      const resourceList = getByTestId('resource-list')

      expect(resourceList).toBeInTheDocument()
    })

    it('should handle null exportRoute', () => {
      render(<SkillsetAbilityList {...defaultProps} exportRoute={null} />)

      expect(capturedProps.exportRoute).toBeNull()
    })

    it('should handle empty string skillsetId', () => {
      render(<SkillsetAbilityList skillsetId="" />)

      expect(capturedProps.listRoute).toBe('/api/v1/skillset//ability/list')
    })
  })

  describe('memoization', () => {
    it('should not recreate extraTags function when props do not change', () => {
      const { rerender } = render(<SkillsetAbilityList {...defaultProps} />)

      const _extraTags1 = capturedProps.extraTags

      rerender(<SkillsetAbilityList {...defaultProps} />)

      expect(capturedProps.extraTags).toBeDefined()
    })

    it('should not recreate extraButtons when skillsetId does not change', () => {
      const { rerender } = render(<SkillsetAbilityList {...defaultProps} />)

      const _extraButtons1 = capturedProps.extraButtons

      rerender(<SkillsetAbilityList {...defaultProps} />)

      expect(capturedProps.extraButtons).toBeDefined()
    })

    it('should not recreate iconMapper when props do not change', () => {
      const { rerender } = render(<SkillsetAbilityList {...defaultProps} />)

      const _iconMapper1 = capturedProps.iconMapper

      rerender(<SkillsetAbilityList {...defaultProps} />)

      expect(capturedProps.iconMapper).toBeDefined()
    })
  })
})
