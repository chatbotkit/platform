import ProgressBar from './ProgressBar'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

describe('ProgressBar', () => {
  it('should render fixed accent color by default', () => {
    const { container } = render(<ProgressBar used={95} total={100} />)

    const bar = container.firstChild.firstChild

    expect(bar).toHaveStyle({ width: '95%' })
    expect(bar).toHaveClass('bg-[var(--color-accent)]')
    expect(bar).not.toHaveClass('bg-orange-500')
    expect(bar).not.toHaveClass('bg-red-500')
  })

  it('should render accent bar for low usage when threshold colors are enabled', () => {
    const { container } = render(
      <ProgressBar used={50} total={100} useThresholdColors={true} />
    )

    const bar = container.firstChild.firstChild

    expect(bar).toHaveStyle({ width: '50%' })
    expect(bar).toHaveClass('bg-[var(--color-accent)]')
  })

  it('should render orange bar for medium usage when threshold colors are enabled', () => {
    const { container } = render(
      <ProgressBar used={80} total={100} useThresholdColors={true} />
    )

    const bar = container.firstChild.firstChild

    expect(bar).toHaveStyle({ width: '80%' })
    expect(bar).toHaveClass('bg-orange-500')
  })

  it('should render red bar for high usage when threshold colors are enabled', () => {
    const { container } = render(
      <ProgressBar used={95} total={100} useThresholdColors={true} />
    )

    const bar = container.firstChild.firstChild

    expect(bar).toHaveStyle({ width: '95%' })
    expect(bar).toHaveClass('bg-red-500')
  })

  it('should clamp invalid values to 0 percent', () => {
    const { container } = render(
      <ProgressBar used={5} total={0} useThresholdColors={true} />
    )

    const bar = container.firstChild.firstChild

    expect(bar).toHaveStyle({ width: '0%' })
    expect(bar).toHaveClass('bg-[var(--color-accent)]')
  })

  it('should apply custom class names', () => {
    const { container } = render(
      <ProgressBar
        used={25}
        total={100}
        className="outer-test-class"
        barClassName="inner-test-class"
      />
    )

    const outer = container.firstChild
    const bar = outer.firstChild

    expect(outer).toHaveClass('outer-test-class')
    expect(bar).toHaveClass('inner-test-class')
  })
})
