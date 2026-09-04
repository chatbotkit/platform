# Developing against the platform

The platform serves the same REST and GraphQL API as the hosted product, and
the official SDKs talk to it once they are pointed at your deployment instead
of `api.chatbotkit.com`. This document covers that switch for Node.js, Python,
Go and Terraform. It is not an SDK reference; each SDK's README and
[docs.cbk.ai](https://docs.cbk.ai) cover the resources and calls.

## Where the API is

Every deployment serves the API on its own origin under `/api/v1`, with no
configuration. The origin depends on how you run the platform:

| How it runs                                  | Origin                      |
| -------------------------------------------- | --------------------------- |
| Host-side `pnpm dev`                         | `http://127.0.0.1:8080`     |
| `docker compose up` in a checkout            | `http://127.0.0.1:8080`     |
| Prebuilt community stack                     | `http://cbk.localhost:3000` |
| A deployment with `API_URL` set              | that URL                    |

The two entry points are:

- REST: `<origin>/api/v1/...`, described by the OpenAPI document at
  `<origin>/api/v1/spec`
- GraphQL: `<origin>/api/v1/graphql`

A deployment that sets `API_URL` additionally answers under the clean `/v1`
path on that host, but `/api/v1` keeps working there too, so an SDK base URL
never needs a path suffix. See [Deployment](./deployment.md#api-endpoint).

## Create an API token

Sign in and open `/tokens` to create a token. The
SDKs send it as a bearer token. The value shown at creation time is the only
copy, so store it where the client will read it.

The Node.js SDK and CLI read `CHATBOTKIT_API_SECRET`, and the Terraform
provider reads `CHATBOTKIT_API_KEY`. The Python and Go SDKs take the token as
a constructor argument; pass it from whatever environment variable you prefer.

## Point an SDK at your deployment

Each SDK defaults to `https://api.chatbotkit.com` and has one option that
replaces it. The SDKs build request paths as `/api/v1/...` and only strip the
`/api` prefix for the hosted API host, so the override is the bare origin of
your deployment, with no `/api` suffix.

None of the SDKs read the base URL from the environment. Set it in code or
provider configuration, sourcing the value from your own configuration if the
same program has to run against both a local deployment and the hosted API.

### Node.js

```bash
npm install @chatbotkit/sdk
```

```javascript
import { BotClient } from '@chatbotkit/sdk/bot/index.js'

const bot = new BotClient({
  secret: process.env.CHATBOTKIT_API_SECRET,
  baseUrl: 'http://127.0.0.1:8080',
})

const { items } = await bot.list()
```

Every client class accepts the same options. `host` and `protocol` are
available when only one part of the URL changes. The `@chatbotkit/react`
components call your own backend route rather than the API directly, so the
base URL lives in that route, not in the browser.

### Python

```bash
pip install chatbotkit
```

```python
import os
from chatbotkit import ChatBotKit

cbk = ChatBotKit(
    secret=os.environ["CHATBOTKIT_API_SECRET"],
    base_url="http://127.0.0.1:8080",
)

bots = await cbk.bot.list({"take": 10})
```

### Go

```bash
go get github.com/chatbotkit/go-sdk
```

```go
client := sdk.New(sdk.Options{
	Secret:  os.Getenv("CHATBOTKIT_API_SECRET"),
	BaseURL: "http://127.0.0.1:8080",
})

bots, err := client.Bot.List(ctx, nil)
```

### Terraform

The provider speaks GraphQL, so its `base_url` is the full GraphQL endpoint
rather than the origin.

```terraform
provider "chatbotkit" {
  api_key  = var.chatbotkit_api_key # or CHATBOTKIT_API_KEY
  base_url = "http://127.0.0.1:8080/api/v1/graphql"
}
```

Resources created this way live in the deployment's own database. Keep one
state per deployment; a state file written against the hosted API does not
describe a local instance.

## Things that differ from the hosted API

- **Models.** A deployment only advertises the providers it has credentials
  for, and model-backed responses need at least one provider key. See
  [Getting started](./getting-started.md#add-a-model-provider).
- **Plans and limits.** With no `LIMITS_CONFIG` there is no plan concept and
  no quota. Code that inspects plan names or entitlement errors sees neither.
- **Webhooks and callbacks.** The platform advertises callback URLs from
  `SITE_URL` or `API_URL`. A deployment reachable only on loopback cannot
  receive calls from external services; expose it with a tunnel and set those
  variables to the public address before testing integrations that call back.
- **Files.** Upload and download flows use presigned object-storage URLs. On
  the Compose stack those name the `garage` service, which needs the hosts-file
  entry described in [Getting started](./getting-started.md).
- **Email.** Without an email vendor, sign-in codes and invitations print to
  the server log instead of being delivered.

## Verify the connection

A plain HTTP call confirms the origin and token before involving an SDK:

```bash
curl -H "Authorization: Bearer $CHATBOTKIT_API_SECRET" \
  http://127.0.0.1:8080/api/v1/bot/list
```

A `401` means the token is wrong or belongs to another deployment. A `404` or
an HTML response means the origin is wrong; check the port for the way the
platform is running.
