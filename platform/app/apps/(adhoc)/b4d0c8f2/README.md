# API Docs

Interactive API documentation

## Purpose

- Provides core functionality for API Docs
- Integrates with the ChatBotKit platform

## Architecture

```
b4d0c8f2/
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

- Exposes API Docs functionality through the ChatBotKit platform interface
- Provides comprehensive features for managing and working with API Docs
