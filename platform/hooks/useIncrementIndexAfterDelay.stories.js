import { useState } from 'react'

import useIncrementIndexAfterDelay from './useIncrementIndexAfterDelay'

const meta = {
  title: 'Hooks/useIncrementIndexAfterDelay',
  parameters: {
    docs: {
      description: {
        component:
          'A custom hook that increments an index value after a specified delay until it reaches a target value.',
      },
    },
  },
}

export default meta

const TestComponent = ({ to, delay }) => {
  const index = useIncrementIndexAfterDelay(to, delay)

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h3>useIncrementIndexAfterDelay Test</h3>
      <div style={{ marginBottom: '10px' }}>
        <strong>Target (to):</strong> {to}
      </div>
      <div style={{ marginBottom: '10px' }}>
        <strong>Delay:</strong> {delay}ms
      </div>
      <div style={{ marginBottom: '10px' }}>
        <strong>Current Index:</strong> {index}
      </div>
      <div style={{ marginBottom: '10px' }}>
        <strong>Progress:</strong>{' '}
        {to > 0 ? ((index / to) * 100).toFixed(1) : 0}%
      </div>
      <div
        style={{
          width: '200px',
          height: '20px',
          backgroundColor: '#e0e0e0',
          borderRadius: '10px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: to > 0 ? `${(index / to) * 100}%` : '0%',
            height: '100%',
            backgroundColor: '#4CAF50',
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  )
}

export const Default = {
  render: (args) => <TestComponent {...args} />,
  args: {
    to: 5,
    delay: 1000,
  },
  argTypes: {
    to: {
      control: { type: 'number', min: -1, max: 20, step: 1 },
      description: 'Target value to increment to',
    },
    delay: {
      control: { type: 'number', min: 100, max: 5000, step: 100 },
      description: 'Delay between increments in milliseconds',
    },
  },
}

export const FastIncrement = {
  render: (args) => <TestComponent {...args} />,
  args: {
    to: 10,
    delay: 200,
  },
}

export const SlowIncrement = {
  render: (args) => <TestComponent {...args} />,
  args: {
    to: 3,
    delay: 2000,
  },
}

export const ZeroTarget = {
  render: (args) => <TestComponent {...args} />,
  args: {
    to: 0,
    delay: 1000,
  },
}

export const NegativeTarget = {
  render: (args) => <TestComponent {...args} />,
  args: {
    to: -1,
    delay: 1000,
  },
}

const InteractiveTestComponent = () => {
  const [to, setTo] = useState(5)
  const [delay, setDelay] = useState(1000)
  const index = useIncrementIndexAfterDelay(to, delay)

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h3>Interactive Test</h3>
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '10px' }}>
          Target:
          <input
            type="number"
            value={to}
            onChange={(e) => setTo(parseInt(e.target.value) || 0)}
            style={{ marginLeft: '10px', padding: '5px' }}
          />
        </label>
        <label style={{ display: 'block', marginBottom: '10px' }}>
          Delay (ms):
          <input
            type="number"
            value={delay}
            onChange={(e) => setDelay(parseInt(e.target.value) || 100)}
            style={{ marginLeft: '10px', padding: '5px' }}
          />
        </label>
      </div>
      <div style={{ marginBottom: '10px' }}>
        <strong>Current Index:</strong> {index}
      </div>
      <div style={{ marginBottom: '10px' }}>
        <strong>Progress:</strong>{' '}
        {to > 0 ? ((index / to) * 100).toFixed(1) : 0}%
      </div>
      <div
        style={{
          width: '300px',
          height: '30px',
          backgroundColor: '#e0e0e0',
          borderRadius: '15px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: to > 0 ? `${Math.min((index / to) * 100, 100)}%` : '0%',
            height: '100%',
            backgroundColor: '#2196F3',
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
        Try changing the target or delay values to see how the hook responds!
      </div>
    </div>
  )
}

export const Interactive = {
  render: () => <InteractiveTestComponent />,
}
