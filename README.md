<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="platform/public/icon-dark.svg">
  <img alt="ChatBotKit" src="platform/public/icon-light.svg" width="60">
</picture>

<br/>

<h1>AI platform in a Box</h1>

<p>
  <strong>A modern, sovereign AI backend for products<br>
  and enterprise deployments.</strong>
</p>

<p>
  <img alt="Node 24+" src="https://img.shields.io/badge/node-%E2%89%A524.20-0a0a0a?style=flat-square&logo=node.js&logoColor=white">
  <img alt="pnpm 11" src="https://img.shields.io/badge/pnpm-11-0a0a0a?style=flat-square&logo=pnpm&logoColor=white">
  <img alt="TypeScript 6" src="https://img.shields.io/badge/TypeScript-6-0a0a0a?style=flat-square&logo=typescript&logoColor=white">
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-0a0a0a?style=flat-square&logo=nextdotjs&logoColor=white">
  <img alt="Docker Compose" src="https://img.shields.io/badge/docker-compose%20up-0a0a0a?style=flat-square&logo=docker&logoColor=white">
</p>

<p>
  <a href="#run-it"><strong>Run it</strong></a> ·
  <a href="https://chatbotkit.com/overview"><strong>Try it</strong></a> ·
  <a href="./docs/README.md"><strong>Documentation</strong></a> ·
  <a href="./docs/architecture.md"><strong>Architecture</strong></a> ·
  <a href="./CONTRIBUTING.md"><strong>Contributing</strong></a> ·
</p>

</div>

<p align="center">
  <img width="2064" height="1400" alt="AI Platform" src="https://github.com/user-attachments/assets/714f6a5c-5b82-4b2a-af6a-51a1ce7260a1" />
</p>

Get the breadth of a managed AI platform with control over the infrastructure,
data and extension points. Use it behind customer products, internal systems,
and regulated deployments without handing the AI control plane to a managed
provider.

## A complete platform

- Agent builder and runtime
- Multi-provider model gateway
- Knowledge ingestion and retrieval
- More than 200 typed integrations
- MCP, OpenAPI, GraphQL and code tools
- Sandboxed code and shell execution
- Web widgets, portals and messaging channels
- REST and GraphQL APIs, webhooks and generated client types
- Node.js, Python and Go SDKs and a Terraform provider
- Authentication, users, teams, contacts and multi-tenant identity
- Access control, moderation, PII protection and audit
- Traces, events, ratings, usage and operational logs
- Replaceable database, storage, cache, queue and vector infrastructure

## Run it

Run the complete prebuilt stack with one command - no checkout, no build:

```bash
docker compose -f oci://ghcr.io/chatbotkit/platform-community:latest up
```

Open <http://cbk.localhost:3000>. Sign in with any email address and read the
six-digit code from the platform container log:

```bash
docker compose -f oci://ghcr.io/chatbotkit/platform-community:latest logs platform
```

See [Deployment](./docs/deployment.md) for details.

## Local development

Binary assets are stored with Git LFS, so install it (`git lfs install`)
before cloning. From a fresh checkout, run

```bash
docker compose up
```

Open <http://127.0.0.1:8080>. See
[Getting started](./docs/getting-started.md) for host-side development,
storage configuration and the first model connection.

## Documentation

- [Getting started](./docs/getting-started.md)
- [Deployment and production status](./docs/deployment.md)
- [Module defaults](./docs/module-defaults.md)
- [Operator configuration](./docs/configuration.md)
- [Architecture and repository map](./docs/architecture.md)
- [Licensing](./LICENSING.md)
- [Contributing](./CONTRIBUTING.md)
- [Security](./SECURITY.md)
