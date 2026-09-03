import AudioPlayer from './AudioPlayer'

import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

jest.mock(
  '@heroicons/react/24/outline/esm/PauseIcon',
  () => ({
    __esModule: true,
    default: () => null,
  }),
  { virtual: true }
)

jest.mock(
  '@heroicons/react/24/outline/esm/PlayIcon',
  () => ({
    __esModule: true,
    default: () => null,
  }),
  { virtual: true }
)

describe('AudioPlayer', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // @note mock basic audio functionality
    HTMLMediaElement.prototype.play = jest.fn(() => Promise.resolve())
    HTMLMediaElement.prototype.pause = jest.fn()
    HTMLMediaElement.prototype.load = jest.fn()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('rendering', () => {
    it('should render audio player with play button', () => {
      render(<AudioPlayer src="test.mp3" />)
      expect(screen.getByLabelText('Play')).toBeInTheDocument()
    })

    it('should render audio element with correct src', () => {
      const { container } = render(<AudioPlayer src="test-audio.mp3" />)
      const audio = container.querySelector('audio')

      expect(audio).toHaveAttribute('src', 'test-audio.mp3')
      expect(audio).toHaveAttribute('preload', 'metadata')
    })

    it('should apply custom className', () => {
      const { container } = render(
        <AudioPlayer src="test.mp3" className="custom-class" />
      )

      expect(container.firstChild).toHaveClass('custom-class')
    })
  })

  describe('play/pause functionality', () => {
    it('should play audio when play button is clicked', async () => {
      const playSpy = jest.spyOn(HTMLMediaElement.prototype, 'play')

      render(<AudioPlayer src="test.mp3" />)

      const playButton = screen.getByLabelText('Play')

      await act(async () => {
        fireEvent.click(playButton)
      })

      expect(playSpy).toHaveBeenCalled()
    })

    it('should change button to pause when playing', async () => {
      render(<AudioPlayer src="test.mp3" />)

      const playButton = screen.getByLabelText('Play')

      await act(async () => {
        fireEvent.click(playButton)
      })

      await waitFor(() => {
        expect(screen.getByLabelText('Pause')).toBeInTheDocument()
      })
    })

    it('should pause audio when pause button is clicked', async () => {
      const pauseSpy = jest.spyOn(HTMLMediaElement.prototype, 'pause')

      render(<AudioPlayer src="test.mp3" />)

      await act(async () => {
        fireEvent.click(screen.getByLabelText('Play'))
      })

      await waitFor(() => screen.getByLabelText('Pause'))

      await act(async () => {
        fireEvent.click(screen.getByLabelText('Pause'))
      })

      expect(pauseSpy).toHaveBeenCalled()
    })

    it('should handle play promise rejection gracefully', async () => {
      jest
        .spyOn(HTMLMediaElement.prototype, 'play')
        .mockRejectedValue(new Error('Play failed'))

      render(<AudioPlayer src="test.mp3" />)

      await act(async () => {
        fireEvent.click(screen.getByLabelText('Play'))
      })

      expect(screen.getByLabelText('Play')).toBeInTheDocument()
    })
  })

  describe('progress bar', () => {
    it('should render progress bar', () => {
      const { container } = render(<AudioPlayer src="test.mp3" />)
      const progressBar = container.querySelector('.cursor-pointer')

      expect(progressBar).toBeInTheDocument()
    })

    it('should handle progress bar click', async () => {
      const { container } = render(<AudioPlayer src="test.mp3" />)
      const progressBar = container.querySelector('.cursor-pointer')

      Object.defineProperty(progressBar, 'getBoundingClientRect', {
        value: () => ({ left: 0, width: 100 }),
        configurable: true,
      })

      await act(async () => {
        fireEvent.click(progressBar, { clientX: 50 })
      })

      expect(progressBar).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('should handle play returning undefined', async () => {
      jest.spyOn(HTMLMediaElement.prototype, 'play').mockReturnValue(undefined)

      render(<AudioPlayer src="test.mp3" />)

      await act(async () => {
        fireEvent.click(screen.getByLabelText('Play'))
      })

      await waitFor(() => {
        expect(screen.getByLabelText('Pause')).toBeInTheDocument()
      })
    })

    it('should pass through additional props', () => {
      render(<AudioPlayer src="test.mp3" data-testid="custom-player" />)

      const player = screen.getByTestId('custom-player')

      expect(player).toBeInTheDocument()
    })
  })

  describe('AudioPlayer.Memo', () => {
    it('should export memoized version', () => {
      expect(AudioPlayer.Memo).toBeDefined()
      render(<AudioPlayer.Memo src="test.mp3" />)
      expect(screen.getByLabelText('Play')).toBeInTheDocument()
    })
  })
})
