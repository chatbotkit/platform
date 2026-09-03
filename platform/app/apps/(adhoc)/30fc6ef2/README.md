# Priority Hub (30fc6ef2)

An adhoc app that consolidates priorities from multiple AI agents into a single, organized view.

## Purpose

Priority Hub queries all configured bots to identify what the user should focus on. Each bot analyzes its own context (connected integrations, tasks, calendar, etc.) and returns actionable priorities. The app then aggregates and ranks these priorities by importance, giving users a clear view of their top 5 priorities.

## Features

- **Multi-agent priority aggregation**: Query multiple bots in parallel
- **Importance-based ranking**: Priorities sorted by critical > high > medium > low
- **Source attribution**: Each priority shows which bot identified it
- **Refresh on demand**: Manual refresh to get updated priorities
- **Configurable prompts**: Custom priority prompts per bot

## Configuration

Configure the app in `app.manifest` or through the admin interface:

```json
{
  "config": {
    "bots": [
      "bot-id-1",
      {
        "id": "bot-id-2",
        "name": "Work Assistant",
        "priorityPrompt": "What are my most urgent work tasks?"
      }
    ],
    "maxPrioritiesPerBot": 5,
    "totalMaxPriorities": 5
  }
}
```

### Configuration Options

| Field                 | Type                      | Default | Description                           |
| --------------------- | ------------------------- | ------- | ------------------------------------- |
| `bots`                | `(string \| BotConfig)[]` | `[]`    | List of bot IDs or configurations     |
| `maxPrioritiesPerBot` | `number`                  | `5`     | Max priorities to fetch from each bot |
| `totalMaxPriorities`  | `number`                  | `5`     | Total max priorities to display       |

### Bot Configuration Object

| Field            | Type     | Description                                     |
| ---------------- | -------- | ----------------------------------------------- |
| `id`             | `string` | Required. The bot ID                            |
| `name`           | `string` | Optional. Display name for the bot              |
| `priorityPrompt` | `string` | Optional. Custom prompt for priority extraction |

## Architecture

```
page.tsx
  └── listPriorities() → server.ts
        ├── listBots() → Gets configured bots
        └── queryBotForPriorities() → Queries each bot
              └── getStatelessConversationEngine() → Sends prompt, parses JSON response

components.jsx
  └── Main
        ├── Scene (AppScene header)
        └── PriorityList
              └── List.Item for each priority
```

## Future Enhancements

- [ ] Automatic periodic refresh
- [ ] Priority dismissal/completion tracking
- [ ] Integration with calendar for due dates
- [ ] Priority notifications
- [ ] Historical priority trends
