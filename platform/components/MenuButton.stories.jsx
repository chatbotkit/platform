/* eslint-disable import/no-anonymous-default-export */
import GlobalRoot from './GlobalRoot'
import MenuButton from './MenuButton'

export default {
  title: 'Components/MenuButton',
  component: MenuButton,
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <>
        <Story />
        <GlobalRoot />
      </>
    ),
  ],
  argTypes: {
    menu: {
      control: 'object',
      description:
        'Array of menu items with title, href, and optional nested items',
    },
    className: {
      control: 'text',
      description: 'CSS classes for the button',
    },
    menuClassName: {
      control: 'text',
      description: 'CSS classes for the menu dropdown',
    },
    children: {
      control: 'text',
      description: 'Button content/label',
    },
  },
}

export const Default = {
  args: {
    menu: [
      {
        title: 'Test 1',
        href: '/test1',
      },
      {
        title: 'Test 2',
        href: '/test2',
      },
      {
        title: 'Test 3',
        href: '/test3',
      },
    ],
    children: 'Click Me',
  },
}

export const BasicMenu = {
  args: {
    menu: [
      {
        title: 'Home',
        href: '/',
      },
      {
        title: 'About',
        href: '/about',
      },
      {
        title: 'Contact',
        href: '/contact',
      },
    ],
    children: 'Menu',
    className: 'px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600',
  },
}

export const NestedMenu = {
  args: {
    menu: [
      {
        title: 'Dashboard',
        href: '/dashboard',
      },
      {
        title: 'Products',
        href: '/products',
        items: [
          {
            title: 'All Products',
            href: '/products',
          },
          {
            title: 'Categories',
            href: '/products/categories',
          },
          {
            title: 'Inventory',
            href: '/products/inventory',
          },
        ],
      },
      {
        title: 'Settings',
        href: '/settings',
        items: [
          {
            title: 'Profile',
            href: '/settings/profile',
          },
          {
            title: 'Account',
            href: '/settings/account',
          },
          {
            title: 'Preferences',
            href: '/settings/preferences',
            items: [
              {
                title: 'Theme',
                href: '/settings/preferences/theme',
              },
              {
                title: 'Notifications',
                href: '/settings/preferences/notifications',
              },
            ],
          },
        ],
      },
    ],
    children: 'Navigation Menu',
    className: 'px-4 py-2 bg-gray-700 text-white rounded',
  },
}

export const WithIcons = {
  args: {
    menu: [
      {
        title: 'Dashboard',
        href: '/dashboard',
        icon: 'ChartBarIcon',
      },
      {
        title: 'Users',
        href: '/users',
        icon: 'UsersIcon',
      },
      {
        title: 'Settings',
        href: '/settings',
        icon: 'CogIcon',
        items: [
          {
            title: 'General',
            href: '/settings/general',
            icon: 'AdjustmentsIcon',
          },
          {
            title: 'Security',
            href: '/settings/security',
            icon: 'ShieldCheckIcon',
          },
        ],
      },
      {
        title: 'Help',
        href: '/help',
        icon: 'QuestionMarkCircleIcon',
      },
    ],
    children: '☰ Menu with Icons',
    className: 'px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600',
  },
}

export const ActionsMenu = {
  args: {
    menu: [
      {
        title: 'Edit',
        href: '#',
        onClick: () => alert('Edit clicked'),
      },
      {
        title: 'Duplicate',
        href: '#',
        onClick: () => alert('Duplicate clicked'),
      },
      {
        title: 'Share',
        href: '#',
        items: [
          {
            title: 'Copy Link',
            href: '#',
            onClick: () => {
              navigator.clipboard.writeText(window.location.href)
              alert('Link copied!')
            },
          },
          {
            title: 'Email',
            href: 'mailto:?subject=Check this out',
          },
          {
            title: 'Social Media',
            href: '#',
            items: [
              {
                title: 'Twitter',
                href: 'https://twitter.com/intent/tweet',
                target: '_blank',
              },
              {
                title: 'Facebook',
                href: 'https://facebook.com/sharer',
                target: '_blank',
              },
            ],
          },
        ],
      },
      {
        title: 'Delete',
        href: '#',
        onClick: () => {
          if (confirm('Are you sure you want to delete this item?')) {
            alert('Item deleted')
          }
        },
        className: 'text-red-600 hover:text-red-800',
      },
    ],
    children: 'Actions ⚡',
    className:
      'px-3 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50',
  },
}

export const StyledMenu = {
  args: {
    menu: [
      {
        title: 'Recent Files',
        href: '/recent',
      },
      {
        title: 'Workspace',
        href: '/workspace',
        items: [
          {
            title: 'Projects',
            href: '/workspace/projects',
          },
          {
            title: 'Templates',
            href: '/workspace/templates',
          },
        ],
      },
      {
        title: 'Account',
        href: '/account',
      },
    ],
    children: 'Styled Menu',
    className:
      'px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg shadow-lg hover:from-purple-600 hover:to-pink-600',
    menuClassName: 'bg-white border-2 border-purple-200 shadow-xl',
  },
}

export const LargeMenu = {
  args: {
    menu: [
      {
        title: 'File',
        href: '#',
        items: [
          { title: 'New', href: '#', shortcut: 'Ctrl+N' },
          { title: 'Open', href: '#', shortcut: 'Ctrl+O' },
          { title: 'Save', href: '#', shortcut: 'Ctrl+S' },
          { title: 'Save As...', href: '#', shortcut: 'Ctrl+Shift+S' },
          {
            title: 'Recent Files',
            href: '#',
            items: [
              { title: 'Document1.txt', href: '#' },
              { title: 'Project.json', href: '#' },
              { title: 'Notes.md', href: '#' },
            ],
          },
          {
            title: 'Export',
            href: '#',
            items: [
              { title: 'PDF', href: '#' },
              { title: 'HTML', href: '#' },
              { title: 'Word Document', href: '#' },
            ],
          },
        ],
      },
      {
        title: 'Edit',
        href: '#',
        items: [
          { title: 'Undo', href: '#', shortcut: 'Ctrl+Z' },
          { title: 'Redo', href: '#', shortcut: 'Ctrl+Y' },
          { title: 'Cut', href: '#', shortcut: 'Ctrl+X' },
          { title: 'Copy', href: '#', shortcut: 'Ctrl+C' },
          { title: 'Paste', href: '#', shortcut: 'Ctrl+V' },
          { title: 'Find', href: '#', shortcut: 'Ctrl+F' },
          { title: 'Replace', href: '#', shortcut: 'Ctrl+H' },
        ],
      },
      {
        title: 'View',
        href: '#',
        items: [
          { title: 'Zoom In', href: '#', shortcut: 'Ctrl++' },
          { title: 'Zoom Out', href: '#', shortcut: 'Ctrl+-' },
          { title: 'Reset Zoom', href: '#', shortcut: 'Ctrl+0' },
          { title: 'Full Screen', href: '#', shortcut: 'F11' },
          {
            title: 'Layout',
            href: '#',
            items: [
              { title: 'Sidebar', href: '#' },
              { title: 'Bottom Panel', href: '#' },
              { title: 'Minimap', href: '#' },
            ],
          },
        ],
      },
      {
        title: 'Tools',
        href: '#',
        items: [
          { title: 'Command Palette', href: '#', shortcut: 'Ctrl+Shift+P' },
          { title: 'Extensions', href: '#', shortcut: 'Ctrl+Shift+X' },
          { title: 'Settings', href: '#', shortcut: 'Ctrl+,' },
          { title: 'Keyboard Shortcuts', href: '#', shortcut: 'Ctrl+K Ctrl+S' },
        ],
      },
    ],
    children: 'Application Menu',
    className: 'px-4 py-2 bg-gray-800 text-white rounded text-sm',
  },
}

export const UserMenu = {
  args: {
    menu: [
      {
        title: 'Profile',
        href: '/profile',
        icon: 'UserIcon',
      },
      {
        title: 'Settings',
        href: '/settings',
        icon: 'CogIcon',
        items: [
          {
            title: 'Account Settings',
            href: '/settings/account',
          },
          {
            title: 'Privacy',
            href: '/settings/privacy',
          },
          {
            title: 'Notifications',
            href: '/settings/notifications',
          },
        ],
      },
      {
        title: 'Billing',
        href: '/billing',
        icon: 'CreditCardIcon',
      },
      {
        title: 'Help & Support',
        href: '/support',
        icon: 'QuestionMarkCircleIcon',
        items: [
          {
            title: 'Documentation',
            href: 'https://example.com/docs',
            target: '_blank',
          },
          {
            title: 'Contact Support',
            href: '/contact',
          },
          {
            title: 'Community Forum',
            href: 'https://community.example.com',
            target: '_blank',
          },
        ],
      },
      {
        title: 'Sign Out',
        href: '#',
        onClick: () => {
          if (confirm('Are you sure you want to sign out?')) {
            alert('Signed out')
          }
        },
        icon: 'ArrowLeftOnRectangleIcon',
        className:
          'text-red-600 hover:text-red-800 border-t border-gray-200 mt-2 pt-2',
      },
    ],
    children: (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
          JD
        </div>
        <span>John Doe</span>
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    ),
    className:
      'px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50',
  },
}

export const CompactMenu = {
  args: {
    menu: [
      { title: 'Copy', href: '#' },
      { title: 'Cut', href: '#' },
      { title: 'Paste', href: '#' },
      { title: 'Delete', href: '#' },
    ],
    children: '⋯',
    className:
      'w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded flex items-center justify-center text-gray-600',
    menuClassName: 'min-w-32',
  },
}

export const Showcase = {
  render: () => (
    <div className="space-y-8">
      <section>
        <h3 className="text-lg font-semibold mb-4">Basic Menus</h3>
        <div className="flex flex-wrap gap-4">
          <MenuButton
            menu={[
              { title: 'Option 1', href: '#' },
              { title: 'Option 2', href: '#' },
              { title: 'Option 3', href: '#' },
            ]}
            className="px-4 py-2 bg-blue-500 text-white rounded"
          >
            Simple Menu
          </MenuButton>

          <MenuButton
            menu={[
              { title: 'Dashboard', href: '/dashboard' },
              { title: 'Analytics', href: '/analytics' },
              {
                title: 'Reports',
                href: '/reports',
                items: [
                  { title: 'Monthly', href: '/reports/monthly' },
                  { title: 'Quarterly', href: '/reports/quarterly' },
                ],
              },
            ]}
            className="px-4 py-2 bg-green-500 text-white rounded"
          >
            Nested Menu
          </MenuButton>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4">Styled Examples</h3>
        <div className="flex flex-wrap gap-4">
          <MenuButton
            menu={[
              { title: 'Profile', href: '#', icon: 'UserIcon' },
              { title: 'Settings', href: '#', icon: 'CogIcon' },
              { title: 'Logout', href: '#', icon: 'ArrowLeftOnRectangleIcon' },
            ]}
            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg"
          >
            Gradient Menu
          </MenuButton>

          <MenuButton
            menu={[
              { title: 'Light Theme', href: '#' },
              { title: 'Dark Theme', href: '#' },
              { title: 'Auto', href: '#' },
            ]}
            className="px-4 py-2 border border-gray-300 rounded bg-white hover:bg-gray-50"
            menuClassName="bg-white shadow-xl border border-gray-200"
          >
            Theme Selector
          </MenuButton>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4">Use Cases</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <h4 className="font-medium">Navigation</h4>
            <MenuButton
              menu={[
                { title: 'Home', href: '/' },
                {
                  title: 'Products',
                  href: '/products',
                  items: [
                    { title: 'Category A', href: '/products/a' },
                    { title: 'Category B', href: '/products/b' },
                  ],
                },
                { title: 'About', href: '/about' },
                { title: 'Contact', href: '/contact' },
              ]}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded text-left"
            >
              Main Navigation
            </MenuButton>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Context Actions</h4>
            <MenuButton
              menu={[
                { title: 'Edit', href: '#' },
                { title: 'Duplicate', href: '#' },
                { title: 'Share', href: '#' },
                { title: 'Delete', href: '#', className: 'text-red-600' },
              ]}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
            >
              Actions ⚙️
            </MenuButton>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">User Menu</h4>
            <MenuButton
              menu={[
                { title: 'My Account', href: '/account' },
                { title: 'Preferences', href: '/preferences' },
                { title: 'Help', href: '/help' },
                { title: 'Sign Out', href: '/signout' },
              ]}
              className="flex items-center gap-2 px-3 py-2 bg-gray-800 text-white rounded"
            >
              <div className="w-6 h-6 bg-blue-500 rounded-full"></div>
              User
            </MenuButton>
          </div>
        </div>
      </section>
    </div>
  ),
}
