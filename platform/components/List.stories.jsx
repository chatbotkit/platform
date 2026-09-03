/* eslint-disable import/no-anonymous-default-export,react-hooks/rules-of-hooks */
import { useState } from 'react'

import GlobalRoot from './GlobalRoot'
import List from './List'

import { BellIcon, DocumentIcon, UserIcon } from '@heroicons/react/24/outline'

export default {
  title: 'Components/List',
  component: List,
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
    title: {
      control: 'text',
      description: 'Title displayed at the top of the list with optional link',
    },
    link: {
      control: 'text',
      description: 'URL for the title link',
    },
    emptyMessage: {
      control: 'text',
      description: 'Message shown when list is empty',
    },
    as: {
      control: 'select',
      options: ['ul', 'ol', 'div'],
      description: 'HTML element type for the list container',
    },
    role: {
      control: 'text',
      description: 'ARIA role for the list',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
}

const sampleItems = [
  {
    id: 1,
    title: 'First Item',
    body: 'This is the first item description',
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
  },
  {
    id: 2,
    title: 'Second Item with a Very Long Title That Should Be Truncated',
    body: 'This is a longer description that demonstrates how the component handles longer text content and line clamping behavior when expanded is false',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
  },
  {
    id: 3,
    title: 'Third Item',
    body: ['Multiple body paragraphs', 'Second paragraph with more content'],
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
  },
]

export const Default = {
  render: (args) => (
    <List {...args}>
      {sampleItems.map((item) => (
        <List.Item
          key={item.id}
          title={item.title}
          body={item.body}
          timestamp={item.timestamp}
        />
      ))}
    </List>
  ),
  args: {},
}

export const WithTitle = {
  render: (args) => (
    <List {...args}>
      {sampleItems.map((item) => (
        <List.Item
          key={item.id}
          title={item.title}
          body={item.body}
          timestamp={item.timestamp}
        />
      ))}
    </List>
  ),
  args: {
    title: 'Recent Items',
    link: '/items',
  },
}

export const WithIcons = {
  render: (args) => (
    <List {...args}>
      <List.Item
        icon={<UserIcon className="w-6 h-6 text-blue-500" />}
        title="User Profile Updated"
        body="Your profile information has been successfully updated"
        timestamp={new Date(Date.now() - 1000 * 60 * 15)}
      />
      <List.Item
        icon={<DocumentIcon className="w-6 h-6 text-green-500" />}
        title="New Document Created"
        body="Document has been created and is ready for review"
        timestamp={new Date(Date.now() - 1000 * 60 * 60)}
      />
      <List.Item
        icon={<BellIcon className="w-6 h-6 text-yellow-500" />}
        title="Notification Settings"
        body="Your notification preferences have been updated"
        timestamp={new Date(Date.now() - 1000 * 60 * 60 * 3)}
      />
    </List>
  ),
  args: {
    title: 'Activity Feed',
  },
}

export const WithLinks = {
  render: (args) => (
    <List {...args}>
      <List.Item
        title="Clickable Item 1"
        body="This item has a link and can be clicked"
        link="/item/1"
        timestamp={new Date(Date.now() - 1000 * 60 * 30)}
      />
      <List.Item
        title="Clickable Item 2"
        body="This item opens in a new tab"
        link="/item/2"
        target="_blank"
        timestamp={new Date(Date.now() - 1000 * 60 * 60)}
      />
      <List.Item
        title="Non-clickable Item"
        body="This item has no link"
        timestamp={new Date(Date.now() - 1000 * 60 * 60 * 2)}
      />
    </List>
  ),
  args: {},
}

export const WithItemActions = {
  render: (args) => (
    <List {...args}>
      <List.Item
        title="Item with Actions"
        body="This item has a dropdown menu with multiple actions"
        timestamp={new Date(Date.now() - 1000 * 60 * 30)}
        actions={{
          Edit: () => alert('Edit clicked'),
          Duplicate: () => alert('Duplicate clicked'),
          Share: () => alert('Share clicked'),
          Delete: () => alert('Delete clicked'),
        }}
      />
      <List.Item
        title="Another Item with Actions"
        body="This item has different actions available"
        timestamp={new Date(Date.now() - 1000 * 60 * 60)}
        actions={{
          'View Details': () => alert('View Details clicked'),
          Download: () => alert('Download clicked'),
          Archive: () => alert('Archive clicked'),
        }}
      />
      <List.Item
        title="Item without Actions"
        body="This item has no actions menu"
        timestamp={new Date(Date.now() - 1000 * 60 * 60 * 2)}
      />
    </List>
  ),
  args: {
    title: 'Items with Actions',
  },
}

export const WithActions = {
  render: (args) => (
    <List {...args}>
      {sampleItems.map((item) => (
        <List.Item
          key={item.id}
          title={item.title}
          body={item.body}
          timestamp={item.timestamp}
        >
          <button
            type="button"
            className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200"
          >
            Edit
          </button>
          <button
            type="button"
            className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded-full hover:bg-red-200"
          >
            Delete
          </button>
        </List.Item>
      ))}
    </List>
  ),
  args: {
    actions: (
      <button
        type="button"
        className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Add Item
      </button>
    ),
  },
}

export const Expanded = {
  render: (args) => (
    <List {...args}>
      {sampleItems.map((item) => (
        <List.Item
          key={item.id}
          title={item.title}
          body={item.body}
          timestamp={item.timestamp}
          expanded={true}
        />
      ))}
    </List>
  ),
  args: {},
}

export const Empty = {
  render: (args) => <List {...args}></List>,
  args: {
    emptyMessage: 'No items found. Try adding some items to see them here.',
  },
}

export const Interactive = {
  render: (args) => {
    const [selectedItem, setSelectedItem] = useState(null)

    return (
      <div>
        <p className="mb-4 text-sm text-gray-600">
          Selected item: {selectedItem || 'None'}
        </p>
        <List {...args}>
          {sampleItems.map((item) => (
            <List.Item
              key={item.id}
              title={item.title}
              body={item.body}
              timestamp={item.timestamp}
              onClick={() => setSelectedItem(item.title)}
              className={selectedItem === item.title ? 'selected' : ''}
            />
          ))}
        </List>
      </div>
    )
  },
  args: {},
}

export const CustomHeadingLevel = {
  render: (args) => (
    <List {...args}>
      {sampleItems.map((item) => (
        <List.Item
          key={item.id}
          title={item.title}
          body={item.body}
          timestamp={item.timestamp}
          headingAs="h2"
        />
      ))}
    </List>
  ),
  args: {},
}

export const NonFocusable = {
  render: (args) => (
    <List {...args}>
      {sampleItems.map((item) => (
        <List.Item
          key={item.id}
          title={item.title}
          body={item.body}
          timestamp={item.timestamp}
          focusable={false}
        />
      ))}
    </List>
  ),
  args: {},
}

export const ListItemStandalone = {
  render: (args) => <List.Item {...args} />,
  args: {
    title: 'Standalone List Item',
    body: 'This is a list item rendered by itself',
    timestamp: new Date(),
  },
  parameters: {
    docs: {
      description: {
        story: 'List.Item can be used standalone outside of a List component.',
      },
    },
  },
}

export const ListItemWithIcon = {
  render: (args) => <List.Item {...args} />,
  args: {
    icon: <UserIcon className="w-6 h-6 text-blue-500" />,
    title: 'List Item with Icon',
    body: 'This list item includes an icon',
    timestamp: new Date(),
  },
}

export const ListItemWithActions = {
  render: (args) => <List.Item {...args} />,
  args: {
    title: 'List Item with Actions Menu',
    body: 'This standalone list item has an actions dropdown',
    timestamp: new Date(),
    actions: {
      Edit: () => alert('Edit clicked'),
      Copy: () => alert('Copy clicked'),
      Delete: () => alert('Delete clicked'),
    },
  },
}

export const ListItemAsDiv = {
  render: (args) => <List.Item {...args} />,
  args: {
    title: 'List Item as Div',
    body: 'This list item is rendered as a div element',
    timestamp: new Date(),
    as: 'div',
    role: 'article',
  },
}
