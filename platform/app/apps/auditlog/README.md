# Auditlog App

Audit log analysis and review tool for the ChatBotKit platform.

## Purpose

The Auditlog app now follows the same dedicated app pattern as `eventlog`
instead of embedding the generic shared audit log widget. That gives it a
proper initial server load, app-specific filters, richer row rendering, and a
detail view tailored to audit data.

## Features

- Server-backed initial audit log load with cursor pagination
- Dedicated audit-focused table layout inside the apps shell
- Action and resource filters with optional auto refresh
- Change inspection for `oldValues` and `newValues`
- Request context visibility for IP address, user agent, and metadata

## Architecture

```
auditlog/
├── app.manifest
├── const.ts
├── config.ts
├── components.jsx
├── layout.jsx
├── page.tsx
├── server.ts
└── README.md
```

## Usage

Access the app at `/apps/auditlog`.
