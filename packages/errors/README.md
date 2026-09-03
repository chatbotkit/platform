# @chatbotkit-dev/errors

The platform's error taxonomy.

`SystemError` and its subclasses, and the reporting helpers that decide which errors are worth
reporting. The distinction matters: `captureException` filters on this taxonomy, so an error that
does not extend it is classified differently.

Reports through [`@chatbotkit-dev/observability`](../observability), so it does not know which error
tracker, if any, a deployment runs.

Extracted from `platform/lib/error.js`.
