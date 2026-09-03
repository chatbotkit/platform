import {
  createContext,
  forwardRef,
  memo,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'

import { supports as cssSupports } from '@/lib/css.support'
import { ScrollManager } from '@/lib/scroll.manager'

import useHasChildren from '@/hooks/useHasChildren'

import clsx from 'clsx'

const FILLED_STYLES = {
  minHeight: '1px',
  flexShrink: '0',
  flexGrow: '0',
}

const EMPTY_STYLES = {
  ...FILLED_STYLES,

  height: '1px',
  maxHeight: '1px',
  margin: '0',
  marginTop: '-1px', // @note to prevent anchor pushing the content
  padding: '0',
  border: '0',
  flexBasis: '1px',
  overflow: 'hidden',
  background: 'transparent',
}

const OVERFLOW_ANCHOR_STYLES = {
  overflowAnchor: 'auto',
}

const AutoScrollContext = createContext({})

export const AutoScrollStop = forwardRef(function AutoScrollStop(
  { margin = 10, className, style, disabled, children, ...props },
  forwardedRef
) {
  const localRef = useRef()

  useImperativeHandle(forwardedRef, () => localRef.current)

  const { scrollState, scrollManager } = useContext(AutoScrollContext)

  useEffect(() => {
    const el = localRef.current

    if (!el) {
      return
    }

    // @note check isConnected to handle race condition in Safari where useEffect
    // fires before DOM is fully connected
    if (!el.isConnected) {
      return
    }

    scrollManager?.addStopElement(el, margin, (scrollManager) => {
      if (scrollManager.state === 'stopped') {
        // @note handle fast stopping - it probably won't matter much

        const el = localRef.current

        if (!el) {
          return
        }

        Object.assign(el.style, OVERFLOW_ANCHOR_STYLES)
      }
    })

    return () => {
      scrollManager?.removeStopElement(el)
    }
  }, [margin, scrollManager])

  const hasChildren = useHasChildren(children)

  return (
    <div
      {...props}
      className={clsx('auto-scroll-stop', className)}
      style={{
        ...style,
        ...(!hasChildren ? EMPTY_STYLES : FILLED_STYLES),
        ...(!disabled && scrollState === 'stopped'
          ? OVERFLOW_ANCHOR_STYLES
          : {}),
      }}
      data-disabled={disabled ? 'true' : 'false'}
      data-state={scrollState}
      ref={localRef}
    >
      {children}
    </div>
  )
})

AutoScrollStop.Memo = memo(AutoScrollStop)

export const AutoScrollAnchor = forwardRef(function AutoScrollAnchor(
  { margin = 10, className, style, disabled, children, ...props },
  forwardedRef
) {
  const localRef = useRef()

  useImperativeHandle(forwardedRef, () => localRef.current)

  const { scrollState, scrollManager } = useContext(AutoScrollContext)

  const hasChildren = useHasChildren(children)

  useEffect(() => {
    const el = localRef.current

    if (!el) {
      return
    }

    // @note check isConnected to handle race condition in Safari where useEffect
    // fires before DOM is fully connected
    if (!el.isConnected) {
      return
    }

    scrollManager?.addAnchorElement(el, margin, (scrollManager, prevState) => {
      // @note if the browser does not support overflow-anchor, we need to
      // manually scroll to the anchor element when anchored

      if (cssSupports('overflow-anchor', 'auto')) {
        return
      }

      // @note the following is just a range of silly hacks to sort of make
      // the behaviour work in some cases - it is not perfect

      if (scrollManager.state === 'anchored') {
        el.scrollIntoView({ block: 'nearest' })

        return
      }

      if (scrollManager.state === 'disabled' && prevState === 'anchored') {
        el.scrollIntoView({ block: 'nearest' })

        return
      }
    })

    return () => {
      scrollManager?.removeAnchorElement(el)
    }
  }, [margin, scrollManager])

  return (
    <div
      {...props}
      className={clsx('auto-scroll-anchor', className)}
      style={{
        ...style,
        ...(!hasChildren ? EMPTY_STYLES : FILLED_STYLES),
        ...(!disabled && scrollState === 'anchored'
          ? OVERFLOW_ANCHOR_STYLES
          : {}),
      }}
      data-disabled={disabled ? 'true' : 'false'}
      data-state={scrollState}
      ref={localRef}
    >
      {children}
    </div>
  )
})

AutoScrollAnchor.Memo = memo(AutoScrollAnchor)

export const AutoScrollArea = forwardRef(function AutoScrollArea(
  {
    anchor = 'bottom',

    margin = 100,

    className,

    children,

    disabled,

    ...props
  },
  forwardedRef
) {
  const localRef = useRef()

  useImperativeHandle(forwardedRef, () => localRef.current)

  const [scrollManager, setScrollManager] = useState(null)

  const [scrollState, setScrollState] = useState(null)

  useEffect(() => {
    if (!localRef.current) {
      return
    }

    const manager = new ScrollManager(localRef.current, (manager) => {
      setScrollState(manager.state)
    })

    setScrollManager(manager)

    return () => {
      manager.destroy()

      setScrollManager(null)
    }
  }, [])

  useEffect(() => {
    if (!scrollManager) {
      return
    }

    scrollManager.disabled = disabled
  }, [disabled, scrollManager])

  return (
    <AutoScrollContext.Provider
      value={useMemo(
        () => ({ scrollManager, scrollState }),
        [scrollManager, scrollState]
      )}
    >
      <div
        {...props}
        className={clsx(
          'auto-scroll-area [&_*]:[overflow-anchor:none]',
          className
        )}
        ref={localRef}
      >
        {children}
        {anchor === 'bottom' ? (
          <AutoScrollAnchor.Memo key="bottom" margin={margin} />
        ) : null}
      </div>
    </AutoScrollContext.Provider>
  )
})

AutoScrollArea.Memo = memo(AutoScrollArea)

export default AutoScrollArea
