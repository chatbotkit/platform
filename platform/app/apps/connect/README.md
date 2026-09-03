# Connect App

The Connect app lets users manage OAuth integrations and connections to external services.

## Purpose

- View and manage connected OAuth secrets and integrations
- Connect new external services via OAuth flows
- Revoke existing service connections

## Architecture

```
connect/
├── app.manifest      # App configuration (main category, order 30)
├── const.ts          # APP_NAME and CONTACT_NAMESPACE exports
├── config.ts         # Zod schema for app configuration
├── layout.jsx        # App layout with standard header/footer
├── page.tsx          # Server component for initial data loading
├── components.jsx    # Client components (ConnectionScreen, etc.)
├── server.ts         # Server actions for listing and revoking secrets
└── README.md         # This file
```

## Key Behavior

- Lists configured OAuth secrets for the current user/contact
- Supports revoking individual connections
- Handles post-message events for OAuth callback flows
- Uses contact-scoped actions for isolation
