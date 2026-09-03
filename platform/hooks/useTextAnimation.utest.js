import useTextAnimation from './useTextAnimation'

import { act, renderHook, waitFor } from '@testing-library/react'

describe('useTextAnimation', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  describe('initialization', () => {
    it('should initialize with empty text', () => {
      const { result } = renderHook(() =>
        useTextAnimation({
          texts: ['Hello', 'World'],
          typingSpeed: 100,
          deletingSpeed: 50,
          delayBetweenTexts: 1000,
        })
      )

      expect(result.current).toBe('')
    })

    it('should initialize with empty text when disabled', () => {
      const { result } = renderHook(() =>
        useTextAnimation({
          texts: ['Hello'],
          typingSpeed: 100,
          deletingSpeed: 50,
          delayBetweenTexts: 1000,
          disabled: true,
        })
      )

      expect(result.current).toBe('')
    })
  })

  describe('typing animation', () => {
    it('should type out first text character by character', async () => {
      const { result } = renderHook(() =>
        useTextAnimation({
          texts: ['Hi'],
          typingSpeed: 100,
          deletingSpeed: 50,
          delayBetweenTexts: 1000,
        })
      )

      expect(result.current).toBe('')

      // Type 'H'
      act(() => {
        jest.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current).toBe('H')
      })

      // Type 'i'
      act(() => {
        jest.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current).toBe('Hi')
      })
    })

    it('should respect typing speed', async () => {
      const { result } = renderHook(() =>
        useTextAnimation({
          texts: ['AB'],
          typingSpeed: 200,
          deletingSpeed: 50,
          delayBetweenTexts: 1000,
        })
      )

      // Should not type before typing speed elapsed
      act(() => {
        jest.advanceTimersByTime(100)
      })

      expect(result.current).toBe('')

      // Should type after typing speed elapsed
      act(() => {
        jest.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current).toBe('A')
      })
    })

    it('should type out complete text', async () => {
      const { result } = renderHook(() =>
        useTextAnimation({
          texts: ['Test'],
          typingSpeed: 50,
          deletingSpeed: 50,
          delayBetweenTexts: 1000,
        })
      )

      // Type all characters
      act(() => {
        jest.advanceTimersByTime(200) // 4 chars * 50ms
      })

      await waitFor(() => {
        expect(result.current).toBe('Test')
      })
    })
  })

  describe('deleting animation', () => {
    it('should delete text after delay', async () => {
      const { result } = renderHook(() =>
        useTextAnimation({
          texts: ['Hi'],
          typingSpeed: 50,
          deletingSpeed: 50,
          delayBetweenTexts: 100,
        })
      )

      // Type complete text
      act(() => {
        jest.advanceTimersByTime(100) // Type 'Hi'
      })

      await waitFor(() => {
        expect(result.current).toBe('Hi')
      })

      // Wait for delay
      act(() => {
        jest.advanceTimersByTime(100)
      })

      // Start deleting
      act(() => {
        jest.advanceTimersByTime(50)
      })

      await waitFor(() => {
        expect(result.current).toBe('H')
      })

      // Delete last character
      act(() => {
        jest.advanceTimersByTime(50)
      })

      await waitFor(() => {
        expect(result.current).toBe('')
      })
    })

    it('should respect deleting speed', async () => {
      const { result } = renderHook(() =>
        useTextAnimation({
          texts: ['AB'],
          typingSpeed: 50,
          deletingSpeed: 200,
          delayBetweenTexts: 100,
        })
      )

      // Type complete text
      act(() => {
        jest.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current).toBe('AB')
      })

      // Wait for delay
      act(() => {
        jest.advanceTimersByTime(100)
      })

      // Should not delete before deleting speed elapsed
      act(() => {
        jest.advanceTimersByTime(100)
      })

      expect(result.current).toBe('AB')

      // Should delete after deleting speed elapsed
      act(() => {
        jest.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current).toBe('A')
      })
    })
  })

  describe('cycling through texts', () => {
    it('should cycle to next text after deleting', async () => {
      const { result } = renderHook(() =>
        useTextAnimation({
          texts: ['A', 'B'],
          typingSpeed: 50,
          deletingSpeed: 50,
          delayBetweenTexts: 100,
        })
      )

      // Type first text 'A'
      act(() => {
        jest.advanceTimersByTime(50)
      })

      await waitFor(() => {
        expect(result.current).toBe('A')
      })

      // Delay before deleting
      act(() => {
        jest.advanceTimersByTime(100)
      })

      // Delete 'A'
      act(() => {
        jest.advanceTimersByTime(50)
      })

      await waitFor(() => {
        expect(result.current).toBe('')
      })

      // Delay before next text
      act(() => {
        jest.advanceTimersByTime(100)
      })

      // Type second text 'B'
      act(() => {
        jest.advanceTimersByTime(50)
      })

      await waitFor(() => {
        expect(result.current).toBe('B')
      })
    })

    it('should loop back to first text after last text', async () => {
      const { result } = renderHook(() =>
        useTextAnimation({
          texts: ['A', 'B'],
          typingSpeed: 50,
          deletingSpeed: 50,
          delayBetweenTexts: 100,
        })
      )

      // Complete full cycle twice to verify looping
      // First cycle: A -> delete -> B -> delete
      act(() => {
        jest.advanceTimersByTime(50 + 100 + 50 + 100 + 50 + 100 + 50 + 100)
      })

      await waitFor(() => {
        expect(result.current).toBe('')
      })

      // Should type 'A' again (looped back)
      act(() => {
        jest.advanceTimersByTime(50)
      })

      await waitFor(() => {
        expect(result.current).toBe('A')
      })
    })

    it('should handle single text without errors', async () => {
      const { result } = renderHook(() =>
        useTextAnimation({
          texts: ['Only'],
          typingSpeed: 50,
          deletingSpeed: 50,
          delayBetweenTexts: 100,
        })
      )

      // Type text
      act(() => {
        jest.advanceTimersByTime(200)
      })

      await waitFor(() => {
        expect(result.current).toBe('Only')
      })

      // Delete and retype same text
      act(() => {
        jest.advanceTimersByTime(100 + 200 + 100 + 200)
      })

      await waitFor(() => {
        expect(result.current).toBe('Only')
      })
    })
  })

  describe('delay between texts', () => {
    it('should respect delay between texts', async () => {
      const { result } = renderHook(() =>
        useTextAnimation({
          texts: ['A'],
          typingSpeed: 50,
          deletingSpeed: 50,
          delayBetweenTexts: 500,
        })
      )

      // Type 'A'
      act(() => {
        jest.advanceTimersByTime(50)
      })

      await waitFor(() => {
        expect(result.current).toBe('A')
      })

      // Should not start deleting before delay
      act(() => {
        jest.advanceTimersByTime(250)
      })

      expect(result.current).toBe('A')

      // Should start deleting after delay
      act(() => {
        jest.advanceTimersByTime(250 + 50)
      })

      await waitFor(() => {
        expect(result.current).toBe('')
      })
    })
  })

  describe('disabled state', () => {
    it('should clear text when disabled', async () => {
      const { result, rerender } = renderHook(
        ({ disabled }) =>
          useTextAnimation({
            texts: ['Hello'],
            typingSpeed: 50,
            deletingSpeed: 50,
            delayBetweenTexts: 100,
            disabled,
          }),
        { initialProps: { disabled: false } }
      )

      // Type some text
      act(() => {
        jest.advanceTimersByTime(150)
      })

      await waitFor(() => {
        expect(result.current.length).toBeGreaterThan(0)
      })

      // Disable animation
      rerender({ disabled: true })

      await waitFor(() => {
        expect(result.current).toBe('')
      })
    })

    it('should not animate when initially disabled', () => {
      const { result } = renderHook(() =>
        useTextAnimation({
          texts: ['Hello'],
          typingSpeed: 50,
          deletingSpeed: 50,
          delayBetweenTexts: 100,
          disabled: true,
        })
      )

      act(() => {
        jest.advanceTimersByTime(1000)
      })

      expect(result.current).toBe('')
    })

    it('should resume animation when re-enabled', async () => {
      const { result, rerender } = renderHook(
        ({ disabled }) =>
          useTextAnimation({
            texts: ['Hi'],
            typingSpeed: 50,
            deletingSpeed: 50,
            delayBetweenTexts: 100,
            disabled,
          }),
        { initialProps: { disabled: true } }
      )

      expect(result.current).toBe('')

      // Re-enable animation
      rerender({ disabled: false })

      // Should start typing
      act(() => {
        jest.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current).toBe('Hi')
      })
    })
  })

  describe('edge cases', () => {
    it('should handle empty texts array gracefully', () => {
      const { result } = renderHook(() =>
        useTextAnimation({
          texts: [],
          typingSpeed: 50,
          deletingSpeed: 50,
          delayBetweenTexts: 100,
        })
      )

      act(() => {
        jest.advanceTimersByTime(500)
      })

      expect(result.current).toBe('')
    })

    it('should handle empty string in texts array', async () => {
      const { result } = renderHook(() =>
        useTextAnimation({
          texts: ['', 'A'],
          typingSpeed: 50,
          deletingSpeed: 50,
          delayBetweenTexts: 100,
        })
      )

      // Empty string should complete immediately
      act(() => {
        jest.advanceTimersByTime(100)
      })

      // Should move to next text 'A'
      act(() => {
        jest.advanceTimersByTime(100 + 50)
      })

      await waitFor(() => {
        expect(result.current).toBe('A')
      })
    })

    it('should cleanup timers on unmount', () => {
      const { unmount } = renderHook(() =>
        useTextAnimation({
          texts: ['Hello'],
          typingSpeed: 50,
          deletingSpeed: 50,
          delayBetweenTexts: 100,
        })
      )

      expect(() => unmount()).not.toThrow()

      // Verify no timers are pending after unmount
      act(() => {
        jest.runOnlyPendingTimers()
      })
    })
  })
})
