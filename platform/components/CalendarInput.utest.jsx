import CalendarInput, { buildMonthGrid } from './CalendarInput'

import '@testing-library/jest-dom'
import { fireEvent, render } from '@testing-library/react'

describe('buildMonthGrid', () => {
  it('returns 6 aligned weeks (42 cells) spanning the month', () => {
    const grid = buildMonthGrid(2027, 11) // December 2027

    expect(grid).toHaveLength(42)

    // first cell is a Sunday, last cell is a Saturday
    expect(grid[0].getDay()).toBe(0)
    expect(grid[41].getDay()).toBe(6)

    // the month itself is fully covered
    const decemberDays = grid.filter((d) => d.getMonth() === 11)

    expect(decemberDays[0].getDate()).toBe(1)
    expect(decemberDays[decemberDays.length - 1].getDate()).toBe(31)
  })
})

describe('CalendarInput', () => {
  // @note built from local parts so the assertions hold in any test timezone
  const SELECTED = new Date(2027, 11, 20, 10, 30).getTime()

  it('emits the picked day at the current time-of-day', () => {
    const onChange = jest.fn()

    const { getByLabelText } = render(
      <CalendarInput value={SELECTED} onChange={onChange} />
    )

    fireEvent.click(getByLabelText(new Date(2027, 11, 15).toDateString()))

    expect(onChange).toHaveBeenCalledWith(
      new Date(2027, 11, 15, 10, 30).getTime()
    )
  })

  it('re-emits the selected day when the time changes', () => {
    const onChange = jest.fn()

    const { getByLabelText } = render(
      <CalendarInput value={SELECTED} onChange={onChange} />
    )

    fireEvent.change(getByLabelText('Hour'), { target: { value: '8' } })

    expect(onChange).toHaveBeenCalledWith(
      new Date(2027, 11, 20, 8, 30).getTime()
    )
  })

  it('follows the value when it changes externally (e.g. a preset)', () => {
    const { rerender, getByText, getByLabelText } = render(
      <CalendarInput value={new Date(2027, 0, 10, 9, 0).getTime()} onChange={jest.fn()} />
    )

    // initially showing the selected month
    expect(getByText('January 2027')).toBeInTheDocument()

    // value jumps to a different month/day (as a preset would do)
    rerender(
      <CalendarInput value={new Date(2027, 2, 5, 9, 0).getTime()} onChange={jest.fn()} />
    )

    // the grid navigates to the new month and marks the new day selected
    expect(getByText('March 2027')).toBeInTheDocument()
    expect(getByLabelText(new Date(2027, 2, 5).toDateString())).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('renders nothing selected when value is null', () => {
    const { queryByRole } = render(
      <CalendarInput value={null} onChange={jest.fn()} />
    )

    // no day button is in the pressed/selected state
    const pressed = queryByRole('button', { pressed: true })

    expect(pressed).toBeNull()
  })
})
