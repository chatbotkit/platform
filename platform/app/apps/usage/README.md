# Usage App

Account usage analytics and general statistics for the ChatBotKit platform.

## Purpose

The Usage app provides a comprehensive view of token consumption, conversation volume, and message activity over time. It is designed to be:

1. **Available through the main portal** - Accessible via the admin category
2. **Analytics-focused** - Charts and metrics for monitoring resource consumption
3. **Actionable** - Helps users understand and optimize their ChatBotKit usage

## Features

- **Token Metrics**: Total tokens consumed, average tokens per conversation and per message
- **Usage Charts**: Daily breakdown of tokens, conversations, and messages
- **Period Comparison**: Current period vs previous period for trend analysis

## Architecture

```
usage/
├── app.manifest      # App configuration (admin category, order 50)
├── const.ts          # APP_NAME and CONTACT_NAMESPACE exports
├── config.ts         # Zod schema for app configuration
├── layout.jsx        # App layout with @doc entry
├── page.tsx          # Server component for initial data loading
├── components.jsx    # Client components (DailyChart, MetricCard, Main)
├── server.ts         # Server actions for fetching usage metrics
└── README.md         # This file
```

## Data Fetching

The app uses two main server actions:

- `getMetrics` - Fetches aggregated token metrics via Prisma SQL queries
- `getUsage` - Fetches daily usage series via the ChatBotKit SDK

## Usage

Access the app at `/apps/usage` to monitor account-level usage statistics.
