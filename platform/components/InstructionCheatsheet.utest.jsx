import InstructionCheatsheet from './InstructionCheatsheet'

import { render, screen } from '@testing-library/react'

jest.mock('@/components/Expando', () => {
  return function Expando({ title, titleClassName, children }) {
    return (
      <section data-testid="expando">
        <h2 className={titleClassName}>{title}</h2>
        {children}
      </section>
    )
  }
})

describe('InstructionCheatsheet', () => {
  it('renders title and key syntax rows', () => {
    render(<InstructionCheatsheet />)

    expect(screen.getByText('Instruction Cheat Sheet')).toBeTruthy()
    expect(screen.getByText('Use a specific action')).toBeTruthy()
    expect(
      screen.getByText('Reference the current conversation ID')
    ).toBeTruthy()
    expect(
      screen.getByText(
        'Reference the ID of contact associated with the conversation.'
      )
    ).toBeTruthy()
  })

  it('renders secrets and bot placeholders in code cells', () => {
    render(<InstructionCheatsheet />)

    expect(screen.getByText('${SECRET_ID}')).toBeTruthy()
    expect(screen.getByText('${SECRET_DEFAULT}')).toBeTruthy()
    expect(screen.getByText('${BOT_ID}')).toBeTruthy()
    expect(screen.getByText('${CONTACT_META_FIELD}')).toBeTruthy()
  })
})
