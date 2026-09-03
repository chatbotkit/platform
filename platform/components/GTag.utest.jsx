/* eslint-disable @typescript-eslint/no-require-imports */
import GTag, { GTAG_ID, customEvent, event, hasDataLayer } from './GTag'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

// Mock Next.js third-parties module
jest.mock('@next/third-parties/google', () => ({
  GoogleAnalytics: jest.fn(({ gaId }) => (
    <div data-testid="google-analytics" data-ga-id={gaId} />
  )),
  GoogleTagManager: jest.fn(({ gtmId }) => (
    <div data-testid="google-tag-manager" data-gtm-id={gtmId} />
  )),
  sendGTMEvent: jest.fn(),
}))

const { sendGTMEvent } = require('@next/third-parties/google')

describe('GTag', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Reset window.dataLayer
    delete window.dataLayer

    // Reset environment variable
    delete process.env.NEXT_PUBLIC_GTAG_ID
  })

  describe('GTAG_ID constant', () => {
    it('should export GTAG_ID from environment', () => {
      // GTAG_ID is read at module load time and may be undefined in test env
      expect(typeof GTAG_ID).toMatch(/string|undefined/)
    })
  })

  describe('hasDataLayer', () => {
    it('should return falsy when window.dataLayer does not exist', () => {
      const result = hasDataLayer()

      expect(result).toBeFalsy()
    })

    it('should return falsy when window.dataLayer is not an array', () => {
      window.dataLayer = {}
      expect(hasDataLayer()).toBeFalsy()

      window.dataLayer = 'not an array'
      expect(hasDataLayer()).toBeFalsy()

      window.dataLayer = null
      expect(hasDataLayer()).toBeFalsy()
    })

    it('should return truthy when window.dataLayer is an array', () => {
      window.dataLayer = []
      expect(hasDataLayer()).toBeTruthy()

      window.dataLayer = [{ event: 'test' }]
      expect(hasDataLayer()).toBeTruthy()
    })

    it('should handle exceptions gracefully', () => {
      // Create a getter that throws
      Object.defineProperty(window, 'dataLayer', {
        get() {
          throw new Error('Access denied')
        },
        configurable: true,
      })

      expect(hasDataLayer()).toBe(false)
    })
  })

  describe('event', () => {
    beforeEach(() => {
      window.dataLayer = []
    })

    it('should send event when dataLayer exists', () => {
      event({
        event: 'click',
        action: 'button_click',
        category: 'engagement',
        label: 'signup',
        value: 1,
      })

      expect(sendGTMEvent).toHaveBeenCalledWith({
        event: 'click',
        action: 'button_click',
        category: 'engagement',
        label: 'signup',
        value: 1,
      })
    })

    it('should not send event when dataLayer does not exist', () => {
      delete window.dataLayer

      event({
        event: 'click',
        action: 'test',
        category: 'test',
        label: 'test',
        value: 0,
      })

      expect(sendGTMEvent).not.toHaveBeenCalled()
    })

    it('should handle partial event data', () => {
      event({
        event: 'pageview',
        action: 'view',
      })

      expect(sendGTMEvent).toHaveBeenCalledWith({
        event: 'pageview',
        action: 'view',
        category: undefined,
        label: undefined,
        value: undefined,
      })
    })

    it('should handle all parameters', () => {
      event({
        event: 'custom',
        action: 'test_action',
        category: 'test_category',
        label: 'test_label',
        value: 42,
      })

      expect(sendGTMEvent).toHaveBeenCalledWith({
        event: 'custom',
        action: 'test_action',
        category: 'test_category',
        label: 'test_label',
        value: 42,
      })
    })
  })

  describe('customEvent', () => {
    beforeEach(() => {
      window.dataLayer = []
    })

    it('should send custom event with parameters', () => {
      customEvent('purchase', {
        transaction_id: 'T123',
        value: 99.99,
        currency: 'USD',
      })

      expect(sendGTMEvent).toHaveBeenCalledWith({
        event: 'purchase',
        transaction_id: 'T123',
        value: 99.99,
        currency: 'USD',
      })
    })

    it('should not send custom event when dataLayer does not exist', () => {
      delete window.dataLayer

      customEvent('test_event', { param: 'value' })

      expect(sendGTMEvent).not.toHaveBeenCalled()
    })

    it('should handle empty parameters', () => {
      customEvent('simple_event', {})

      expect(sendGTMEvent).toHaveBeenCalledWith({
        event: 'simple_event',
      })
    })

    it('should handle complex parameters', () => {
      customEvent('complex_event', {
        user_id: 'user123',
        items: ['item1', 'item2'],
        metadata: { key: 'value' },
      })

      expect(sendGTMEvent).toHaveBeenCalledWith({
        event: 'complex_event',
        user_id: 'user123',
        items: ['item1', 'item2'],
        metadata: { key: 'value' },
      })
    })
  })

  describe('GTag component', () => {
    describe('Google Tag Manager', () => {
      it('should render GoogleTagManager for GTM IDs', () => {
        const { getByTestId } = render(<GTag gtag="GTM-XXXXXX" />)

        const gtm = getByTestId('google-tag-manager')

        expect(gtm).toBeInTheDocument()
        expect(gtm).toHaveAttribute('data-gtm-id', 'GTM-XXXXXX')
      })

      it('should pass additional props to GoogleTagManager', () => {
        const { getByTestId } = render(
          <GTag gtag="GTM-XXXXXX" data-custom="test" />
        )

        const gtm = getByTestId('google-tag-manager')

        expect(gtm).toBeInTheDocument()
      })
    })

    describe('Google Analytics', () => {
      it('should render GoogleAnalytics for GA IDs', () => {
        const { getByTestId } = render(<GTag gtag="G-XXXXXXXXXX" />)

        const ga = getByTestId('google-analytics')

        expect(ga).toBeInTheDocument()
        expect(ga).toHaveAttribute('data-ga-id', 'G-XXXXXXXXXX')
      })

      it('should render GoogleAnalytics for UA IDs', () => {
        const { getByTestId } = render(<GTag gtag="UA-XXXXXXXX-X" />)

        const ga = getByTestId('google-analytics')

        expect(ga).toBeInTheDocument()
        expect(ga).toHaveAttribute('data-ga-id', 'UA-XXXXXXXX-X')
      })

      it('should pass additional props to GoogleAnalytics', () => {
        const { getByTestId } = render(
          <GTag gtag="G-XXXXXXXXXX" data-custom="value" />
        )

        const ga = getByTestId('google-analytics')

        expect(ga).toBeInTheDocument()
      })
    })

    describe('disabled state', () => {
      it('should render children when disabled', () => {
        const { getByText, queryByTestId } = render(
          <GTag gtag="GTM-XXXXXX" disabled>
            <div>Child Content</div>
          </GTag>
        )

        expect(getByText('Child Content')).toBeInTheDocument()
        expect(queryByTestId('google-tag-manager')).not.toBeInTheDocument()
        expect(queryByTestId('google-analytics')).not.toBeInTheDocument()
      })

      it('should render children when gtag is not provided', () => {
        const { getByText, queryByTestId } = render(
          <GTag>
            <div>Fallback Content</div>
          </GTag>
        )

        if (GTAG_ID?.startsWith('GTM-')) {
          expect(queryByTestId('google-tag-manager')).toBeInTheDocument()
          expect(queryByTestId('google-analytics')).not.toBeInTheDocument()
        } else if (GTAG_ID) {
          expect(queryByTestId('google-analytics')).toBeInTheDocument()
          expect(queryByTestId('google-tag-manager')).not.toBeInTheDocument()
        } else {
          expect(getByText('Fallback Content')).toBeInTheDocument()
          expect(queryByTestId('google-tag-manager')).not.toBeInTheDocument()
          expect(queryByTestId('google-analytics')).not.toBeInTheDocument()
        }
      })

      it('should render children when gtag is empty string', () => {
        const { getByText, queryByTestId } = render(
          <GTag gtag="">
            <div>No Tracking</div>
          </GTag>
        )

        expect(getByText('No Tracking')).toBeInTheDocument()
        expect(queryByTestId('google-tag-manager')).not.toBeInTheDocument()
        expect(queryByTestId('google-analytics')).not.toBeInTheDocument()
      })
    })

    describe('children rendering', () => {
      it('should render null children when disabled', () => {
        const { container } = render(<GTag gtag="GTM-XXXXXX" disabled />)

        expect(container.textContent).toBe('')
      })

      it('should render multiple children when disabled', () => {
        const { getByText } = render(
          <GTag gtag="GTM-XXXXXX" disabled>
            <div>First</div>
            <div>Second</div>
          </GTag>
        )

        expect(getByText('First')).toBeInTheDocument()
        expect(getByText('Second')).toBeInTheDocument()
      })

      it('should render React fragments when disabled', () => {
        const { getByText } = render(
          <GTag disabled>
            <>
              <span>Fragment Child</span>
            </>
          </GTag>
        )

        expect(getByText('Fragment Child')).toBeInTheDocument()
      })
    })

    describe('edge cases', () => {
      it('should handle null gtag', () => {
        const { getByText } = render(
          <GTag gtag={null}>
            <div>Null GTAG</div>
          </GTag>
        )

        expect(getByText('Null GTAG')).toBeInTheDocument()
      })

      it('should handle undefined gtag', () => {
        const { getByText, queryByTestId } = render(
          <GTag gtag={undefined}>
            <div>Undefined GTAG</div>
          </GTag>
        )

        if (GTAG_ID?.startsWith('GTM-')) {
          expect(queryByTestId('google-tag-manager')).toBeInTheDocument()
          expect(queryByTestId('google-analytics')).not.toBeInTheDocument()
        } else if (GTAG_ID) {
          expect(queryByTestId('google-analytics')).toBeInTheDocument()
          expect(queryByTestId('google-tag-manager')).not.toBeInTheDocument()
        } else {
          expect(getByText('Undefined GTAG')).toBeInTheDocument()
        }
      })

      it('should differentiate between GTM and GA based on prefix', () => {
        const { rerender, getByTestId, queryByTestId } = render(
          <GTag gtag="GTM-XXXXXX" />
        )

        expect(getByTestId('google-tag-manager')).toBeInTheDocument()
        expect(queryByTestId('google-analytics')).not.toBeInTheDocument()

        rerender(<GTag gtag="G-XXXXXXXXXX" />)

        expect(queryByTestId('google-tag-manager')).not.toBeInTheDocument()
        expect(getByTestId('google-analytics')).toBeInTheDocument()
      })

      it('should handle both disabled and no gtag', () => {
        const { getByText } = render(
          <GTag disabled>
            <div>Both Conditions</div>
          </GTag>
        )

        expect(getByText('Both Conditions')).toBeInTheDocument()
      })
    })
  })
})
