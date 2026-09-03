import ProjectScopeSelector from './ProjectScopeSelector'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

const mockPush = jest.fn()
const mockSetScope = jest.fn()

let mockScope = null
let mockProjects = []

jest.mock('@/hooks/useProjectScope', () =>
  jest.fn(() => ({
    hydrated: true,
    projectsHydrated: true,
    projects: mockProjects,
    scope: mockScope,
    setScope: mockSetScope,
  }))
)

jest.mock('@/hooks/useRouter', () =>
  jest.fn(() => ({
    asPath: '/bots',
    push: mockPush,
  }))
)

describe('ProjectScopeSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    mockScope = {
      id: 'blueprint_123',
      name: 'Project One',
    }

    mockProjects = [
      {
        id: 'blueprint_123',
        name: 'Project One',
      },
    ]
  })

  it('selects a project supplied by the project scope provider', async () => {
    mockScope = null

    render(<ProjectScopeSelector />)

    fireEvent.click(screen.getByRole('button', { name: /All projects/ }))
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Project One' })
    )

    expect(mockSetScope).toHaveBeenCalledWith({
      id: 'blueprint_123',
      name: 'Project One',
    })
  })

  it('launches the new wizard in project-scope return mode', async () => {
    render(<ProjectScopeSelector />)

    fireEvent.click(screen.getByRole('button', { name: /Project One/ }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'New project' }))

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/new',
      query: {
        projectScope: 'true',
        returnTo: '/bots',
      },
    })
  })

  it('opens the selected blueprint for editing', async () => {
    render(<ProjectScopeSelector />)

    fireEvent.click(screen.getByRole('button', { name: /Project One/ }))
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Edit project' })
    )

    expect(mockPush).toHaveBeenCalledWith('/blueprints/blueprint_123')
  })

  it('keeps the new project action at the bottom', async () => {
    render(<ProjectScopeSelector />)

    fireEvent.click(screen.getByRole('button', { name: /Project One/ }))

    await screen.findByRole('menuitem', { name: 'Project One' })

    const menuItems = screen.getAllByRole('menuitem')

    expect(menuItems.at(-1)).toHaveTextContent('New project')
  })

  it('does not use the orange scoped project styling', () => {
    render(<ProjectScopeSelector />)

    expect(
      screen.getByRole('button', { name: /Project One/ }).className
    ).not.toContain('orange')
  })
})
