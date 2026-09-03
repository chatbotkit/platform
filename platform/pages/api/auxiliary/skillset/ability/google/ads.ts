import { authenticatedMultiHandler } from '@/lib/auxiliary.handler'
import type { Session } from '@/lib/session.handler'
import call, { getCallError } from '@/lib/call'
import debug from '@/lib/debug'
import { throwNotAuthenticated } from '@/lib/response'

import { z } from 'zod'

// @see https://github.com/PipedreamHQ/pipedream/blob/master/components/google_ads/google_ads.app.mjs
const GOOGLE_ADS_PROXY_URL = 'https://googleads.m.pipedream.net'
const DEFAULT_GOOGLE_ADS_API_VERSION = 'v25'
const DEFAULT_GEO_TARGET_CONSTANTS = ['geoTargetConstants/2840']
const DEFAULT_LANGUAGE = 'languageConstants/1000'

const customerIdSchema = z.string().refine(
  (value) => {
    return /^\d[\d-]*$/.test(value) && value.replaceAll('-', '').length === 10
  },
  {
    message: 'customer ID must contain exactly 10 digits',
  }
)

const keywordArraySchema = z.preprocess(
  coerceJson,
  z.array(z.string().trim().min(1)).min(1)
)

const optionalStringArraySchema = z.preprocess(
  coerceJson,
  z.array(z.string().trim().min(1)).optional()
)

const keywordPlanNetworkSchema = z
  .enum(['GOOGLE_SEARCH', 'GOOGLE_SEARCH_AND_PARTNERS'])
  .default('GOOGLE_SEARCH')

// --- Handler Names ---

export const CUSTOMER_LIST_HANDLER_NAME = 'customer/list' as const
export const KEYWORD_IDEAS_HANDLER_NAME = 'keyword-ideas/search' as const
export const KEYWORD_HISTORICAL_METRICS_HANDLER_NAME =
  'keyword-historical-metrics/fetch' as const
export const KEYWORD_FORECAST_METRICS_HANDLER_NAME =
  'keyword-forecast-metrics/fetch' as const
export const API_CALL_HANDLER_NAME = 'api/call' as const

// --- Schemas ---

export const customerListSchema = z.object({
  loginCustomerId: customerIdSchema.optional(),
})

export type CustomerListSchema = z.infer<typeof customerListSchema>

export const keywordIdeasSchema = z
  .object({
    customerId: customerIdSchema,
    loginCustomerId: customerIdSchema.optional(),
    keywords: optionalStringArraySchema,
    url: z.string().url().optional(),
    siteUrl: z.string().url().optional(),
    geoTargetConstants: optionalStringArraySchema,
    language: z.string().trim().min(1).default(DEFAULT_LANGUAGE),
    keywordPlanNetwork: keywordPlanNetworkSchema,
    includeAdultKeywords: z.boolean().default(false),
    pageSize: z.number().int().min(1).max(10000).default(1000),
    pageToken: z.string().trim().min(1).optional(),
  })
  .superRefine(({ keywords, url, siteUrl }, context) => {
    if (!keywords?.length && !url && !siteUrl) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'at least one of keywords, url, or siteUrl is required',
      })
    }

    if (siteUrl && (keywords?.length || url)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'siteUrl cannot be combined with keywords or url',
      })
    }
  })

export type KeywordIdeasSchema = z.infer<typeof keywordIdeasSchema>

export const keywordHistoricalMetricsSchema = z.object({
  customerId: customerIdSchema,
  loginCustomerId: customerIdSchema.optional(),
  keywords: keywordArraySchema,
  geoTargetConstants: optionalStringArraySchema,
  language: z.string().trim().min(1).default(DEFAULT_LANGUAGE),
  keywordPlanNetwork: keywordPlanNetworkSchema,
  includeAdultKeywords: z.boolean().default(false),
  includeAverageCpc: z.boolean().default(true),
})

export type KeywordHistoricalMetricsSchema = z.infer<
  typeof keywordHistoricalMetricsSchema
>

export const keywordForecastMetricsSchema = z
  .object({
    customerId: customerIdSchema,
    loginCustomerId: customerIdSchema.optional(),
    keywords: keywordArraySchema,
    matchType: z.enum(['BROAD', 'PHRASE', 'EXACT']).default('BROAD'),
    geoTargetConstants: optionalStringArraySchema,
    languageConstants: optionalStringArraySchema,
    maxCpcBidMicros: z.number().int().positive(),
    dailyBudgetMicros: z.number().int().positive().optional(),
    currencyCode: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/)
      .optional(),
    startDate: z.string().date().optional(),
    endDate: z.string().date().optional(),
  })
  .superRefine(({ startDate, endDate }, context) => {
    if (!!startDate !== !!endDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'startDate and endDate must be supplied together',
      })
    }
  })

export type KeywordForecastMetricsSchema = z.infer<
  typeof keywordForecastMetricsSchema
>

export const apiCallSchema = z.object({
  path: z
    .string()
    .trim()
    .min(1)
    .refine(
      (value) =>
        !value.includes('://') &&
        !value.startsWith('//') &&
        !value.includes('\\'),
      {
        message: 'path must be relative to the Google Ads API',
      }
    ),
  loginCustomerId: customerIdSchema.optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
  query: z.preprocess(
    coerceJson,
    z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
  ),
  data: z.preprocess(coerceJson, z.record(z.any()).optional()),
})

export type ApiCallSchema = z.infer<typeof apiCallSchema>

// --- Helpers ---

function coerceJson(value: unknown) {
  if (typeof value !== 'string') {
    return value
  }

  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function normalizeCustomerId(customerId: string) {
  return customerId.replaceAll('-', '')
}

function getApiVersion() {
  const version =
    process.env.SERVICE_GOOGLE_ADS_API_VERSION ||
    process.env._GOOGLE_ADS_API_VERSION ||
    DEFAULT_GOOGLE_ADS_API_VERSION

  if (!/^v\d+$/.test(version)) {
    throw new Error('Google Ads API version must have the form v<number>')
  }

  return version
}

function getAccessToken(headers: Headers) {
  const token = headers.get('x-access-token')

  if (!token) {
    return throwNotAuthenticated()
  }

  return token
}

function buildGoogleAdsPath(path: string) {
  const relativePath = path.replace(/^\/+/, '')

  return `/${getApiVersion()}/${relativePath}`
}

async function requestGoogleAds({
  headers,
  path,
  loginCustomerId,
  method,
  query,
  data,
}: {
  headers: Headers
  path: string
  loginCustomerId?: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  query?: Record<string, string | number | boolean>
  data?: Record<string, unknown>
}) {
  const accessToken = getAccessToken(headers)
  const upstreamMethod = method || (data ? 'POST' : 'GET')

  // @note Pipedream's Google Ads proxy supplies the developer-token layer for
  // its OAuth app. Calling Google Ads directly with a Pipedream-minted OAuth
  // token would couple credentials from different Google Cloud projects.
  const response = await call(GOOGLE_ADS_PROXY_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      headers: {
        Authorization: accessToken,
        ...(loginCustomerId
          ? { 'login-customer-id': normalizeCustomerId(loginCustomerId) }
          : {}),
      },
      path: buildGoogleAdsPath(path),
      method: upstreamMethod,
      ...(query ? { params: query } : {}),
      ...(data ? { data } : {}),
    }),
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  return await response.json()
}

function getKeywordIdeasSeed({
  keywords,
  url,
  siteUrl,
}: Pick<KeywordIdeasSchema, 'keywords' | 'url' | 'siteUrl'>) {
  if (siteUrl) {
    return { siteSeed: { site: siteUrl } }
  }

  if (keywords?.length && url) {
    return { keywordAndUrlSeed: { keywords, url } }
  }

  if (url) {
    return { urlSeed: { url } }
  }

  return { keywordSeed: { keywords } }
}

// --- Handlers ---

async function customerListHandler(
  _session: Session,
  parameters: CustomerListSchema,
  headers: Headers
) {
  debug(`google/ads/customer/list`, { parameters }).log(
    'auxiliary.skillset.ability.google.ads.customerListHandler'
  )

  return await requestGoogleAds({
    headers,
    path: 'customers:listAccessibleCustomers',
    loginCustomerId: parameters.loginCustomerId,
  })
}

async function keywordIdeasHandler(
  _session: Session,
  parameters: KeywordIdeasSchema,
  headers: Headers
) {
  debug(`google/ads/keyword-ideas/search`, { parameters }).log(
    'auxiliary.skillset.ability.google.ads.keywordIdeasHandler'
  )

  const {
    customerId,
    loginCustomerId,
    geoTargetConstants,
    language,
    keywordPlanNetwork,
    includeAdultKeywords,
    pageSize,
    pageToken,
  } = parameters

  return await requestGoogleAds({
    headers,
    path: `customers/${normalizeCustomerId(customerId)}:generateKeywordIdeas`,
    loginCustomerId,
    data: {
      ...getKeywordIdeasSeed(parameters),
      geoTargetConstants: geoTargetConstants || DEFAULT_GEO_TARGET_CONSTANTS,
      language,
      keywordPlanNetwork,
      includeAdultKeywords,
      pageSize,
      ...(pageToken ? { pageToken } : {}),
    },
  })
}

async function keywordHistoricalMetricsHandler(
  _session: Session,
  parameters: KeywordHistoricalMetricsSchema,
  headers: Headers
) {
  debug(`google/ads/keyword-historical-metrics/fetch`, { parameters }).log(
    'auxiliary.skillset.ability.google.ads.keywordHistoricalMetricsHandler'
  )

  const {
    customerId,
    loginCustomerId,
    keywords,
    geoTargetConstants,
    language,
    keywordPlanNetwork,
    includeAdultKeywords,
    includeAverageCpc,
  } = parameters

  return await requestGoogleAds({
    headers,
    path: `customers/${normalizeCustomerId(customerId)}:generateKeywordHistoricalMetrics`,
    loginCustomerId,
    data: {
      keywords,
      geoTargetConstants: geoTargetConstants || DEFAULT_GEO_TARGET_CONSTANTS,
      language,
      keywordPlanNetwork,
      includeAdultKeywords,
      historicalMetricsOptions: {
        includeAverageCpc,
      },
    },
  })
}

async function keywordForecastMetricsHandler(
  _session: Session,
  parameters: KeywordForecastMetricsSchema,
  headers: Headers
) {
  debug(`google/ads/keyword-forecast-metrics/fetch`, { parameters }).log(
    'auxiliary.skillset.ability.google.ads.keywordForecastMetricsHandler'
  )

  const {
    customerId,
    loginCustomerId,
    keywords,
    matchType,
    geoTargetConstants,
    languageConstants,
    maxCpcBidMicros,
    dailyBudgetMicros,
    currencyCode,
    startDate,
    endDate,
  } = parameters

  return await requestGoogleAds({
    headers,
    path: `customers/${normalizeCustomerId(customerId)}:generateKeywordForecastMetrics`,
    loginCustomerId,
    data: {
      campaign: {
        biddingStrategy: {
          manualCpcBiddingStrategy: {
            maxCpcBidMicros,
            ...(dailyBudgetMicros ? { dailyBudgetMicros } : {}),
          },
        },
        geoTargetConstants: geoTargetConstants || DEFAULT_GEO_TARGET_CONSTANTS,
        languageConstants: languageConstants || [DEFAULT_LANGUAGE],
        adGroups: [
          {
            keywords: keywords.map((text) => ({
              text,
              matchType,
            })),
          },
        ],
      },
      ...(currencyCode ? { currencyCode } : {}),
      ...(startDate && endDate
        ? {
            forecastPeriod: {
              startDate,
              endDate,
            },
          }
        : {}),
    },
  })
}

async function apiCallHandler(_session: Session, parameters: ApiCallSchema, headers: Headers) {
  debug(`google/ads/api/call`, { parameters }).log(
    'auxiliary.skillset.ability.google.ads.apiCallHandler'
  )

  return await requestGoogleAds({
    headers,
    ...parameters,
  })
}

// --- Export Multi Handler ---

export default authenticatedMultiHandler({
  [CUSTOMER_LIST_HANDLER_NAME]: {
    schema: customerListSchema,
    fn: customerListHandler,
  },
  [KEYWORD_IDEAS_HANDLER_NAME]: {
    schema: keywordIdeasSchema,
    fn: keywordIdeasHandler,
  },
  [KEYWORD_HISTORICAL_METRICS_HANDLER_NAME]: {
    schema: keywordHistoricalMetricsSchema,
    fn: keywordHistoricalMetricsHandler,
  },
  [KEYWORD_FORECAST_METRICS_HANDLER_NAME]: {
    schema: keywordForecastMetricsSchema,
    fn: keywordForecastMetricsHandler,
  },
  [API_CALL_HANDLER_NAME]: {
    schema: apiCallSchema,
    fn: apiCallHandler,
  },
})
