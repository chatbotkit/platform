# OpenAPI Types Generator

Generate typed interfaces for multiple programming languages from an OpenAPI specification, focusing on **route-level types** (request/response) rather than just shared component schemas.

## Installation

```bash
pnpm add @chatbotkit-dev/openapi-types-generator
```

## CLI Usage

```bash
# Generate Go types
npx openapi-types-generator v1.json --lang go --output types.go

# Generate Python types
npx openapi-types-generator v1.json --lang python --output types.py

# Generate Rust types with custom package name
npx openapi-types-generator v1.json --lang rust --output types.rs --package api_types

# Include component schemas
npx openapi-types-generator v1.json --lang go --output types.go --include-components
```

### CLI Options

| Option                  | Description               | Default  |
| ----------------------- | ------------------------- | -------- |
| `-l, --lang <language>` | Target language           | Required |
| `-o, --output <file>`   | Output file path          | stdout   |
| `-p, --package <name>`  | Package/module name       | `types`  |
| `--include-components`  | Include component schemas | `false`  |

### Supported Languages

- Go
- Python (with type hints)
- Rust
- Java
- Kotlin
- Swift
- C#
- TypeScript
- Ruby
- C++

## Programmatic Usage

```javascript
import { generateFromOpenAPI } from '@chatbotkit-dev/openapi-types-generator'

import fs from 'node:fs/promises'

const spec = await fs.readFile('openapi.json', 'utf-8')

const goTypes = await generateFromOpenAPI(spec, {
  language: 'go',
  packageName: 'api',
  includeComponents: true,
})

console.log(goTypes)
```

## Generated Type Names

Routes are converted to PascalCase type names:

| Route                             | Method | Request Type                    | Response Type                     |
| --------------------------------- | ------ | ------------------------------- | --------------------------------- |
| `/bot/create`                     | POST   | `BotCreateRequest`              | `BotCreateResponse`               |
| `/bot/{botId}/fetch`              | GET    | `BotFetchParams`                | `BotFetchResponse`                |
| `/conversation/{id}/message/list` | GET    | `ConversationMessageListParams` | `ConversationMessageListResponse` |

Routes with `application/jsonl` responses also produce a stream item type such
as `BotListStreamItem` or `ConversationCompleteStreamItem`.

## How It Works

1. **Parse** - Uses `swagger-client` to resolve all `$ref` references
2. **Extract** - Pulls request bodies, JSON/JSONL responses, and parameters from each route
3. **Name** - Converts route paths to PascalCase type names
4. **Generate** - Uses `quicktype-core` to generate typed code for the target language
