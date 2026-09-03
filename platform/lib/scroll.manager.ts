export class ScrollManager {
  private internalContainer: HTMLElement

  private onStateChange:
    | ((manager: ScrollManager, prevState: typeof this.internalState) => void)
    | undefined

  private stopElements: Set<HTMLElement> = new Set()
  private anchorElements: Set<HTMLElement> = new Set()

  private stopMargins = new Map<HTMLElement, number>()
  private anchorMargins = new Map<HTMLElement, number>()

  private stopStateChangeCallbacks = new Map<
    HTMLElement,
    | ((manager: ScrollManager, prevState: typeof this.internalState) => void)
    | undefined
  >()
  private anchorStateChangeCallbacks = new Map<
    HTMLElement,
    | ((manager: ScrollManager, prevState: typeof this.internalState) => void)
    | undefined
  >()

  private stopIntersectionObserver: IntersectionObserver | null = null
  private anchorIntersectionObserver: IntersectionObserver | null = null

  private internalState:
    | 'disabled' // the scroll manager is disabled
    | 'interacting' // the user is interacting with the scroll container
    | 'neutral' // the scroll manager is in neutral state
    | 'anchored' // the scroll is anchored to the bottom
    | 'stopped' = 'neutral' // the scroll is stopped at the top

  private internalElement: HTMLElement | null = null

  private userInteracting = false

  private scrollingTimeout: number | null = null

  constructor(
    container: HTMLElement,
    onStateChange?: (
      manager: ScrollManager,
      prevState: typeof this.internalState
    ) => void
  ) {
    if (!container.isConnected) {
      throw new Error(
        'ScrollManager container must be connected to the DOM when instantiated.'
      )
    }

    this.internalContainer = container

    // @note trigger small scroll to ensure the overflow-anchor is correct
    {
      this.internalContainer.scroll(0, 1) // @note it probably does not do much
    }

    this.onStateChange = onStateChange

    this.internalContainer.addEventListener('scroll', this.onScroll)

    window.addEventListener('resize', this.onResize)

    this.internalContainer.addEventListener('wheel', this.onUserInteractStart, {
      passive: true,
    })

    this.internalContainer.addEventListener(
      'touchstart',
      this.onUserInteractStart,
      {
        passive: true,
      }
    )
    this.internalContainer.addEventListener(
      'touchend',
      this.onUserInteractEnd,
      {
        passive: true,
      }
    )

    this.internalContainer.addEventListener(
      'mousedown',
      this.onUserInteractStart
    )
    this.internalContainer.addEventListener('mouseup', this.onUserInteractEnd)

    this.stopIntersectionObserver = new IntersectionObserver(
      (entries) => {
        if (this.disabled || this.internalState === 'interacting') {
          return
        }

        const hasIntersecting = entries.some((entry) => entry.isIntersecting)

        if (!hasIntersecting) {
          return
        }

        this.calibrate('stop intersection observer')
      },
      {
        root: this.internalContainer,
        threshold: [0, 0.01, 0.1, 0.5, 1.0],
      }
    )

    this.anchorIntersectionObserver = new IntersectionObserver(
      (entries) => {
        if (this.disabled || this.internalState === 'interacting') {
          return
        }

        const hasIntersecting = entries.some((entry) => entry.isIntersecting)

        if (!hasIntersecting) {
          return
        }

        this.calibrate('anchor intersection observer')
      },
      {
        root: this.internalContainer,
        threshold: [0, 0.01, 0.1, 0.5, 1.0],
      }
    )
  }

  /**
   * Cleans up event listeners and internal state. Should be called when the
   * ScrollManager is no longer needed.
   */
  destroy() {
    this.internalContainer.removeEventListener('scroll', this.onScroll)

    window.removeEventListener('resize', this.onResize)

    this.internalContainer.removeEventListener(
      'wheel',
      this.onUserInteractStart
    )

    this.internalContainer.removeEventListener(
      'touchstart',
      this.onUserInteractStart
    )
    this.internalContainer.removeEventListener(
      'touchend',
      this.onUserInteractEnd
    )

    this.internalContainer.removeEventListener(
      'mousedown',
      this.onUserInteractStart
    )
    this.internalContainer.removeEventListener(
      'mouseup',
      this.onUserInteractEnd
    )

    this.stopIntersectionObserver?.disconnect()
    this.anchorIntersectionObserver?.disconnect()
    this.stopIntersectionObserver = null
    this.anchorIntersectionObserver = null

    this.stopElements.clear()
    this.anchorElements.clear()
    this.stopMargins.clear()
    this.anchorMargins.clear()

    if (this.scrollingTimeout) {
      clearTimeout(this.scrollingTimeout)
      this.scrollingTimeout = null
    }
  }

  /**
   * Sets the current state of the scroll manager.
   *
   * @param state - The new state to set.
   */
  private setState(
    state: typeof this.internalState,
    element: HTMLElement | null
  ) {
    if (this.internalState === state && this.internalElement === element) {
      return
    }

    const prevState = this.internalState

    this.internalState = state

    this.internalElement = element

    this.onStateChange?.(this, prevState)

    for (const element of this.stopElements) {
      const callback = this.stopStateChangeCallbacks.get(element)

      callback?.(this, prevState)
    }

    for (const element of this.anchorElements) {
      const callback = this.anchorStateChangeCallbacks.get(element)

      callback?.(this, prevState)
    }
  }

  /**
   * Returns the scroll container element.
   */
  get container() {
    return this.internalContainer
  }

  /**
   * Returns the current element associated with the scroll manager's state.
   */
  get element() {
    return this.internalElement
  }

  /**
   * Returns the current state of the scroll manager.
   */
  get state() {
    return this.internalState
  }

  /**
   * Checks if the scroll manager is currently disabled.
   */
  get disabled() {
    return this.internalState === 'disabled'
  }

  /**
   * Enables or disables the scroll manager. When disabled, the scroll manager
   * will not respond to scroll or resize events. If re-enabled, it will
   * immediately calibrate its state.
   *
   * @param value - A boolean indicating whether to disable (true) or enable (false) the scroll manager.
   */
  set disabled(value: boolean) {
    this.setState(value ? 'disabled' : 'neutral', null)

    if (!value) {
      this.calibrate('enabled')
    }
  }

  /**
   * Resets the scroll manager to the neutral state, allowing it to recalibrate
   * its state based on the current scroll position and the positions of the
   * registered stop and anchor elements.
   */
  reset() {
    this.setState('neutral', null)

    this.calibrate('reset')
  }

  /**
   * Calibrates the scroll manager's state based on the current scroll position
   * and the positions of the registered stop and anchor elements.
   *
   * State definitions:
   * - 'disabled': The scroll manager is inactive and does not respond to events.
   * - 'interacting': The user is actively interacting with the scroll container (e.g., scrolling).
   * - 'neutral': The scroll manager is in a neutral state, ready to evaluate stop and anchor conditions.
   * - 'anchored': The scroll position is anchored to the bottom of an anchor element.
   * - 'stopped': The scroll position is stopped at the top of a stop element.
   *
   * Behavior:
   * - If the state is 'disabled', the method exits without making changes.
   * - If the state is 'interacting', the method exits to avoid interfering with user actions.
   * - If the state is 'neutral' or 'anchored', it checks each stop element to see if the scroll position is within the defined margin of the top of the container. If so, it sets the state to 'stopped'. To exit the 'stopped' state, the user must scroll away, or the state must be reset to 'neutral' with the `reset()` method.
   * - If the state is 'neutral', it checks each anchor element to see if the scroll position is within the defined margin of the bottom of the container. If so, it sets the state to 'anchored'. To exit the 'anchored' state, the user must scroll away, or the state must be reset to 'neutral' with the `reset()` method.
   *
   * @param reason - A string indicating the reason for calibration (e.g., 'scroll', 'resize'). This parameter is currently unused but may be useful for debugging or logging purposes.
   *
   * @private
   */
  private calibrate = (reason: string) => {
    reason // @note used for debugging

    // exit if disabled

    if (this.internalState === 'disabled') {
      return
    }

    // exit if interacting

    if (this.internalState === 'interacting') {
      return
    }

    // if the state is neutral or anchored, check if we need to stop at the top
    // of any of the stop elements

    if (this.internalState === 'neutral' || this.internalState === 'anchored') {
      for (const element of this.stopElements) {
        if (!element.isConnected) {
          continue
        }

        const rect = element.getBoundingClientRect()

        if (rect.width === 0 && rect.height === 0) {
          continue
        }

        const containerRect = this.internalContainer.getBoundingClientRect()

        const distance = rect.top - containerRect.top
        const margin = this.stopMargins.get(element) || 0

        const d = Math.round(distance)
        const m = Math.max(0, Math.round(margin))

        // @note in scope if the distance is -margin, 0, +margin - this means
        // that we are interested in elements that are before or after the top
        // of the container, within the margin

        if (d >= -m && d <= m) {
          this.setState('stopped', element)

          break
        }
      }
    }

    // if the state is neutral, check if we need to anchor to the bottom
    // of any of the anchor elements

    if (this.internalState === 'neutral') {
      for (const element of this.anchorElements) {
        if (!element.isConnected) {
          continue
        }

        const rect = element.getBoundingClientRect()

        if (rect.width === 0 && rect.height === 0) {
          continue
        }

        const containerRect = this.internalContainer.getBoundingClientRect()

        const distance = rect.bottom - containerRect.bottom
        const margin = this.anchorMargins.get(element) || 0

        const d = Math.round(distance)
        const m = Math.max(0, Math.round(margin))

        // @note in scope if the distance is between -margin, 0, +margin - this
        // means that we are interested in elements that are before or after the
        // bottom of the container, within the margin

        if (d >= -m && d <= m) {
          this.setState('anchored', element)

          break
        }
      }
    }
  }

  /**
   * Handles scroll events, triggering a recalibration.
   *
   * @private
   */
  private onScroll = () => {
    if (this.disabled) {
      return
    }

    if (this.userInteracting) {
      this.setState('interacting', null)

      if (this.scrollingTimeout) {
        clearTimeout(this.scrollingTimeout)
      }

      this.scrollingTimeout = window.setTimeout(() => {
        this.setState('neutral', null)

        this.userInteracting = false

        this.scrollingTimeout = null

        this.calibrate('after user interaction')
      }, 1000)

      return
    }

    this.calibrate('scroll')
  }

  /**
   * Handles window resize events, triggering a recalibration.
   *
   * @private
   */
  private onResize = () => {
    if (this.disabled) {
      return
    }

    this.calibrate('resize')
  }

  /**
   * Handles the start of user interaction, setting the interaction state.
   *
   * @private
   */
  private onUserInteractStart = () => {
    this.userInteracting = true
  }

  /**
   * Handles the end of user interaction, resetting the interaction state.
   *
   * @private
   */
  private onUserInteractEnd = () => {
    this.userInteracting = false
  }

  /**
   * Adds a stop element to the scroll manager.
   *
   * @param element - The stop element to add.
   * @param margin - Optional top margin to consider when stopping.
   * @param callback - Optional callback to be invoked when the stop state changes.
   * @throws Will throw an error if the element is not connected to the DOM.
   */
  addStopElement(
    element: HTMLElement,
    margin = 0,
    callback?: (
      manager: ScrollManager,
      prevState: typeof this.internalState
    ) => void
  ) {
    if (!element.isConnected) {
      throw new Error(
        'Cannot add a stop element that is not connected to the DOM.'
      )
    }

    this.stopElements.add(element)
    this.stopMargins.set(element, margin)
    this.stopStateChangeCallbacks.set(element, callback)

    this.stopIntersectionObserver?.observe(element) // @note observe after adding
  }

  /**
   * Removes a stop element from the scroll manager.
   *
   * @param element - The stop element to remove.
   */
  removeStopElement(element: HTMLElement) {
    this.stopIntersectionObserver?.unobserve(element) // @note unobserve before removing

    this.stopElements.delete(element)
    this.stopMargins.delete(element)
    this.stopStateChangeCallbacks.delete(element)
  }

  /**
   * Adds an anchor element to the scroll manager.
   *
   * @param element - The anchor element to add.
   * @param margin - Optional bottom margin to consider when anchoring.
   * @param callback - Optional callback to be invoked when the anchor state changes.
   * @throws Will throw an error if the element is not connected to the DOM.
   */
  addAnchorElement(
    element: HTMLElement,
    margin = 0,
    callback?: (
      manager: ScrollManager,
      prevState: typeof this.internalState
    ) => void
  ) {
    if (!element.isConnected) {
      throw new Error(
        'Cannot add an anchor element that is not connected to the DOM.'
      )
    }

    this.anchorElements.add(element)
    this.anchorMargins.set(element, margin)
    this.anchorStateChangeCallbacks.set(element, callback)

    this.anchorIntersectionObserver?.observe(element) // @note observe after adding
  }

  /**
   * Removes an anchor element from the scroll manager.
   *
   * @param element - The anchor element to remove.
   */
  removeAnchorElement(element: HTMLElement) {
    this.anchorIntersectionObserver?.unobserve(element) // @note unobserve before removing

    this.anchorElements.delete(element)
    this.anchorMargins.delete(element)
    this.anchorStateChangeCallbacks.delete(element)
  }
}
