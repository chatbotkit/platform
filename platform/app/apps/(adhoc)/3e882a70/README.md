# Datasets

Manage your datasets and their files in one place.

## Purpose

- Provides core functionality for Datasets
- Integrates with the ChatBotKit platform

## Architecture

```
3e882a70/
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

- Exposes Datasets functionality through the ChatBotKit platform interface
- Provides comprehensive features for managing and working with Datasets
