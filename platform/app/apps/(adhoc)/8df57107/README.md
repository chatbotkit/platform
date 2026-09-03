# Customer Support AI Agent Builder

A specialized adhoc application for streamlining the creation, configuration, and management of AI agents designed specifically for customer support use cases.

## Overview

This application provides a simplified blueprint-based approach to building customer support AI solutions. Each blueprint represents a complete customer support solution with a **single agent, single dataset, and single widget** - making it easy to set up without complexity.

The application is designed for users who need to quickly deploy customer support AI agents with minimal steps, while maintaining control over agent configuration and knowledge base content.

## Key Architecture Principle

**Simplicity First**: Each blueprint contains exactly one agent, one dataset, and one widget. Users don't manage multiple instances - they configure the single instance that exists for their project. This removes complexity and focuses on quick setup.

## Key Features

### Blueprint-Based Project Organization

- **Projects as Blueprints**: Each blueprint represents a complete customer support solution
- **Single Instance Resources**: One agent, one dataset, one widget per blueprint (automatically created)
- **Simple Configuration**: Edit settings for the single agent and widget - no lists to manage

### Single-Instance Resource Management

- **Agent Configuration**: Configure the single agent's personality, behavior, and capabilities
- **Widget Preview**: See and test the single widget that connects to the agent
- **Dataset Content**: Manage files and sitemap integrations that populate the single dataset
- **Automatic Creation**: Resources are automatically created when first accessed

### Dataset Content Management

- **Upload Files**: Add documents, PDFs, and text files to the dataset
- **Sitemap Integration**: Configure website scraping to populate the dataset with web content
- **Multiple Files/Sitemaps**: While agent/dataset/widget are singular, you can add many files and sitemap integrations

## Architecture

```
8df57107/
├── README.md                 # This documentation
├── app.manifest              # App metadata and configuration
├── config.ts                 # App constants (APP_NAME, CONTACT_NAMESPACE)
├── layout.jsx                # Root layout with App wrapper
├── page.tsx                  # Blueprint list screen
├── components.jsx            # UI components for blueprint list
├── server.ts                 # Server actions using ChatBotKit SDK
└── [blueprintId]/            # Blueprint configuration routes
    ├── layout.jsx            # Layout with sidebar navigation
    ├── page.tsx              # Main configuration screen (agent + widget)
    ├── components.jsx        # Configuration screen components
    ├── files/
    │   ├── page.tsx          # File management
    │   └── components.jsx    # File UI components
    └── sitemaps/
        ├── page.tsx          # Sitemap management
        └── components.jsx    # Sitemap UI components
```

## Core Components

### Blueprint List Screen (/)

The main landing page that lists all blueprints. Users can create new blueprints or click existing ones to configure them.

### Configuration Screen (/[blueprintId])

The main blueprint screen where users:

- Edit the single agent's settings (backstory, model, behavior)
- See the single widget and test the solution
- This is where users spend most of their time configuring and testing

### File Management Screen (/[blueprintId]/files)

Manage files within the single dataset:

- Upload documents to populate the knowledge base
- View all files in the dataset
- Delete files that are no longer needed

### Sitemap Management Screen (/[blueprintId]/sitemaps)

Configure website scraping for the single dataset:

- Add sitemap integrations to scrape website content
- Trigger sync operations
- Manage multiple sitemap sources

## User Flow

1. **Create Blueprint**: Start by creating a new project (blueprint)
2. **Configure Agent**: Click into the blueprint to see the main configuration screen
3. **Edit Settings**: Configure the agent's personality, model, and behavior
4. **Test Widget**: See the widget preview and test conversations
5. **Add Content**: Navigate to Files or Sitemaps to populate the knowledge base
6. **Deploy**: The widget is ready to embed on websites

## Sidebar Navigation

When viewing a blueprint, the sidebar provides:

### Navigation Section

- **Blueprints**: Return to the blueprint list
- **Configuration**: Main configuration screen (agent + widget)

### Dataset Content Section

- **Files**: Upload and manage files in the dataset
- **Sitemaps**: Configure website scraping for the dataset

## Use Cases

1. **Quick Support Agent Setup**: Create a functional customer support agent in minutes with minimal steps
2. **Knowledge Base Population**: Upload documentation and scrape website content to train the agent
3. **Testing and Iteration**: Configure and test the agent directly in the app before deployment
4. **Single-Purpose Agents**: Each blueprint is dedicated to one support use case, keeping things simple

## Technical Details

- **Framework**: Next.js with App Router
- **Language**: TypeScript/JavaScript (JSX for UI components)
- **Routing**: Multi-route architecture with blueprint-level pages
- **State Management**: React hooks with controlled state patterns
- **Styling**: Tailwind CSS with platform components
- **Data Persistence**: ChatBotKit SDK for all API operations
- **SDK Resources**: blueprint, bot, dataset, file, integration.widget, integration.sitemap
- **Resource Strategy**: Single instances auto-created on first access

## Configuration

This is an adhoc app with minimal configuration requirements:

- `host`: Dynamic subdomain based on app name
- `start`: Entry point at `/apps/8df57107`
- `category`: "admin" - Administrative tools
- `order`: 10000 - Positioned with other adhoc apps
- `config`: Empty object - No special configuration needed

## Category

**admin** - This app is categorized as an administrative tool because it provides simplified project-level management of customer support AI solutions.

## Development Notes

- Uses CONTACT_NAMESPACE from parent config via `../../config`
- Single-instance pattern: resources auto-created when accessed
- Multi-route architecture for better organization
- Sidebar navigation for blueprint context
- No inbound conversation preview (available in other apps)
- Leverages platform-native components for consistency
