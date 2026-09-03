# Live Automations App (6e3b7f2a)

Adhoc developer tool for monitoring running tasks from one operational screen.

The app is designed as a live troubleshooting surface similar to the other
developer tools such as Live Conversations, Eventlog, and Usagelog. It keeps a
single view over task resources, their latest execution state, and the actions
needed to stop them safely.

## Features

- SDK-backed task monitoring
- List of running tasks
- Latest execution summary, status, outcome, and conversation linkage
- Cancel controls for both the top-level task and its latest running execution
- Live polling mode for near real-time operational monitoring
- Search filtering across tasks

## Architecture

- `server.ts` uses `getSessionClient` and the ChatBotKit SDK only
- `components.jsx` provides the live polling monitor UI and cancel actions
- `page.tsx` preloads the initial running-only view on the server

## Notes

- This app intentionally avoids Prisma and page API route coupling.
- Polling is used instead of subscriptions so the tool remains simple and safe
  for adhoc operational use.
