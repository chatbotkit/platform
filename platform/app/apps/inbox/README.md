# Inbox App

The Inbox app provides a unified interface for managing and responding to conversations from multiple messaging channels.

## Purpose

- View conversations from all connected integrations in a single inbox
- Filter conversations by channel (widget, Slack, Discord, etc.)
- Navigate into individual conversations for detailed viewing

## Architecture

```
inbox/
├── app.manifest             # App configuration (main category, order 40)
├── const.ts                 # APP_NAME and CONTACT_NAMESPACE exports
├── config.ts                # Zod schema for app configuration (filters)
├── layout.jsx               # App layout (embeddable - no header/footer, sidebar)
├── page.tsx                 # Redirect to default tab
├── components.jsx           # Client components (Conversations)
├── server.ts                # Server actions for listing conversations
├── [conversationId]/        # Individual conversation view
│   └── server.ts            # Server actions for conversation detail
└── README.md                # This file
```

## Key Behavior

- Embeddable panel design (no standard header/footer)
- Sidebar navigation with configurable tabs (Latest, by integration)
- Filters conversations by integration type via `config.filters.integration`
- Supports delete operations on conversations
- Uses `ConversationList` component for consistent rendering
