# Blueprint App (`b7f4c2de`)

This ad-hoc app provides a simple blueprint browser for internal use.

## What it does

- Lists available user blueprints in a standard `List` UI.
- Opens a dedicated detail page for each blueprint.
- Embeds the existing blueprint designer in read-only mode via iframe.

## Routes

- `/apps/b7f4c2de` - blueprint list screen
- `/apps/b7f4c2de/[blueprintId]` - read-only blueprint viewer

## Notes

- The detail page uses `NavHeader` for contextual title/description and back navigation.
- The detail page renders a local read-only designer viewer (hub-style) using the shared designer canvas components.
