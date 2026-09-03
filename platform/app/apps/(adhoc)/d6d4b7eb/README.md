# About

Capture and store user personalization information including name and description in their contact record.

## Purpose

- Provides core functionality for About
- Integrates with the ChatBotKit platform

## Architecture

```
d6d4b7eb/
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

- Exposes About functionality through the ChatBotKit platform interface
- Provides comprehensive features for managing and working with About
