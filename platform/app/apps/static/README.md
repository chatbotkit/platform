# Static

Serve a configured space as a static website.

## Purpose

- Provides core functionality for Static
- Integrates with the ChatBotKit platform

## Architecture

```
static/
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

- Exposes Static functionality through the ChatBotKit platform interface
- Provides comprehensive features for serving a configured space as a static site
