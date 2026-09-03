/**
 * The wire prefix for independently authenticated internal header assertions.
 */
export const CHATBOTKIT_ASSERTION_HEADER_PREFIX = 'x-chatbotkit-assertion-'

/**
 * An internal header that specifies the frontend host for internal routing
 * purposes. It is essentially the preserved x-forwarded-host header from the
 * very first request made by the user to Chatbotkit, bypassing all potential
 * proxy rewrites along the way.
 */
export const CHATBOTKIT_INTERNAL_FRONTEND_HOST_HEADER_NAME =
  'x-chatbotkit-internal-frontend-host'

/**
 * An internal header that specifies the real IP of the user making the
 * request. It is essentially the preserved x-real-ip header from the
 * very first request made by the user to Chatbotkit, bypassing all potential
 * proxy rewrites along the way.
 */
export const CHATBOTKIT_INTERNAL_REAL_IP_HEADER_NAME =
  'x-chatbotkit-internal-real-ip'

/**
 * An external header that specifies the timezone of the user making the
 * request.
 */
export const TIMEZONE_HEADER_NAME = 'x-timezone'
