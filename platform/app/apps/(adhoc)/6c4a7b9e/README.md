# Threads (`6c4a7b9e`)

Multiple chat threads side by side, built on top of the Chat app.

## What it does

- Displays one chat thread fullscreen by default
- Add more threads side by side
- Responsive layout:
  - Mobile: 1 thread (full width)
  - Tablet: 2 threads
  - Desktop: 3 threads
  - Large desktop: 4 threads
- Close threads while keeping at least one open
- Horizontal snap-scrolling between threads

## Routes

- `/apps/6c4a7b9e` - threads workspace

## Architecture

```
6c4a7b9e/
├── README.md
├── app.manifest
├── config.ts
├── const.ts
├── layout.jsx
├── page.tsx
├── components.jsx
└── components.utest.jsx
```

## Notes

- The UI is intentionally thin and reuses `/apps/chat` through iframes with the
  `embed=workspace` query parameter.
- Uses CSS snap scrolling for smooth navigation between threads.
- Thread state is isolated by rendering each chat in its own iframe.
