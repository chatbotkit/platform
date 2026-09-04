/**
 * @jest-environment node
 */
import batchProvider from '@chatbotkit-dev/batch'
import { assertConfigured as assertBillingConfigured } from '@chatbotkit-dev/billing/assert'
import { assertConfigured as assertDbConfigured } from '@chatbotkit-dev/db'
import emailProvider from '@chatbotkit-dev/email'
import memcacheProvider from '@chatbotkit-dev/memcache'
import observabilityProvider from '@chatbotkit-dev/observability'
import { assertConfigured as assertPartnersConfigured } from '@chatbotkit-dev/partners/assert'
import piiProvider from '@chatbotkit-dev/pii'
import queueProvider from '@chatbotkit-dev/queue'
import relayProvider from '@chatbotkit-dev/relay'
import respondProvider from '@chatbotkit-dev/respond'
import sandboxProvider from '@chatbotkit-dev/sandbox'
import screenshotProvider from '@chatbotkit-dev/screenshot'
import searchEngineProvider from '@chatbotkit-dev/searchengine'
import { assertConfigured as assertSecretsPlatformConfigured } from '@chatbotkit-dev/secrets-platform'
import { assertConfigured as assertStorageConfigured } from '@chatbotkit-dev/storage'
import vectorProvider from '@chatbotkit-dev/vector'

import limits from '@/config/limits'

import { isSellable } from '@/lib/billing.core'
import { retrievePrice } from '@chatbotkit-dev/billing/provider'

const itIfBatchConfigured = [
  'BATCH_BASE_URL',
  'BATCH_CLIENT_ID',
  'BATCH_CLIENT_SECRET',
].some((name) => process.env[name])
  ? it
  : it.skip

const itIfVectorConfigured = process.env.OPENAI_API_KEY ? it : it.skip

const itIfRelayConfigured =
  process.env.RELAY_URL || process.env.CFWSRELAY_BASE_URL ? it : it.skip

const itIfScreenshotConfigured = process.env.CFWEBSHOT_BASE_URL ? it : it.skip

const itIfRespondConfigured = process.env.CFRESPOND_BASE_URL ? it : it.skip

const itIfStorageConfigured = Object.keys(process.env).some((name) =>
  name.endsWith('_S3_BUCKET_NAME')
)
  ? it
  : it.skip

// @note billing conformity only means something in a sellable deployment -
// an unsellable one has nothing to conform
const itIfSellable = isSellable ? it : it.skip

// @note swappable modules resolve their configuration lazily, so that the
// platform can be imported, built and storied without a vendor's credentials
// present. That deliberately moves the failure from boot to first use.
//
// This is where the guarantee comes back. These tests run with the
// application's environment loaded, so a module whose configuration is missing
// fails the suite rather than failing a user months later. They validate
// whichever implementation is installed: a module needing no configuration
// passes trivially.
//
// Add a case here for every swappable module. See packages/AGENTS.md.

describe('installed modules are configured', () => {
  it('email', async () => {
    await expect(emailProvider.assertConfigured()).resolves.toBeUndefined()
  })

  it('platform secrets', async () => {
    await expect(assertSecretsPlatformConfigured()).resolves.toBeUndefined()
  })

  it('observability', async () => {
    await expect(
      observabilityProvider.assertConfigured()
    ).resolves.toBeUndefined()
  })

  it('pii', async () => {
    await expect(piiProvider.assertConfigured()).resolves.toBeUndefined()
  })

  it('sandbox', async () => {
    await expect(sandboxProvider.assertConfigured()).resolves.toBeUndefined()
  })

  itIfBatchConfigured('batch', async () => {
    await expect(batchProvider.assertConfigured()).resolves.toBeUndefined()
  })

  itIfVectorConfigured('vector', async () => {
    await expect(vectorProvider.assertConfigured()).resolves.toBeUndefined()
  })

  it('queue', async () => {
    await expect(queueProvider.assertConfigured()).resolves.toBeUndefined()
  })

  it('database', async () => {
    await expect(assertDbConfigured()).resolves.toBeUndefined()
  })

  itIfRelayConfigured('realtime relay', async () => {
    await expect(relayProvider.assertConfigured()).resolves.toBeUndefined()
  })

  itIfScreenshotConfigured('page capture', async () => {
    await expect(screenshotProvider.assertConfigured()).resolves.toBeUndefined()
  })

  itIfRespondConfigured('canned responses', async () => {
    await expect(respondProvider.assertConfigured()).resolves.toBeUndefined()
  })

  it('search engine', async () => {
    await expect(
      searchEngineProvider.assertConfigured()
    ).resolves.toBeUndefined()
  })

  itIfStorageConfigured('object storage', async () => {
    await expect(assertStorageConfigured()).resolves.toBeUndefined()
  })

  it('key-value store', async () => {
    await expect(memcacheProvider.assertConfigured()).resolves.toBeUndefined()
  })

  it('partner catalogue', async () => {
    await expect(assertPartnersConfigured()).resolves.toBeUndefined()
  })

  itIfSellable(
    'billing catalogue',
    async () => {
      await expect(
        assertBillingConfigured({
          limits,
          retrievePrice,
        })
      ).resolves.toBeUndefined()
    },
    15000 // multiple payment-provider API calls
  )
})
