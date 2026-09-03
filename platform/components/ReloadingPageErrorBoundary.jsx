'use client'

import React from 'react'

import { getSessionStorage } from '@/lib/browserstorage'
import { captureError } from '@/lib/error'

// @note NotFoundError occurs when React tries to remove a DOM node that was
// already removed by browser extensions (Grammarly, ad blockers, translators)
// or by rapid component unmounting. These errors are harmless and shouldn't
// trigger a page reload.  tests in this file

const DEFAULT_SAFE_ERRORS = ['NotFoundError']

export default class ReloadingPageErrorBoundary extends React.Component {
  #maxReloads
  #reloadsKey
  #safeErrors

  constructor(props) {
    super(props)

    this.#maxReloads = Math.max(props.maxReloads || 3, 0)
    this.#reloadsKey = 'refreshingPageErrorBoundaryReloads'
    this.#safeErrors = [...DEFAULT_SAFE_ERRORS, ...(props.safeErrors || [])]

    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch = (error) => {
    if (this.#safeErrors.includes(error.name)) {
      return
    }

    captureError(error)

    if (process.env.NODE_ENV !== 'development') {
      // only reload the page in non-development mode

      if (typeof window !== 'undefined') {
        // only reload the page in the browser

        const sessionStorage = getSessionStorage()

        const reloads =
          parseInt(sessionStorage.getItem(this.#reloadsKey) || 0) + 1

        if (reloads >= this.#maxReloads) {
          sessionStorage.removeItem(this.#reloadsKey)

          return
        }

        sessionStorage.setItem(this.#reloadsKey, reloads)

        window.location.reload()
      }
    }
  }

  render = () => {
    if (this.state.hasError) {
      return null // @note perhaps show a loading message
    }

    return this.props.children
  }
}
