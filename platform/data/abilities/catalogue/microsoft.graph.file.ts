import { createFetchTemplate, field, secret } from '@/lib/ability.template'

/**
 * Catalogue of Microsoft Graph OneDrive/Files abilities.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/resources/onedrive
 */
const abilities = {
  'microsoft/graph/file/list': createFetchTemplate({
    provider: 'microsoft',
    icon: '@logo/microsoft.com',
    name: 'List Files',
    description:
      "List files and folders in the user's OneDrive root or a specific folder",
    tags: ['microsoft', 'onedrive', 'files'],
    secret: '@platform/microsoft/365',
    instruction: {
      method: 'GET',
      url: 'https://graph.microsoft.com/v1.0/me/drive/root/children',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      query: {
        $select: field({
          name: 'select',
          description: 'fields to select, e.g., name, size, webUrl',
          optional: true,
        }),
        $top: field({
          name: 'top',
          type: 'number',
          description: 'number of items to return',
          placeholder: true,
          default: 10,
          optional: true,
        }),
        $skip: field({
          name: 'skip',
          type: 'number',
          description: 'number of items to skip for pagination',
          optional: true,
        }),
      },
      options: {
        jmespath: `value[*].{
  id: id,
  name: name,
  size: size,
  webUrl: webUrl,
  isFolder: folder != null,
  createdDateTime: createdDateTime,
  lastModifiedDateTime: lastModifiedDateTime
}`,
      },
    },
  }),

  'microsoft/graph/file/list[by-folder-id]': createFetchTemplate({
    provider: 'microsoft',
    icon: '@logo/microsoft.com',
    name: 'List Files in Folder',
    description: 'List files and folders within a specific folder by its ID',
    tags: ['microsoft', 'onedrive', 'files'],
    secret: '@platform/microsoft/365',
    instruction: {
      method: 'GET',
      url: 'https://graph.microsoft.com/v1.0/me/drive/items',
      path: [
        '/',
        field({
          name: 'folderId',
          description: 'the folder ID',
        }),
        '/children',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      query: {
        $select: field({
          name: 'select',
          description: 'fields to select, e.g., name, size, webUrl',
          optional: true,
        }),
        $top: field({
          name: 'top',
          type: 'number',
          description: 'number of items to return',
          placeholder: true,
          default: 10,
          optional: true,
        }),
      },
      options: {
        jmespath: `value[*].{
  id: id,
  name: name,
  size: size,
  webUrl: webUrl,
  isFolder: folder != null,
  createdDateTime: createdDateTime,
  lastModifiedDateTime: lastModifiedDateTime
}`,
      },
    },
  }),

  'microsoft/graph/file/search': createFetchTemplate({
    provider: 'microsoft',
    icon: '@logo/microsoft.com',
    name: 'Search Files',
    description: "Search for files in the user's OneDrive by name or content",
    tags: ['microsoft', 'onedrive', 'files', 'search'],
    secret: '@platform/microsoft/365',
    instruction: {
      method: 'GET',
      url: "https://graph.microsoft.com/v1.0/me/drive/root/search(q='{query}')",
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      query: {
        $top: field({
          name: 'top',
          type: 'number',
          description: 'number of items to return',
          placeholder: true,
          default: 10,
          optional: true,
        }),
      },
      options: {
        jmespath: `value[*].{
  id: id,
  name: name,
  size: size,
  webUrl: webUrl,
  isFolder: folder != null,
  createdDateTime: createdDateTime,
  lastModifiedDateTime: lastModifiedDateTime
}`,
      },
    },
  }),

  'microsoft/graph/file/fetch': createFetchTemplate({
    provider: 'microsoft',
    icon: '@logo/microsoft.com',
    name: 'Fetch File Metadata',
    description: 'Get metadata for a specific file or folder by its ID',
    tags: ['microsoft', 'onedrive', 'files'],
    secret: '@platform/microsoft/365',
    instruction: {
      method: 'GET',
      url: 'https://graph.microsoft.com/v1.0/me/drive/items',
      path: [
        '/',
        field({
          name: 'itemId',
          description: 'the file or folder ID',
        }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      options: {
        jmespath: `{
  id: id,
  name: name,
  size: size,
  webUrl: webUrl,
  isFolder: folder != null,
  mimeType: file.mimeType,
  createdDateTime: createdDateTime,
  lastModifiedDateTime: lastModifiedDateTime,
  createdBy: createdBy.user.displayName,
  lastModifiedBy: lastModifiedBy.user.displayName
}`,
      },
    },
  }),

  'microsoft/graph/folder/create': createFetchTemplate({
    provider: 'microsoft',
    icon: '@logo/microsoft.com',
    name: 'Create Folder',
    description: "Create a new folder in the user's OneDrive",
    tags: ['microsoft', 'onedrive', 'files', 'folder'],
    secret: '@platform/microsoft/365',
    instruction: {
      method: 'POST',
      url: 'https://graph.microsoft.com/v1.0/me/drive/root/children',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        name: field({
          name: 'folderName',
          description: 'name of the new folder',
        }),
        folder: {},
        '@microsoft.graph.conflictBehavior': 'rename',
      },
      options: {
        jmespath: `{
  id: id,
  name: name,
  webUrl: webUrl,
  createdDateTime: createdDateTime
}`,
      },
    },
  }),

  'microsoft/graph/file/copy': createFetchTemplate({
    provider: 'microsoft',
    icon: '@logo/microsoft.com',
    name: 'Copy File',
    description: 'Copy a file to a new location in OneDrive',
    tags: ['microsoft', 'onedrive', 'files'],
    secret: '@platform/microsoft/365',
    instruction: {
      method: 'POST',
      url: 'https://graph.microsoft.com/v1.0/me/drive/items',
      path: [
        '/',
        field({
          name: 'itemId',
          description: 'the file ID to copy',
        }),
        '/copy',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        parentReference: {
          id: field({
            name: 'destinationFolderId',
            description: 'ID of the destination folder',
          }),
        },
        name: field({
          name: 'newName',
          description: 'new name for the copied file (optional)',
          optional: true,
        }),
      },
    },
  }),

  'microsoft/graph/file/delete': createFetchTemplate({
    provider: 'microsoft',
    icon: '@logo/microsoft.com',
    name: 'Delete File',
    description: 'Delete a file or folder from OneDrive',
    tags: ['microsoft', 'onedrive', 'files'],
    secret: '@platform/microsoft/365',
    instruction: {
      method: 'DELETE',
      url: 'https://graph.microsoft.com/v1.0/me/drive/items',
      path: [
        '/',
        field({
          name: 'itemId',
          description: 'the file or folder ID to delete',
        }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
    },
  }),
}

export default abilities
