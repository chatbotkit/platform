# @chatbotkit-dev/debug

Namespaced logging, assertions and spans.

`debug('...').log('key')` emits only when the key is enabled by the active
configuration. The built-in default is driven by the `DEBUG_KEYS`, `WARN_KEYS`
and `ERROR_KEYS` environment variables; a deployment with opinions about its
own subsystems supplies a full `DebugConfig` through `configure()` at boot.
Spans go to [`@chatbotkit-dev/observability`](../observability).

Extracted from `platform/lib/debug.ts`.
