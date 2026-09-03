# Predefined Task Toggler

## Purpose

The Predefined Task Toggler app is an adhoc application designed specifically for managing a fixed list of predefined tasks. This app allows users to enable or disable individual tasks by toggling them on or off, without the ability to create, edit, or delete tasks.

## Key Features

- **Toggle-Only Interface**: Users can only enable or disable predefined tasks
- **No Task Creation**: Tasks cannot be created manually - they are defined through app configuration
- **No Task Deletion**: Tasks cannot be deleted - they are managed by the configuration
- **No Task Editing**: Task properties (name, description, bot, schedule) cannot be modified
- **Icon Support**: Tasks can display custom icons for visual identification
- **Schedule Management**: When enabled, tasks use their predefined schedule; when disabled, schedule is set to 'never'

## Architecture

### Configuration-Driven Tasks

Tasks are defined in the app configuration with the following structure:

```json
{
  "tasks": [
    {
      "name": "Task Name",
      "description": "Task Description",
      "botId": "bot-id-here",
      "schedule": "daily",
      "icon": "@lucide/icon-name"
    }
  ]
}
```

### Automatic Task Lifecycle

1. **Creation**: When the app loads, it automatically creates any missing predefined tasks
2. **Cleanup**: Tasks that are not in the predefined list are automatically deleted
3. **Deduplication**: Duplicate tasks are automatically removed
4. **Synchronization**: The task list is always synchronized with the configuration

### Components

- **Main**: Primary component that orchestrates the scene and task list
- **TaskList**: Renders the list of predefined tasks with toggle controls
- **Scene**: Provides the app header and description

### Server Actions

- **listTasks**: Lists all predefined tasks with proper synchronization
- **toggleTask**: Enables or disables a task by updating its schedule
- **listAll**: Main data loader that provides tasks to the page

## Use Cases

This app is ideal for:

1. **Fixed Workflows**: When you want users to choose from a predefined set of tasks
2. **Simplified UX**: When task management should be restricted to enable/disable only
3. **Controlled Environments**: When task definitions should be managed centrally
4. **Customer-Specific Deployments**: When different customers need different fixed task sets

## Separation from Core Task App

This app was split from the core task app to:

- **Improve Modularity**: Each app has a single, focused responsibility
- **Simplify Code**: Less conditional logic in both apps
- **Enable Coexistence**: Both apps can be deployed and used simultaneously
- **Flexible Deployment**: Different configuration strategies for each app

## Configuration Requirements

To use this app, configure the `tasks` array in the app configuration with:

- `name` (required): Display name for the task
- `description` (required): Task description
- `botId` (required): ID of the bot to execute the task
- `schedule` (required): Default schedule when enabled (e.g., 'daily', 'hourly')
- `icon` (optional): Icon identifier (e.g., '@lucide/icon-name')

## Category

**Other** - This is an adhoc application for specific use cases requiring predefined task toggling.
