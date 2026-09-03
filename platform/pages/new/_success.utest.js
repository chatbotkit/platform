import { wizardContext } from '@/layouts/Wizard'

import useBuilderExperience from '@/hooks/useBuilderExperience'

import Page from './success'

import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('@/hooks/useBuilderExperience', () => jest.fn())

jest.mock('@/layouts/Wizard', () => {
  const React = jest.requireActual('react')

  return {
    __esModule: true,
    default: ({ children }) => children,
    Heading: () => null,
    wizardContext: React.createContext(),
  }
})

jest.mock('@/components/Link', () => {
  return function Link({ children, href, ...props }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  }
})

jest.mock('@/hooks/useSession', () => () => ({
  data: { user: { id: 'user_1' } },
}))

describe('new template success page', () => {
  beforeEach(() => {
    window.localStorage.clear()

    useBuilderExperience.mockReturnValue(false)
  })

  it.each([
    [
      'widget',
      '/integrations/widget/widget_1',
      'Continue to your Website Agent',
    ],
    [
      'messaging',
      '/integrations/slack/slack_1',
      'Continue to your Slack Agent',
    ],
  ])(
    'should prefer a created %s integration over the project return path',
    (_type, successButtonAction, successButtonCaption) => {
      render(
        <wizardContext.Provider
          value={{
            options: {
              projectScopeReturnPath: '/overview',
              createdBlueprintId: 'blueprint_1',
              successButtonAction,
              successButtonCaption,
            },
            values: {},
            loading: false,
            setLoading: jest.fn(),
          }}
        >
          <Page />
        </wizardContext.Provider>
      )

      expect(
        screen
          .getByRole('link', { name: successButtonCaption })
          .getAttribute('href')
      ).toBe(successButtonAction)
    }
  )

  it('should prefer any template action over the project return path', () => {
    render(
      <wizardContext.Provider
        value={{
          options: {
            projectScopeReturnPath: '/overview',
            createdBlueprintId: 'blueprint_1',
            successButtonAction: '/blueprints/blueprint_1/designer',
            successButtonCaption: 'Continue to your blueprint',
          },
          values: {},
          loading: false,
          setLoading: jest.fn(),
        }}
      >
        <Page />
      </wizardContext.Provider>
    )

    expect(
      screen
        .getByRole('link', { name: 'Continue to your blueprint' })
        .getAttribute('href')
    ).toBe('/blueprints/blueprint_1/designer')
  })

  it('should use the project return path when the template has no action', () => {
    render(
      <wizardContext.Provider
        value={{
          options: {
            projectScopeReturnPath: '/overview',
            createdBlueprintId: 'blueprint_1',
          },
          values: {},
          loading: false,
          setLoading: jest.fn(),
        }}
      >
        <Page />
      </wizardContext.Provider>
    )

    expect(
      screen
        .getByRole('link', { name: 'Use this project' })
        .getAttribute('href')
    ).toBe('/overview')
  })

  it('should default to overview when there is no template or return action', () => {
    render(
      <wizardContext.Provider
        value={{
          options: {
            createdBlueprintId: 'blueprint_1',
          },
          values: {},
          loading: false,
          setLoading: jest.fn(),
        }}
      >
        <Page />
      </wizardContext.Provider>
    )

    expect(screen.getByRole('link').getAttribute('href')).toBe('/overview')
  })

  it('should select the created project independently of a link action', () => {
    render(
      <wizardContext.Provider
        value={{
          options: {
            createdBlueprintId: 'blueprint_1',
            createdBlueprintName: 'Project One',
            successButtonAction: '/integrations/widget/widget_1',
            successButtonCaption: 'Continue to your Website Agent',
          },
          values: {},
          loading: false,
          setLoading: jest.fn(),
        }}
      >
        <Page />
      </wizardContext.Provider>
    )

    expect(window.localStorage.getItem('cbk.projectScope:user_1')).toBe(
      JSON.stringify({ id: 'blueprint_1', name: 'Project One' })
    )
  })

  it('should select the created project independently of a function action', () => {
    const successButtonAction = jest.fn()

    render(
      <wizardContext.Provider
        value={{
          options: {
            createdBlueprintId: 'blueprint_1',
            createdBlueprintName: 'Project One',
            successButtonAction,
            successButtonCaption: 'Continue',
          },
          values: {},
          loading: false,
          setLoading: jest.fn(),
        }}
      >
        <Page />
      </wizardContext.Provider>
    )

    expect(window.localStorage.getItem('cbk.projectScope:user_1')).toBe(
      JSON.stringify({ id: 'blueprint_1', name: 'Project One' })
    )

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(successButtonAction).toHaveBeenCalledTimes(1)
  })

  describe('builder experience', () => {
    beforeEach(() => {
      useBuilderExperience.mockReturnValue(true)
    })

    it.each([
      [
        'widget',
        '/integrations/widget/widget_1',
        'Continue to your Website Agent',
      ],
      [
        'messaging',
        '/integrations/slack/slack_1',
        'Continue to your Slack Agent',
      ],
      [
        'blueprint',
        '/blueprints/blueprint_1/designer',
        'Continue to your blueprint',
      ],
    ])(
      'should land on the project overview instead of the created %s resource',
      (_type, successButtonAction, successButtonCaption) => {
        render(
          <wizardContext.Provider
            value={{
              options: {
                createdBlueprintId: 'blueprint_1',
                createdBlueprintName: 'Project One',
                successButtonAction,
                successButtonCaption,
              },
              values: {},
              loading: false,
              setLoading: jest.fn(),
            }}
          >
            <Page />
          </wizardContext.Provider>
        )

        expect(
          screen.queryByRole('link', { name: successButtonCaption })
        ).toBeNull()

        expect(
          screen
            .getByRole('link', { name: 'Continue to your project' })
            .getAttribute('href')
        ).toBe('/overview')

        expect(window.localStorage.getItem('cbk.projectScope:user_1')).toBe(
          JSON.stringify({ id: 'blueprint_1', name: 'Project One' })
        )
      }
    )

    it('should return to the project scope path when one was requested', () => {
      render(
        <wizardContext.Provider
          value={{
            options: {
              projectScopeReturnPath: '/bots/bot_1',
              createdBlueprintId: 'blueprint_1',
              successButtonAction: '/integrations/widget/widget_1',
              successButtonCaption: 'Continue to your Website Agent',
            },
            values: {},
            loading: false,
            setLoading: jest.fn(),
          }}
        >
          <Page />
        </wizardContext.Provider>
      )

      expect(
        screen
          .getByRole('link', { name: 'Use this project' })
          .getAttribute('href')
      ).toBe('/bots/bot_1')
    })

    // @note onboarding forwards into the next template with a function action
    // and creates no project - it must not be redirected to the overview
    it('should leave a template that created no project alone', () => {
      const successButtonAction = jest.fn()

      render(
        <wizardContext.Provider
          value={{
            options: {
              successButtonAction,
              successButtonCaption: 'Continue setup',
            },
            values: {},
            loading: false,
            setLoading: jest.fn(),
          }}
        >
          <Page />
        </wizardContext.Provider>
      )

      fireEvent.click(screen.getByRole('button', { name: 'Continue setup' }))

      expect(successButtonAction).toHaveBeenCalledTimes(1)
    })
  })
})
