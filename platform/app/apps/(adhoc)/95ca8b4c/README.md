# Note Stream

Capture live notes from in-person meetings, keep a running transcript, and ask your agents questions about what is being said as it happens.

## Purpose

- Provides core functionality for Note Stream
- Integrates with the ChatBotKit platform

## Architecture

```
95ca8b4c/
 app.manifest      # App configuration
 const.ts          # APP_NAME and CONTACT_NAMESPACE exports
 config.ts         # Zod schema for app configuration
 layout.jsx        # App layout with standard header/footer
 page.tsx          # Server component for initial data loading
 components.jsx    # Client components
 server.ts         # Server-side logic
 README.md         # This file
```

## Key Behavior

- Exposes Note Stream functionality through the ChatBotKit platform interface
- Provides comprehensive features for managing and working with Note Stream
