# Abilities Catalogue

This directory contains the **Abilities Catalogue** - a collection of YAML configuration files that define pre-built templates and packs for integrating with external services and APIs.

## Overview

The abilities catalogue provides ready-to-use integrations with popular services and platforms, enabling ChatBotKit conversational AI agents to interact with external systems. Each YAML file represents a service provider (e.g., GitHub, Slack, Notion, Google) and contains multiple ability definitions.

## What are Abilities?

Abilities are configurable templates that define:

- **Templates** - Reusable configurations with parameterized instructions for specific actions (e.g., "Create GitHub Issue", "Send Slack Message", "Search Notion")
- **Packs** - Collections of related abilities grouped together for complex workflows

Each ability includes:

- Service provider information
- Display name and description
- Executable instructions (HTTP requests, database queries, etc.)
- Parameter definitions with validation
- Authentication requirements
- Response transformations

## Structure

Each YAML file in this directory follows a consistent structure:

````yaml
service/action/operation:
  provider: 'service-name'
  icon: '@logo/domain.com'
  name: Human Readable Action Name
  description: What this ability does
  tags:
    - category
    - keywords
  instruction: |
    ```fetch
    method: GET
    url: https://api.example.com/endpoint
    headers:
      Authorization: ${SECRET_DEFAULT}
    ```
````

## Usage

These YAML files are:

1. Loaded by the platform at runtime
2. Made available to users through the abilities interface
3. Used to generate dynamic ability configurations
4. Executed when users invoke specific abilities in their conversational AI applications

## Development

For detailed instructions on creating and modifying catalogue files, see:

- `.agents/rules/platform.platform.data.abilities.catalogue.md`

To test catalogue files:

```bash
pnpm -F @chatbotkit/platform test:unit platform/data/abilities/catalogue/*.utest.{js,ts}
```

## Related Files

- `../all.ts` - Loads and exports all abilities
- `../visible.ts` - Filters visible abilities for the UI
- `../catalogue.d.ts` - TypeScript type definitions
