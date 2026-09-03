import {
  LuEllipsis,
  LuExternalLink,
  LuHome,
  LuSettings,
  LuUser,
} from 'react-icons/lu'

import FancyLink from './FancyLink'

export default {
  title: 'Components/FancyLink',
  component: FancyLink,
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    href: {
      control: 'text',
      description: 'URL to navigate to',
    },
    icon: {
      control: 'text',
      description: 'Icon component or icon name to display',
    },
    className: {
      control: 'text',
      description: 'CSS classes for the link',
    },
    children: {
      control: 'text',
      description: 'Link content/text',
    },
  },
}

export const Default = {
  args: {
    href: 'https://google.com',
    children: 'Test',
  },
}

export const BasicLinks = {
  render: () => (
    <div className="space-x-2">
      <FancyLink href="https://google.com">Test</FancyLink>
      <FancyLink href="https://google.com">https://google.com</FancyLink>
      <FancyLink href="https://google.com">
        <span>http://google.com</span>
      </FancyLink>
    </div>
  ),
}

export const ExternalLinks = {
  render: () => (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          Popular Sites
        </h4>
        <div className="flex flex-wrap gap-2">
          <FancyLink href="https://google.com">Google</FancyLink>
          <FancyLink href="https://github.com">GitHub</FancyLink>
          <FancyLink href="https://stackoverflow.com">Stack Overflow</FancyLink>
          <FancyLink href="https://openai.com">OpenAI</FancyLink>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">URL Display</h4>
        <div className="flex flex-wrap gap-2">
          <FancyLink href="https://www.example.com">
            https://www.example.com
          </FancyLink>
          <FancyLink href="https://subdomain.example.com/path">
            https://subdomain.example.com/path
          </FancyLink>
          <FancyLink href="http://legacy-site.com">
            http://legacy-site.com
          </FancyLink>
        </div>
      </div>
    </div>
  ),
}

export const WithCustomIcons = {
  render: () => (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Custom Icons</h4>
        <div className="flex flex-wrap gap-2">
          <FancyLink href="https://google.com" icon={LuEllipsis}>
            https://google.com
          </FancyLink>
          <FancyLink href="/home" icon={LuHome}>
            Home Page
          </FancyLink>
          <FancyLink href="/profile" icon={LuUser}>
            User Profile
          </FancyLink>
          <FancyLink href="/settings" icon={LuSettings}>
            Settings
          </FancyLink>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          External Link Icon
        </h4>
        <div className="flex flex-wrap gap-2">
          <FancyLink href="https://external-site.com" icon={LuExternalLink}>
            External Site
          </FancyLink>
          <FancyLink href="https://docs.example.com" icon={LuExternalLink}>
            Documentation
          </FancyLink>
        </div>
      </div>
    </div>
  ),
}

export const InternalLinks = {
  render: () => (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          Navigation Links
        </h4>
        <div className="flex flex-wrap gap-2">
          <FancyLink href="/">Home</FancyLink>
          <FancyLink href="/about">About</FancyLink>
          <FancyLink href="/contact">Contact</FancyLink>
          <FancyLink href="/blog">Blog</FancyLink>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          With Custom Icons
        </h4>
        <div className="flex flex-wrap gap-2">
          <FancyLink href="/" icon={LuHome}>
            Home
          </FancyLink>
          <FancyLink href="/profile" icon={LuUser}>
            Profile
          </FancyLink>
          <FancyLink href="/settings" icon={LuSettings}>
            Settings
          </FancyLink>
        </div>
      </div>
    </div>
  ),
}

export const StyledLinks = {
  render: () => (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Small Text</h4>
        <div className="flex flex-wrap gap-2">
          <FancyLink className="[&_span]:text-xs" href="https://google.com">
            Test
          </FancyLink>
          <FancyLink className="[&_span]:text-xs" href="https://example.com">
            Small Link
          </FancyLink>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          Custom Styling
        </h4>
        <div className="flex flex-wrap gap-2">
          <FancyLink
            className="bg-blue-100 hover:bg-blue-200 text-blue-800"
            href="https://blue-theme.com"
          >
            Blue Theme
          </FancyLink>
          <FancyLink
            className="bg-green-100 hover:bg-green-200 text-green-800"
            href="https://green-theme.com"
          >
            Green Theme
          </FancyLink>
          <FancyLink
            className="bg-purple-100 hover:bg-purple-200 text-purple-800"
            href="https://purple-theme.com"
          >
            Purple Theme
          </FancyLink>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          Size Variations
        </h4>
        <div className="flex flex-wrap items-center gap-2">
          <FancyLink className="text-sm" href="https://small.com">
            Small Link
          </FancyLink>
          <FancyLink href="https://normal.com">Normal Link</FancyLink>
          <FancyLink className="text-lg" href="https://large.com">
            Large Link
          </FancyLink>
        </div>
      </div>
    </div>
  ),
}

export const TextProcessing = {
  render: () => (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          URL Cleaning (Text Children)
        </h4>
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 w-32">Original:</span>
            <code className="text-xs bg-gray-100 px-2 py-1 rounded">
              https://www.example.com/
            </code>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 w-32">Displayed:</span>
            <FancyLink href="https://www.example.com/">
              https://www.example.com/
            </FancyLink>
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          Various URL Formats
        </h4>
        <div className="space-y-2">
          <FancyLink href="https://subdomain.example.com">
            https://subdomain.example.com
          </FancyLink>
          <FancyLink href="https://www.long-domain-name.co.uk/path/to/page">
            https://www.long-domain-name.co.uk/path/to/page
          </FancyLink>
          <FancyLink href="http://simple.com/">http://simple.com/</FancyLink>
          <FancyLink href="https://api.service.com/v1/endpoint/">
            https://api.service.com/v1/endpoint/
          </FancyLink>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          JSX Children (No Processing)
        </h4>
        <div className="space-y-2">
          <FancyLink href="https://example.com">
            <span className="font-bold">Custom JSX Content</span>
          </FancyLink>
          <FancyLink href="https://example.com">
            <span>Mixed </span>
            <em>JSX</em>
            <span> content</span>
          </FancyLink>
          <FancyLink href="https://example.com">
            <div className="flex items-center gap-1">
              <span>🔗</span>
              <span>Link with emoji</span>
            </div>
          </FancyLink>
        </div>
      </div>
    </div>
  ),
}

export const FaviconDisplay = {
  render: () => (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          Automatic Favicons
        </h4>
        <p className="text-sm text-gray-600 mb-3">
          External links automatically display favicons from the target domain
        </p>
        <div className="space-y-2">
          <FancyLink href="https://google.com">Google Search</FancyLink>
          <FancyLink href="https://github.com">GitHub Repository</FancyLink>
          <FancyLink href="https://stackoverflow.com">Stack Overflow</FancyLink>
          <FancyLink href="https://youtube.com">YouTube Videos</FancyLink>
          <FancyLink href="https://twitter.com">Twitter Feed</FancyLink>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          Internal Links (No Favicon)
        </h4>
        <div className="space-y-2">
          <FancyLink href="/dashboard">Dashboard</FancyLink>
          <FancyLink href="/profile">User Profile</FancyLink>
          <FancyLink href="/settings">Application Settings</FancyLink>
        </div>
      </div>
    </div>
  ),
}

export const InteractiveExamples = {
  render: () => (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          In Paragraph Text
        </h4>
        <p className="text-gray-700 leading-relaxed">
          You can visit <FancyLink href="https://google.com">Google</FancyLink>{' '}
          to search for information, or check out{' '}
          <FancyLink href="https://github.com">GitHub</FancyLink> for code
          repositories. For questions, try{' '}
          <FancyLink href="https://stackoverflow.com">Stack Overflow</FancyLink>
          .
        </p>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">In Lists</h4>
        <ul className="space-y-2">
          <li className="flex items-center gap-2">
            <span>•</span>
            <FancyLink href="https://docs.example.com">Documentation</FancyLink>
            <span className="text-gray-500">- Read the full documentation</span>
          </li>
          <li className="flex items-center gap-2">
            <span>•</span>
            <FancyLink href="https://api.example.com">API Reference</FancyLink>
            <span className="text-gray-500">- Explore the API endpoints</span>
          </li>
          <li className="flex items-center gap-2">
            <span>•</span>
            <FancyLink href="https://support.example.com">Support</FancyLink>
            <span className="text-gray-500">- Get help and support</span>
          </li>
        </ul>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          Truncation Example
        </h4>
        <div className="max-w-xs border border-gray-200 p-3 rounded">
          <p className="text-sm text-gray-600 mb-2">Narrow container:</p>
          <FancyLink href="https://very-long-domain-name-that-should-truncate.example.com">
            https://very-long-domain-name-that-should-truncate.example.com
          </FancyLink>
        </div>
      </div>
    </div>
  ),
}

export const Showcase = {
  render: () => (
    <div className="space-y-8">
      <section>
        <h3 className="text-lg font-semibold mb-4">Basic Usage</h3>
        <div className="space-x-2">
          <FancyLink href="https://google.com">Test</FancyLink>
          <FancyLink href="https://google.com">https://google.com</FancyLink>
          <FancyLink href="https://google.com">
            <span>http://google.com</span>
          </FancyLink>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4">Styled Examples</h3>
        <div className="space-x-2">
          <FancyLink className="[&_span]:text-xs" href="https://google.com">
            Test
          </FancyLink>
          <FancyLink href="https://google.com" icon={LuEllipsis}>
            https://google.com
          </FancyLink>
          <FancyLink href="https://google.com">
            <span>http://google.com</span>
          </FancyLink>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4">Different Link Types</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h4 className="font-medium mb-2">External Links</h4>
            <div className="space-y-1">
              <FancyLink href="https://google.com">Google</FancyLink>
              <FancyLink href="https://github.com">GitHub</FancyLink>
              <FancyLink href="https://stackoverflow.com">
                Stack Overflow
              </FancyLink>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-2">Internal Links</h4>
            <div className="space-y-1">
              <FancyLink href="/" icon={LuHome}>
                Home
              </FancyLink>
              <FancyLink href="/profile" icon={LuUser}>
                Profile
              </FancyLink>
              <FancyLink href="/settings" icon={LuSettings}>
                Settings
              </FancyLink>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-2">Custom Styled</h4>
            <div className="space-y-1">
              <FancyLink
                className="bg-blue-100 hover:bg-blue-200 text-blue-800"
                href="https://blue.com"
              >
                Blue Theme
              </FancyLink>
              <FancyLink
                className="bg-green-100 hover:bg-green-200 text-green-800"
                href="https://green.com"
              >
                Green Theme
              </FancyLink>
              <FancyLink className="[&_span]:text-xs" href="https://small.com">
                Small Text
              </FancyLink>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4">Text Processing</h3>
        <div className="space-y-2">
          <div className="text-sm text-gray-600">
            URLs are automatically cleaned when passed as text children:
          </div>
          <div className="space-y-1">
            <FancyLink href="https://www.example.com/">
              https://www.example.com/
            </FancyLink>
            <FancyLink href="https://subdomain.example.com/path">
              https://subdomain.example.com/path
            </FancyLink>
          </div>
          <div className="text-sm text-gray-600 mt-3">
            JSX children are rendered as-is without processing:
          </div>
          <FancyLink href="https://example.com">
            <span className="font-bold">Custom JSX Content</span>
          </FancyLink>
        </div>
      </section>
    </div>
  ),
}
