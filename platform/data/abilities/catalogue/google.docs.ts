import {
  createAuxiliaryTemplate,
  createPackTemplate,
  field,
} from '@/lib/ability.template'

import type {
  COMMENT_CREATE_HANDLER_NAME,
  COMMENT_DELETE_HANDLER_NAME,
  COMMENT_LIST_HANDLER_NAME,
  COMMENT_REPLY_CREATE_HANDLER_NAME,
  COMMENT_REPLY_DELETE_HANDLER_NAME,
  COMMENT_RESOLVE_HANDLER_NAME,
  CommentCreateSchema,
  CommentDeleteSchema,
  CommentListSchema,
  CommentReplyCreateSchema,
  CommentReplyDeleteSchema,
  CommentResolveSchema,
  DOCUMENT_APPEND_HANDLER_NAME,
  DOCUMENT_CREATE_HANDLER_NAME,
  DOCUMENT_PREPEND_HANDLER_NAME,
  DOCUMENT_UPDATE_HANDLER_NAME,
  DocumentAppendSchema,
  DocumentCreateSchema,
  DocumentPrependSchema,
  DocumentUpdateSchema,
} from '@/pages/api/auxiliary/skillset/ability/google/docs'

// --- Path Constants ---

const DOCS_API_PATH = '/api/auxiliary/skillset/ability/google/docs'

/**
 * Catalogue of Google Docs abilities.
 */
const abilities = {
  // --- Document Abilities ---

  'google/docs/document/create': createAuxiliaryTemplate<DocumentCreateSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Create Google Document',
    description:
      'Create a new Google Document using the provided text and optional title.',
    tags: ['google', 'docs', 'document', 'create'],
    path: DOCS_API_PATH,
    handler: 'document/create' satisfies typeof DOCUMENT_CREATE_HANDLER_NAME,
    secret: '@platform/google/docs',
    instruction: {
      title: field({
        name: 'title',
        description: 'the title of the document',
        placeholder: true,
      }),
      text: field({
        name: 'text',
        description: 'the text content of the document',
        placeholder: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  'google/docs/document/create[template]':
    createAuxiliaryTemplate<DocumentCreateSchema>({
      provider: 'google',
      icon: '@logo/google.com',
      name: 'Create Google Document from Template',
      description:
        'Create a new Google Document from a template by copying an existing document and replacing template fields.',
      tags: ['google', 'docs', 'document', 'create', 'template'],
      path: DOCS_API_PATH,
      handler: 'document/create' satisfies typeof DOCUMENT_CREATE_HANDLER_NAME,
      secret: '@platform/google/docs',
      instruction: {
        title: field({
          name: 'title',
          description: 'the title of the new document',
          placeholder: true,
        }),
        documentId: field({
          name: 'documentId',
          description: 'the document ID of the template to copy',
          placeholder: true,
        }),
        fields: field({
          name: 'fields',
          description:
            'a JSON object with key-value pairs to replace in the template',
          placeholder: true,
        }),
      },
      options: {
        auth: 'internal',
      },
    }),

  'google/docs/document/update': createAuxiliaryTemplate<DocumentUpdateSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Update Google Document',
    description:
      'Update an existing Google Document using the provided text. This action will overwrite the existing content.',
    tags: ['google', 'docs', 'document', 'update'],
    path: DOCS_API_PATH,
    handler: 'document/update' satisfies typeof DOCUMENT_UPDATE_HANDLER_NAME,
    secret: '@platform/google/docs',
    instruction: {
      documentId: field({
        name: 'documentId',
        description: 'the document ID',
        placeholder: true,
      }),
      text: field({
        name: 'text',
        description: 'the text content of the document',
        placeholder: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  'google/docs/document/append': createAuxiliaryTemplate<DocumentAppendSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Append to Google Document',
    description: 'Append text to the end of an existing Google Document.',
    tags: ['google', 'docs', 'document', 'append'],
    path: DOCS_API_PATH,
    handler: 'document/append' satisfies typeof DOCUMENT_APPEND_HANDLER_NAME,
    secret: '@platform/google/docs',
    instruction: {
      documentId: field({
        name: 'documentId',
        description: 'the document ID',
        placeholder: true,
      }),
      text: field({
        name: 'text',
        description: 'the text content to append',
        placeholder: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  'google/docs/document/prepend':
    createAuxiliaryTemplate<DocumentPrependSchema>({
      provider: 'google',
      icon: '@logo/google.com',
      name: 'Prepend to Google Document',
      description:
        'Prepend text to the beginning of an existing Google Document.',
      tags: ['google', 'docs', 'document', 'prepend'],
      path: DOCS_API_PATH,
      handler:
        'document/prepend' satisfies typeof DOCUMENT_PREPEND_HANDLER_NAME,
      secret: '@platform/google/docs',
      instruction: {
        documentId: field({
          name: 'documentId',
          description: 'the document ID',
          placeholder: true,
        }),
        text: field({
          name: 'text',
          description: 'the text content to prepend',
          placeholder: true,
        }),
      },
      options: {
        auth: 'internal',
      },
    }),

  // --- Comment Abilities ---

  'google/docs/comment/list': createAuxiliaryTemplate<CommentListSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'List Google Document Comments',
    description: 'List all comments on a Google Document.',
    tags: ['google', 'docs', 'comment', 'list'],
    path: DOCS_API_PATH,
    handler: 'comment/list' satisfies typeof COMMENT_LIST_HANDLER_NAME,
    secret: '@platform/google/docs',
    instruction: {
      documentId: field({
        name: 'documentId',
        description: 'the document ID',
        placeholder: true,
      }),
      includeDeleted: field({
        name: 'includeDeleted',
        description: 'whether to include deleted comments',
        type: 'boolean',
        optional: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  'google/docs/comment/create': createAuxiliaryTemplate<CommentCreateSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Create Google Document Comment',
    description: 'Add a new comment to a Google Document.',
    tags: ['google', 'docs', 'comment', 'create'],
    path: DOCS_API_PATH,
    handler: 'comment/create' satisfies typeof COMMENT_CREATE_HANDLER_NAME,
    secret: '@platform/google/docs',
    instruction: {
      documentId: field({
        name: 'documentId',
        description: 'the document ID',
        placeholder: true,
      }),
      content: field({
        name: 'content',
        description: 'the text content of the comment',
        placeholder: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  'google/docs/comment/resolve': createAuxiliaryTemplate<CommentResolveSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Resolve Google Document Comment',
    description: 'Mark a comment on a Google Document as resolved.',
    tags: ['google', 'docs', 'comment', 'resolve'],
    path: DOCS_API_PATH,
    handler: 'comment/resolve' satisfies typeof COMMENT_RESOLVE_HANDLER_NAME,
    secret: '@platform/google/docs',
    instruction: {
      documentId: field({
        name: 'documentId',
        description: 'the document ID',
        placeholder: true,
      }),
      commentId: field({
        name: 'commentId',
        description: 'the comment ID',
        placeholder: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  'google/docs/comment/delete': createAuxiliaryTemplate<CommentDeleteSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Delete Google Document Comment',
    description: 'Delete a comment from a Google Document.',
    tags: ['google', 'docs', 'comment', 'delete'],
    path: DOCS_API_PATH,
    handler: 'comment/delete' satisfies typeof COMMENT_DELETE_HANDLER_NAME,
    secret: '@platform/google/docs',
    instruction: {
      documentId: field({
        name: 'documentId',
        description: 'the document ID',
        placeholder: true,
      }),
      commentId: field({
        name: 'commentId',
        description: 'the comment ID',
        placeholder: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  'google/docs/comment/reply/create':
    createAuxiliaryTemplate<CommentReplyCreateSchema>({
      provider: 'google',
      icon: '@logo/google.com',
      name: 'Reply to Google Document Comment',
      description: 'Add a reply to an existing comment on a Google Document.',
      tags: ['google', 'docs', 'comment', 'reply', 'create'],
      path: DOCS_API_PATH,
      handler:
        'comment/reply/create' satisfies typeof COMMENT_REPLY_CREATE_HANDLER_NAME,
      secret: '@platform/google/docs',
      instruction: {
        documentId: field({
          name: 'documentId',
          description: 'the document ID',
          placeholder: true,
        }),
        commentId: field({
          name: 'commentId',
          description: 'the comment ID to reply to',
          placeholder: true,
        }),
        content: field({
          name: 'content',
          description: 'the text content of the reply',
          placeholder: true,
        }),
      },
      options: {
        auth: 'internal',
      },
    }),

  'google/docs/comment/reply/delete':
    createAuxiliaryTemplate<CommentReplyDeleteSchema>({
      provider: 'google',
      icon: '@logo/google.com',
      name: 'Delete Google Document Comment Reply',
      description: 'Delete a reply from a comment on a Google Document.',
      tags: ['google', 'docs', 'comment', 'reply', 'delete'],
      path: DOCS_API_PATH,
      handler:
        'comment/reply/delete' satisfies typeof COMMENT_REPLY_DELETE_HANDLER_NAME,
      secret: '@platform/google/docs',
      instruction: {
        documentId: field({
          name: 'documentId',
          description: 'the document ID',
          placeholder: true,
        }),
        commentId: field({
          name: 'commentId',
          description: 'the comment ID',
          placeholder: true,
        }),
        replyId: field({
          name: 'replyId',
          description: 'the reply ID to delete',
          placeholder: true,
        }),
      },
      options: {
        auth: 'internal',
      },
    }),

  // --- Pack Abilities ---

  'pack/google/docs': createPackTemplate({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Install Google Docs Tools',
    description:
      'Installs Google Docs tools into the conversation. You can create, update, append, and prepend to documents, and manage comments.',
    tags: ['google', 'docs', 'pack', 'beta'],
    secret: '@platform/google/docs',
    instruction: {
      abilities: [
        'google/docs/document/create',
        'google/docs/document/create[template]',
        'google/docs/document/update',
        'google/docs/document/append',
        'google/docs/document/prepend',
        'google/docs/comment/list',
        'google/docs/comment/create',
        'google/docs/comment/resolve',
        'google/docs/comment/delete',
        'google/docs/comment/reply/create',
        'google/docs/comment/reply/delete',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
