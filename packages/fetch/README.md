# @chatbotkit-dev/fetch

The platform's fetch client.

`fetchPlusPlus` is `withRetry(withTimeout(fetch))`: five attempts by default with exponential
backoff, a thirty second timeout, and retries on failed responses as well as thrown errors.

Use this rather than reimplementing a retry loop. An earlier hand rolled copy in the email provider
silently used three attempts with no backoff and no retry on failed responses.

Extracted from `platform/lib/fetch.js`.
