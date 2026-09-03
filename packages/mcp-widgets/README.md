# MCP Widgets

UI widgets for rendering MCP (Model Context Protocol) tool responses in AI assistants like ChatGPT.

## Overview

When an MCP tool returns data, AI assistants can display it using custom UI widgets instead of plain text. This package provides ready-to-use widgets that can be embedded via a simple `<script>` tag.

## Installation

```bash
npm install mcp-widgets
# or
pnpm add mcp-widgets
```

## Widgets

| Widget           | Framework  | Size   | Description                                |
| ---------------- | ---------- | ------ | ------------------------------------------ |
| `data-card`      | Web Widget | ~3KB   | Simple key-value data display              |
| `rich-data-card` | React      | ~148KB | Enhanced card with sections, icons, footer |

## Usage

### CDN Embedding (for MCP tools)

Load widgets via CDN and use them as custom HTML elements:

```html
<!-- Load the widget -->
<script src="https://unpkg.com/mcp-widgets/cdn/data-card.js"></script>

<!-- Use it -->
<mcp-data-card
  title="Weather"
  data='{"temperature": "72°F", "conditions": "Sunny"}'
  status="success"
></mcp-data-card>
```

### As a React Library

```tsx
import { RichDataCard } from 'mcp-widgets'

function MyWidget() {
  return (
    <RichDataCard
      title="Order Summary"
      icon="🛒"
      data={{ orderId: '#12345', total: '$89.99' }}
      sections={[{ title: 'Shipping', data: { method: 'Express' } }]}
      status="success"
    />
  )
}
```

## How Embedding Works

### The MCP Tool Response Flow

1. **User asks a question** in ChatGPT (e.g., "What's the weather?")
2. **ChatGPT calls your MCP tool** which returns structured data
3. **Your tool response includes HTML** with a `<script>` tag pointing to a CDN-hosted widget
4. **ChatGPT renders the HTML** in a sandboxed iframe
5. **The widget loads and displays** the data visually

### Example MCP Tool Response

When your MCP server handles a tool call, return HTML that embeds a widget:

```javascript
// In your MCP server tool handler
function handleWeatherTool(location) {
  const data = fetchWeather(location)

  return {
    content: [
      {
        type: 'text',
        text: `
        <script src="https://unpkg.com/mcp-widgets/cdn/data-card.js"></script>
        <mcp-data-card
          title="Weather in ${location}"
          data='${JSON.stringify(data)}'
          status="success"
        ></mcp-data-card>
      `,
      },
    ],
  }
}
```

### OpenAI Skybridge API

The loader handles communication with the ChatGPT host via `window.openai`. Widgets themselves should NOT call these APIs directly - the loader manages height notifications and prop extraction.

Available host APIs (used by the loader):

```javascript
// Notify ChatGPT of widget height (takes a number)
window.openai.notifyIntrinsicHeight(document.body.scrollHeight)

// Access tool response metadata for props
window.openai.toolResponseMetadata._meta
```

See the [OpenAI Apps SDK docs](https://developers.openai.com/apps-sdk/build/chatgpt-ui/) for the full `window.openai` API reference.

### Security Considerations

- Widgets run in a sandboxed iframe with limited capabilities
- Data is passed via HTML attributes (must be JSON-stringified)
- No direct access to the parent page or user session
- CDN URLs should use HTTPS

## Widget Reference

### `<mcp-data-card>`

A lightweight Web Widget (no React dependency).

| Attribute | Type                                        | Description                |
| --------- | ------------------------------------------- | -------------------------- |
| `title`   | string                                      | Card title                 |
| `data`    | JSON string                                 | Key-value pairs to display |
| `status`  | `success` \| `error` \| `warning` \| `info` | Status indicator styling   |

### `<mcp-rich-data-card>`

A React-based widget with more features.

| Attribute     | Type                                        | Description                       |
| ------------- | ------------------------------------------- | --------------------------------- |
| `title`       | string                                      | Card title                        |
| `description` | string                                      | Subtitle text                     |
| `icon`        | string                                      | Emoji or icon character           |
| `data`        | JSON string                                 | Main data section                 |
| `sections`    | JSON string                                 | Array of `{title, data}` sections |
| `footer`      | string                                      | Footer text                       |
| `status`      | `success` \| `error` \| `warning` \| `info` | Status styling                    |

## Development

```bash
# Install dependencies
pnpm install

# Start Storybook
pnpm dev

# Run tests
pnpm test

# Build everything
pnpm build

# Build CDN bundles only
pnpm build:cdn
```

## Creating New Widgets

1. Create a folder in `src/widgets/{widget-name}/`
2. Add required files:
   - `WidgetName.ts` (Web Widget) or `WidgetName.tsx` (React)
   - `manifest.json` - Widget metadata
   - `cdn.ts` or `cdn.tsx` - CDN entry point
   - `index.ts` - Library export
3. Export from `src/widgets/index.ts`
4. Run `pnpm build` to generate bundles

## Forking & Custom Collections

This repository is designed to be forked! You have two options:

### Option 1: Private Widget Collection

Fork this repo to create your own private widget library:

1. **Fork** this repository to your GitHub account/organization
2. **Add your widgets** following the structure above
3. **Host privately** by publishing to a private npm registry or serving CDN bundles from your own infrastructure
4. **Use in your MCP tools** by pointing to your private CDN URLs

This is ideal for:

- Proprietary UI widgets with custom branding
- Internal tools with sensitive designs
- Widgets that integrate with private APIs

### Option 2: Contribute Back

We welcome community contributions! If you build a widget that could benefit others:

1. **Fork** this repository
2. **Create your widget** following the existing patterns
3. **Add tests and Storybook stories**
4. **Submit a Pull Request** with a description of your widget

Good candidates for community widgets:

- Generic data visualizations (charts, tables, maps)
- Common tool response patterns (search results, confirmations)
- Accessibility improvements
- Performance optimizations

### Hosting Your Own CDN

If you fork and want to self-host your CDN bundles:

```bash
# Build the CDN bundles
pnpm build:cdn

# The cdn/ directory contains all bundles
# Upload to your preferred hosting:
# - GitHub Pages
# - Cloudflare R2/Pages
# - AWS S3 + CloudFront
# - Vercel/Netlify
```

Then reference your hosted bundles in MCP tool responses:

```html
<script src="https://your-cdn.example.com/widgets/my-widget.js"></script>
```

## License

MIT
