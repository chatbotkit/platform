# Trace App

A developer traceability tool for debugging and monitoring ChatBotKit agent activity.

## Purpose

- Record and replay AI agent traces in real time
- Download trace data for offline analysis
- Debug tool use, reasoning, and conversation flow

## Architecture

```
trace/
├── app.manifest      # App configuration (developer category, order 1000)
├── const.ts          # APP_NAME and CONTACT_NAMESPACE exports
├── config.ts         # Zod schema for app configuration
├── layout.jsx        # App layout (embeddable - no header/footer)
├── page.tsx          # Minimal server component (renders Main)
├── components.jsx    # Client components (Toggle, Item, Main, etc.)
└── README.md         # This file
```

## Key Behavior

- Embeddable panel design (no standard header/footer)
- Real-time trace streaming via `useTraceServer` hook
- Supports start/stop recording and YAML export/download
- Virtualized list rendering for large trace collections
- Local storage persistence for trace settings
