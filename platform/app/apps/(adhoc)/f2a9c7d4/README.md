# Media Graph

Compose AI images on a canvas - generate from prompts and transform images into new ones along a graph.

## Purpose

- Provides core functionality for Media Graph
- Integrates with the ChatBotKit platform

## Architecture

```
f2a9c7d4/
 app.manifest                   # App configuration
 const.ts                       # APP_NAME, CONTACT_NAMESPACE and storage layout
 config.ts                      # Zod schema for app configuration
 lib.ts                         # Shared types and pure helpers (client-safe)
 space.ts                       # Server-only space and project storage helpers
 server.ts                      # Project list actions (list, create, update, delete)
 api.ts                         # Editor route handlers (save, assets, upload, generate, edit)
 api/<op>/route.ts              # POST endpoints exposing the handlers in api.ts
 layout.jsx                     # Minimal root layout
 components.jsx                 # Project list client components
 (home)/                        # Project list route with the standard app chrome
 (project)/[projectId]/         # Fullscreen canvas editor
   server.ts                    #   getProject action used by the page render
   components.jsx               #   ReactFlow editor calling the api routes
 README.md                      # This file
```

## Key Behavior

- Each user gets a space (aliased by app and contact fingerprint) holding one
  folder per project with a `project.json` graph and an `assets` folder
- The project list uses server actions; the editor calls the route handlers
  under `/apps/f2a9c7d4/api/*` instead. Server actions are queued one at a
  time by the client, which serialised image generation across nodes. Route
  handlers run as independent requests, so several nodes can generate at once
- The editor saves through a client-side queue so a slower save issued
  earlier cannot overwrite a newer graph
- Image generation and edit calls are never retried to avoid billing twice
