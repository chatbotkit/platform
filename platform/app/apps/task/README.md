# Task App

The Task app lets users create and manage recurring automation tasks tied to a selected bot.

## Purpose

- Create task entries with name, description, bot assignment, and schedule
- Update and delete existing tasks
- Keep task execution context scoped to the current user contact

## Architecture

- `layout.jsx`: Loads app config and renders shared app layout
- `page.tsx`: Fetches initial task and bot data and handles error states
- `components.jsx`: Renders scene, task list, and create/update/delete popup flows
- `server.ts`: Defines app actions for listing bots/tasks and performing CRUD operations
- `bot.policy.ts`: Centralizes bot allowlist checks used by server actions

## Key Behavior

- Uses optimistic UI updates for create, update, and delete operations
- Resolves/ensures a contact record before listing/creating contact-scoped tasks
- Applies configured bot allowlist both when listing selectable bots and when writing task changes

## Configuration

The app supports `config.bots` to constrain available bots. Values can be:

- string bot IDs
- objects with `id` and optional extra metadata
