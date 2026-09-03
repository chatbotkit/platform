# Inspector

Inspect the current dashboard resource with related data, events, and audit logs.

## Purpose

- Provides core functionality for Inspector
- Integrates with the ChatBotKit platform

## Architecture

```
41f203dc/
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

- Exposes Inspector functionality through the ChatBotKit platform interface
- Provides comprehensive features for managing and working with Inspector
