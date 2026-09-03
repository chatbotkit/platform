# Chat App

The Chat app is the flagship application for multi-agent management and AI collaboration, providing a unified conversational canvas for interacting with multiple bots simultaneously.

## Purpose

- Interact with multiple AI agents within a single conversation interface
- Switch between bots, models, and context sources seamlessly
- Manage ongoing conversations and start new ones
- Support embedded and standalone usage modes

## Architecture

```
chat/
├── app.manifest             # App configuration (main category, order 0)
├── const.ts                 # APP_NAME and CONTACT_NAMESPACE exports
├── config.ts                # Zod schema for app configuration
├── layout.jsx               # App layout loading bots, models, sources, conversations
├── [[...args]]/             # Catch-all route for conversation routing
├── animations/              # Animation components (InputMentionsAnimation, TextSelectionAnimation)
├── components/              # Client components (Main, ChatArea, Form, Selector, etc.)
├── hooks/                   # App-specific hooks (useDebugMode, etc.)
├── lib.ts                   # Shared utility functions
├── server.tsx               # Server actions for listing bots, models, sources, and conversations
└── README.md                # This file
```

## Key Behavior

- Layout loads all required data (bots, models, sources, conversations) via `listAll()`
- Supports debug mode for inspecting conversation internals
- Supports embedded mode for integration into external surfaces
- Uses `Main` as the primary client component for rendering the chat interface
- Conversations are scoped to the authenticated user session
