# Media Graph

Compose AI images on a canvas - generate from prompts and transform images into new ones along a graph.

## Purpose

- Provides core functionality for Media Graph
- Integrates with the ChatBotKit platform

## Architecture

```
f2a9c7d4/
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

- Exposes Media Graph functionality through the ChatBotKit platform interface
- Provides comprehensive features for managing and working with Media Graph
