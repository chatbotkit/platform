# Eventlog App

Advanced event log analysis and viewing tool for the ChatBotKit platform.

## Purpose

The Eventlog app provides a comprehensive interface for viewing, filtering, and analyzing event logs across all ChatBotKit resources and integrations. It is designed to be:

1. **Available through portals** - Can be accessed via portal configurations
2. **Embeddable** - Uses a pullout/slideout panel design pattern (no header/footer)
3. **Developer-friendly** - Clean UI for log visualization

## Features

### Main Log List View

- **Timestamp Display**: Relative (e.g., "5 minutes ago") and absolute times
- **Status Tags**: Color-coded status indicators:
  - 🔴 Red for `.error` events
  - 🟡 Yellow/Orange for `.warning` events
  - 🟢 Green for success events
- **Event Type**: Clear event type labeling with human-readable names
- **Related Resources**: Quick view of associated resources (bot, conversation, integration, etc.)

### Filtering & Search

- **Type Filter**: Filter by event category (action, bot, conversation, etc.)
- **Status Filter**: Filter by error, warning, or success status
- **Search**: Full-text search across event type, name, description, and ID
- **Auto-refresh**: Toggle automatic refresh every 30 seconds

### Detail View

Click any log entry to see:

- Full metadata in YAML/JSON format
- All related resource links
- Timestamp details
- Copy functionality for debugging

### Additional Features

- **Cursor-based Pagination**: Load more events on demand
- **Export**: Link to the export endpoint for bulk data
- **Virtualized Scrolling**: Uses VList for efficient rendering of large log lists

## Architecture

```
eventlog/
├── app.manifest      # App configuration (developer category, order 1001)
├── const.ts          # APP_NAME and CONTACT_NAMESPACE exports
├── config.ts         # Zod schema for app configuration
├── layout.jsx        # App layout (embeddable - no header/footer)
├── page.tsx          # Server component for initial data loading
├── components.jsx    # Client components (Main, FilterBar, LogRow, LogDetail)
├── server.ts         # Server actions for fetching logs
└── README.md         # This file
```

## Data Fetching

The app uses the `/api/v1/event/log/list` endpoint which supports:

- `cursor` - Pagination cursor
- `order` - 'asc' or 'desc'
- `take` - Number of items (default 50)
- `type` - Filter by event type
- Resource filters: `botId`, `conversationId`, `blueprintId`, etc.

## Event Types

Event types are defined in `@/lib/event` and include:

- Bot events: `bot.create`, `bot.update`, `bot.delete`
- Conversation events: `conversation.create`, `conversation.update`, etc.
- Message events: `message.create`, `message.update`, `message.delete`
- Action events: `action.search`, `action.fetch`, `action.email`, etc.
- Integration events: `integration.connect`, `integration.disconnect`
- System events: `system.error`, `api.error`, etc.

## Usage

Access the app at `/apps/eventlog` or embed it in portals for developer access to event logs.
