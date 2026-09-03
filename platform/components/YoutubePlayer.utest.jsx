import YoutubePlayer from './YoutubePlayer'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

describe('YoutubePlayer', () => {
  it('should render a privacy-enhanced embed from a youtu.be link', () => {
    render(<YoutubePlayer src="https://youtu.be/mhUNHCxERfk" title="Demo" />)

    const iframe = screen.getByTitle('Demo')

    expect(iframe).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/mhUNHCxERfk?rel=0&playsinline=1'
    )
  })

  it('should render from a watch url', () => {
    render(
      <YoutubePlayer
        src="https://www.youtube.com/watch?v=mhUNHCxERfk"
        title="Demo"
      />
    )

    expect(screen.getByTitle('Demo')).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/mhUNHCxERfk?rel=0&playsinline=1'
    )
  })

  it('should render from a bare video id', () => {
    render(<YoutubePlayer src="mhUNHCxERfk" title="Demo" />)

    expect(screen.getByTitle('Demo')).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/mhUNHCxERfk?rel=0&playsinline=1'
    )
  })

  it('should support autoplay', () => {
    render(
      <YoutubePlayer src="mhUNHCxERfk" title="Demo" autoplay={true} />
    )

    expect(screen.getByTitle('Demo')).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/mhUNHCxERfk?autoplay=1&rel=0&playsinline=1'
    )
  })

  it('should set the referrer policy and allow fullscreen', () => {
    render(<YoutubePlayer src="mhUNHCxERfk" title="Demo" />)

    const iframe = screen.getByTitle('Demo')

    expect(iframe).toHaveAttribute(
      'referrerpolicy',
      'strict-origin-when-cross-origin'
    )
    expect(iframe).toHaveAttribute('allowfullscreen')
  })

  it('should apply a custom class name', () => {
    render(
      <YoutubePlayer src="mhUNHCxERfk" title="Demo" className="custom" />
    )

    expect(screen.getByTitle('Demo')).toHaveClass('custom')
  })

  it('should hide controls, loop, and ignore the pointer when chromeless', () => {
    render(
      <YoutubePlayer src="mhUNHCxERfk" title="Demo" chromeless={true} />
    )

    const iframe = screen.getByTitle('Demo')

    expect(iframe).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/mhUNHCxERfk?rel=0&controls=0&enablejsapi=1&disablekb=1&fs=0&iv_load_policy=3&playsinline=1&origin=http%3A%2F%2Flocalhost&loop=1&playlist=mhUNHCxERfk'
    )
    expect(iframe).toHaveClass('pointer-events-none')
    expect(iframe).not.toHaveAttribute('allowfullscreen')
  })

  it('should pin the embedding origin when the js api is enabled', () => {
    render(<YoutubePlayer src="mhUNHCxERfk" title="Demo" chromeless={true} />)

    expect(screen.getByTitle('Demo').getAttribute('src')).toContain(
      `origin=${encodeURIComponent(window.location.origin)}`
    )
  })

  it('should not pin an origin when the js api is not enabled', () => {
    render(<YoutubePlayer src="mhUNHCxERfk" title="Demo" />)

    expect(screen.getByTitle('Demo').getAttribute('src')).not.toContain(
      'origin='
    )
  })

  it('should request inline playback so iOS does not force fullscreen', () => {
    render(<YoutubePlayer src="mhUNHCxERfk" title="Demo" />)

    expect(screen.getByTitle('Demo').getAttribute('src')).toContain(
      'playsinline=1'
    )
  })

  it('should report auto-mutes so external toggles can stay in sync', () => {
    let intersectionCallback

    global.IntersectionObserver = jest.fn(function (callback) {
      intersectionCallback = callback

      return { observe: jest.fn(), disconnect: jest.fn() }
    })

    const onAutoMute = jest.fn()

    render(
      <YoutubePlayer
        src="mhUNHCxERfk"
        title="Demo"
        autoplayOnVisible={true}
        onAutoMute={onAutoMute}
      />
    )

    intersectionCallback([{ isIntersecting: true }])

    expect(onAutoMute).toHaveBeenCalledTimes(1)

    intersectionCallback([{ isIntersecting: false }])

    expect(onAutoMute).toHaveBeenCalledTimes(1)

    delete global.IntersectionObserver
  })

  it('should enable the js api when autoplayOnVisible is set', () => {
    render(
      <YoutubePlayer src="mhUNHCxERfk" title="Demo" autoplayOnVisible={true} />
    )

    expect(screen.getByTitle('Demo')).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/mhUNHCxERfk?rel=0&enablejsapi=1&playsinline=1&origin=http%3A%2F%2Flocalhost'
    )
  })

  it('should play muted when fully visible and pause when not', () => {
    let intersectionCallback

    const observe = jest.fn()
    const disconnect = jest.fn()

    global.IntersectionObserver = jest.fn(function (callback) {
      intersectionCallback = callback

      return { observe, disconnect }
    })

    render(
      <YoutubePlayer src="mhUNHCxERfk" title="Demo" autoplayOnVisible={true} />
    )

    const iframe = screen.getByTitle('Demo')

    expect(observe).toHaveBeenCalledWith(iframe)

    const postMessage = jest.fn()

    Object.defineProperty(iframe, 'contentWindow', {
      value: { postMessage },
    })

    intersectionCallback([{ isIntersecting: true }])

    expect(postMessage).toHaveBeenCalledWith(
      JSON.stringify({ event: 'command', func: 'mute', args: [] }),
      'https://www.youtube-nocookie.com'
    )
    expect(postMessage).toHaveBeenCalledWith(
      JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
      'https://www.youtube-nocookie.com'
    )

    intersectionCallback([{ isIntersecting: false }])

    expect(postMessage).toHaveBeenCalledWith(
      JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
      'https://www.youtube-nocookie.com'
    )

    delete global.IntersectionObserver
  })

  it('should start playback on load when the frame is already visible', () => {
    let intersectionCallback

    global.IntersectionObserver = jest.fn(function (callback) {
      intersectionCallback = callback

      return { observe: jest.fn(), disconnect: jest.fn() }
    })

    const { rerender } = render(
      <YoutubePlayer src="mhUNHCxERfk" title="Demo" autoplayOnVisible={true} />
    )

    intersectionCallback([{ isIntersecting: true }])

    // @note swapping the video remounts the iframe (keyed by url) - the
    // remembered visibility must start the new frame from its load event
    rerender(
      <YoutubePlayer src="aAaAaAaAaAa" title="Demo" autoplayOnVisible={true} />
    )

    const iframe = screen.getByTitle('Demo')

    const postMessage = jest.fn()

    Object.defineProperty(iframe, 'contentWindow', {
      value: { postMessage },
    })

    fireEvent.load(iframe)

    expect(postMessage).toHaveBeenCalledWith(
      JSON.stringify({ event: 'command', func: 'mute', args: [] }),
      'https://www.youtube-nocookie.com'
    )
    expect(postMessage).toHaveBeenCalledWith(
      JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
      'https://www.youtube-nocookie.com'
    )

    delete global.IntersectionObserver
  })

  it('should not start playback on load when the frame is not visible', () => {
    global.IntersectionObserver = jest.fn(function () {
      return { observe: jest.fn(), disconnect: jest.fn() }
    })

    render(
      <YoutubePlayer src="mhUNHCxERfk" title="Demo" autoplayOnVisible={true} />
    )

    const iframe = screen.getByTitle('Demo')

    const postMessage = jest.fn()

    Object.defineProperty(iframe, 'contentWindow', {
      value: { postMessage },
    })

    fireEvent.load(iframe)

    expect(postMessage).not.toHaveBeenCalled()

    delete global.IntersectionObserver
  })
})
