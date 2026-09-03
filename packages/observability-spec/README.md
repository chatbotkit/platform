# @chatbotkit-dev/observability-spec

The **contract** for error reporting and tracing. Types only.

Separate from [`@chatbotkit-dev/observability`](../observability) because that
package is swappable, and an implementation cannot import the package it
replaces.

## Why this exists

The platform previously imported a vendor SDK directly from its debug and error
modules. That put the SDK in the dependency path of a self hosted deployment
that had not selected that provider, and made the platform's error handling
untestable without stubbing the vendor.

`Span` is not a new design. The platform's `createSpan` already returned this
shape, with a console fallback when Sentry was disabled by feature flag. The
contract records what was already true.

## Two framework specific members

`getTracePropagationData` and `captureFrameworkError` exist because the web
framework's error boundary and document head need them. They are named for what
they do rather than after any vendor's method, and an implementation that does
not trace returns an empty object.
