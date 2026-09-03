import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'dropbox/file/search': createFetchTemplate({
    provider: 'dropbox',
    icon: '@logo/dropbox.com',
    name: 'Search Dropbox Files',
    description: 'Search for files in Dropbox using a query',
    tags: ['dropbox', 'file', 'search'],
    secret: '@platform/dropbox',
    instruction: {
      method: 'POST',
      url: 'https://api.dropboxapi.com/2/files/search_v2',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        query: field({
          name: 'query',
          description: 'the search query to use',
        }),
        options: {
          max_results: field({
            name: 'limit',
            type: 'number',
            default: 100,
            description: 'maximum number of results to return',
          }),
          order_by: field({
            name: 'order_by',
            enum: ['relevance', 'last_modified_time'],
            description:
              'the field to order results by, e.g., "relevance", "last_modified_time"',
          }),
          file_status: 'active',
          file_categories: [
            'document',
            'pdf',
            'spreadsheet',
            'presentation',
            'paper',
          ],
        },
      },
      options: {
        jmespath: `{
  matches: matches[].{
    id: metadata.metadata.id,
    name: metadata.metadata.name,
    path: metadata.metadata.path_lower,
    downloadable: metadata.is_downloadable,
    url: join('', ['https://www.dropbox.com/home', metadata.path_lower])
  }
}`,
      },
    },
  }),

  'dropbox/file/list': createFetchTemplate({
    provider: 'dropbox',
    icon: '@logo/dropbox.com',
    name: 'List Dropbox Files',
    description: 'List files in a Dropbox folder',
    tags: ['dropbox', 'file', 'list'],
    secret: '@platform/dropbox',
    instruction: {
      method: 'POST',
      url: 'https://api.dropboxapi.com/2/files/list_folder',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        path: field({
          name: 'path',
          description:
            'the folder path or id to list files in, use "" for root',
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          default: 100,
          description: 'maximum number of files to list',
        }),
        recursive: field({
          name: 'recursive',
          type: 'boolean',
          default: false,
          description: 'whether to list files recursively',
        }),
      },
      options: {
        jmespath: `{
  files: entries[].{
    id: id,
    name: name,
    path: path_lower,
    downloadable: is_downloadable,
    url: join('', ['https://www.dropbox.com/home', path_lower])
  }
}`,
      },
    },
  }),

  'dropbox/file/fetch[metadata]': createFetchTemplate({
    provider: 'dropbox',
    icon: '@logo/dropbox.com',
    name: 'Fetch Dropbox File Metadata',
    description: 'Fetch metadata for a file in Dropbox using its ID',
    tags: ['dropbox', 'file', 'fetch'],
    secret: '@platform/dropbox',
    instruction: {
      method: 'POST',
      url: 'https://api.dropboxapi.com/2/files/get_metadata',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        path: field({
          name: 'path',
          description:
            'the file path or id to fetch metadata for, the id is in the format "id:xxx"',
        }),
        include_media_info: true,
      },
    },
  }),

  'dropbox/api/call': createFetchTemplate({
    provider: 'dropbox',
    icon: '@logo/dropbox.com',
    name: 'Call Dropbox API',
    description:
      'Make a generic API call to Dropbox. This is a flexible template that can be used to call any Dropbox API endpoint by specifying the method, URL, and request body.',
    tags: ['dropbox', 'file', 'api', 'call', 'generic'],
    secret: '@platform/dropbox',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Dropbox API endpoint to call',
      }),
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: field({
        name: 'body',
        description:
          'the request body as JSON text for POST, PUT, or PATCH requests',
        optional: true,
      }),
    },
  }),
}

export default abilities
