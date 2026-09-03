# @chatbotkit-dev/http-codes

HTTP status codes, failure codes, and the maps between them.

Pure data, no dependencies.

Split out of `platform/lib/response.js`, which carried a standing `@todo split this into multiple
files`. The response handlers stayed in the application because they construct framework `Response`
objects; this half is shared by anything speaking the platform's HTTP conventions, including its
fetch client.

Named `http-codes` rather than `http` because `platform/lib/http.ts` already exists and is
something else.
