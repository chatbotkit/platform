import { createFetchTemplate, field, secret } from '@/lib/ability.template'

/**
 * Catalogue of Microsoft Graph Contacts abilities.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/resources/contact
 */
const abilities = {
  'microsoft/graph/contact/search': createFetchTemplate({
    provider: 'microsoft',
    icon: '@logo/microsoft.com',
    name: 'Search Contacts',
    description:
      "Find contacts in a user's address book that match a search query",
    tags: ['microsoft', 'outlook', 'contacts'],
    secret: '@platform/microsoft/365',
    instruction: {
      method: 'GET',
      url: 'https://graph.microsoft.com/v1.0/me/contacts',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      query: {
        $search: field({
          name: 'search',
          description: 'string to search in contacts',
        }),
        $select: field({
          name: 'select',
          description: 'fields to select, e.g., displayName, emailAddresses',
          optional: true,
        }),
        $top: field({
          name: 'top',
          type: 'number',
          description: 'number of contacts to return',
          placeholder: true,
          default: 10,
          optional: true,
        }),
        $skip: field({
          name: 'skip',
          type: 'number',
          description: 'number of contacts to skip for pagination',
          optional: true,
        }),
      },
      options: {
        jmespath: `value[*].{
  id: id,
  displayName: displayName,
  email: emailAddresses[0].address
}`,
      },
    },
  }),

  'microsoft/graph/contact/list': createFetchTemplate({
    provider: 'microsoft',
    icon: '@logo/microsoft.com',
    name: 'List Contacts',
    description: "Get a list of contacts from a user's address book",
    tags: ['microsoft', 'outlook', 'contacts'],
    secret: '@platform/microsoft/365',
    instruction: {
      method: 'GET',
      url: 'https://graph.microsoft.com/v1.0/me/contacts',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      query: {
        $select: field({
          name: 'select',
          description: 'fields to select, e.g., displayName, emailAddresses',
          optional: true,
        }),
        $top: field({
          name: 'top',
          type: 'number',
          description: 'number of contacts to return',
          placeholder: true,
          default: 10,
          optional: true,
        }),
        $skip: field({
          name: 'skip',
          type: 'number',
          description: 'number of contacts to skip for pagination',
          optional: true,
        }),
      },
      options: {
        jmespath: `value[*].{
  id: id,
  displayName: displayName,
  email: emailAddresses[0].address
}`,
      },
    },
  }),

  'microsoft/graph/contact/fetch': createFetchTemplate({
    provider: 'microsoft',
    icon: '@logo/microsoft.com',
    name: 'Fetch Contact',
    description: 'Get the details of a specific contact by its ID',
    tags: ['microsoft', 'outlook', 'contacts'],
    secret: '@platform/microsoft/365',
    instruction: {
      method: 'GET',
      url: 'https://graph.microsoft.com/v1.0/me/contacts',
      path: [
        '/',
        field({
          name: 'contactId',
          description: 'the contact ID',
        }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      options: {
        jmespath: `{
  id: id,
  displayName: displayName,
  email: emailAddresses[0].address,
  mobilePhone: mobilePhone,
  businessPhones: businessPhones
}`,
      },
    },
  }),
}

export default abilities
