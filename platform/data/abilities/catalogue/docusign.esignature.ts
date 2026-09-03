import {
  createAuxiliaryTemplate,
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

import type { Schema } from '@/pages/api/auxiliary/skillset/ability/docusign/esignature/sql'

/**
 * Catalogue of DocuSign eSignature abilities.
 *
 * @see https://developers.docusign.com/docs/esign-rest-api/reference/
 */
const abilities = {
  'docusign/envelope/list': createFetchTemplate({
    provider: 'docusign',
    icon: '@logo/docusign.com',
    name: 'List Envelopes',
    description: 'List envelopes from DocuSign based on status and date range.',
    tags: ['crm', 'docusign', 'envelope', 'beta'],
    secret: '@platform/docusign',
    instruction: {
      method: 'GET',
      url: field({
        name: 'base_url',
        description:
          'DocuSign base URL - e.g., https://demo.docusign.net or https://na1.docusign.net',
        placeholder: true,
      }),
      path: [
        '/restapi/v2.1/accounts/',
        field({
          name: 'account_id',
          description: 'DocuSign account ID',
          placeholder: true,
        }),
        '/envelopes',
      ],
      query: {
        from_date: field({
          name: 'from_date',
          description:
            'start date in ISO 8601 format - e.g., 2024-01-01T00:00:00Z',
        }),
        to_date: field({
          name: 'to_date',
          description: 'end date in ISO 8601 format',
          optional: true,
        }),
        status: field({
          name: 'status',
          description:
            'envelope status filter (created, sent, delivered, signed, completed, declined, voided, timedout)',
          optional: true,
        }),
        count: field({
          name: 'count',
          type: 'number',
          description: 'maximum number of envelopes to return',
          placeholder: true,
          default: 25,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'docusign/envelope/fetch': createFetchTemplate({
    provider: 'docusign',
    icon: '@logo/docusign.com',
    name: 'Fetch Envelope',
    description: 'Fetch details of a specific envelope from DocuSign.',
    tags: ['crm', 'docusign', 'envelope', 'beta'],
    secret: '@platform/docusign',
    instruction: {
      method: 'GET',
      url: field({
        name: 'base_url',
        description:
          'DocuSign base URL - e.g., https://demo.docusign.net or https://na1.docusign.net',
        placeholder: true,
      }),
      path: [
        '/restapi/v2.1/accounts/',
        field({
          name: 'account_id',
          description: 'DocuSign account ID',
          placeholder: true,
        }),
        '/envelopes/',
        field({
          name: 'envelope_id',
          description: 'the envelope ID to fetch',
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'docusign/envelope/create': createFetchTemplate({
    provider: 'docusign',
    icon: '@logo/docusign.com',
    name: 'Create Envelope from Template',
    description:
      'Create and optionally send an envelope from a DocuSign template.',
    tags: ['crm', 'docusign', 'envelope', 'beta'],
    secret: '@platform/docusign',
    instruction: {
      method: 'POST',
      url: field({
        name: 'base_url',
        description:
          'DocuSign base URL - e.g., https://demo.docusign.net or https://na1.docusign.net',
        placeholder: true,
      }),
      path: [
        '/restapi/v2.1/accounts/',
        field({
          name: 'account_id',
          description: 'DocuSign account ID',
          placeholder: true,
        }),
        '/envelopes',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        templateId: field({
          name: 'template_id',
          description: 'the template ID to use for creating the envelope',
        }),
        emailSubject: field({
          name: 'email_subject',
          description: 'the email subject for the envelope',
        }),
        emailBlurb: field({
          name: 'email_blurb',
          description: 'optional email body text',
          optional: true,
        }),
        status: field({
          name: 'status',
          description:
            "set to 'sent' to send immediately or 'created' to save as draft",
          default: 'sent',
        }),
        templateRoles: [
          {
            roleName: field({
              name: 'role_name',
              description: 'the template role name - e.g., Signer1',
            }),
            name: field({
              name: 'signer_name',
              description: "the signer's full name",
            }),
            email: field({
              name: 'signer_email',
              description: "the signer's email address",
            }),
          },
        ],
      },
    },
  }),

  'docusign/envelope/send': createFetchTemplate({
    provider: 'docusign',
    icon: '@logo/docusign.com',
    name: 'Send Draft Envelope',
    description: 'Send a draft envelope that was previously created.',
    tags: ['crm', 'docusign', 'envelope', 'beta'],
    secret: '@platform/docusign',
    instruction: {
      method: 'PUT',
      url: field({
        name: 'base_url',
        description:
          'DocuSign base URL - e.g., https://demo.docusign.net or https://na1.docusign.net',
        placeholder: true,
      }),
      path: [
        '/restapi/v2.1/accounts/',
        field({
          name: 'account_id',
          description: 'DocuSign account ID',
          placeholder: true,
        }),
        '/envelopes/',
        field({
          name: 'envelope_id',
          description: 'the envelope ID to send',
        }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        status: 'sent',
      },
    },
  }),

  'docusign/envelope/void': createFetchTemplate({
    provider: 'docusign',
    icon: '@logo/docusign.com',
    name: 'Void Envelope',
    description: 'Void an envelope that has not yet been completed.',
    tags: ['crm', 'docusign', 'envelope', 'beta'],
    secret: '@platform/docusign',
    instruction: {
      method: 'PUT',
      url: field({
        name: 'base_url',
        description:
          'DocuSign base URL - e.g., https://demo.docusign.net or https://na1.docusign.net',
        placeholder: true,
      }),
      path: [
        '/restapi/v2.1/accounts/',
        field({
          name: 'account_id',
          description: 'DocuSign account ID',
          placeholder: true,
        }),
        '/envelopes/',
        field({
          name: 'envelope_id',
          description: 'the envelope ID to void',
        }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        status: 'voided',
        voidedReason: field({
          name: 'voided_reason',
          description: 'the reason for voiding the envelope',
        }),
      },
    },
  }),

  // --- Template abilities ---

  'docusign/template/list': createFetchTemplate({
    provider: 'docusign',
    icon: '@logo/docusign.com',
    name: 'List Templates',
    description: 'List all templates available in the DocuSign account.',
    tags: ['crm', 'docusign', 'template', 'beta'],
    secret: '@platform/docusign',
    instruction: {
      method: 'GET',
      url: field({
        name: 'base_url',
        description:
          'DocuSign base URL - e.g., https://demo.docusign.net or https://na1.docusign.net',
        placeholder: true,
      }),
      path: [
        '/restapi/v2.1/accounts/',
        field({
          name: 'account_id',
          description: 'DocuSign account ID',
          placeholder: true,
        }),
        '/templates',
      ],
      query: {
        count: field({
          name: 'count',
          type: 'number',
          description: 'maximum number of templates to return',
          placeholder: true,
          default: 25,
        }),
        search_text: field({
          name: 'search_text',
          description: 'search text to filter templates by name',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'docusign/template/fetch': createFetchTemplate({
    provider: 'docusign',
    icon: '@logo/docusign.com',
    name: 'Fetch Template',
    description: 'Fetch details of a specific template from DocuSign.',
    tags: ['crm', 'docusign', 'template', 'beta'],
    secret: '@platform/docusign',
    instruction: {
      method: 'GET',
      url: field({
        name: 'base_url',
        description:
          'DocuSign base URL - e.g., https://demo.docusign.net or https://na1.docusign.net',
        placeholder: true,
      }),
      path: [
        '/restapi/v2.1/accounts/',
        field({
          name: 'account_id',
          description: 'DocuSign account ID',
          placeholder: true,
        }),
        '/templates/',
        field({
          name: 'template_id',
          description: 'the template ID to fetch',
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  // --- Recipient abilities ---

  'docusign/recipient/list': createFetchTemplate({
    provider: 'docusign',
    icon: '@logo/docusign.com',
    name: 'List Envelope Recipients',
    description: 'List all recipients of an envelope.',
    tags: ['crm', 'docusign', 'recipient', 'beta'],
    secret: '@platform/docusign',
    instruction: {
      method: 'GET',
      url: field({
        name: 'base_url',
        description:
          'DocuSign base URL - e.g., https://demo.docusign.net or https://na1.docusign.net',
        placeholder: true,
      }),
      path: [
        '/restapi/v2.1/accounts/',
        field({
          name: 'account_id',
          description: 'DocuSign account ID',
          placeholder: true,
        }),
        '/envelopes/',
        field({
          name: 'envelope_id',
          description: 'the envelope ID',
        }),
        '/recipients',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'docusign/recipient/resend': createFetchTemplate({
    provider: 'docusign',
    icon: '@logo/docusign.com',
    name: 'Resend Envelope to Recipients',
    description: 'Resend the envelope notification to recipients.',
    tags: ['crm', 'docusign', 'recipient', 'beta'],
    secret: '@platform/docusign',
    instruction: {
      method: 'PUT',
      url: field({
        name: 'base_url',
        description:
          'DocuSign base URL - e.g., https://demo.docusign.net or https://na1.docusign.net',
        placeholder: true,
      }),
      path: [
        '/restapi/v2.1/accounts/',
        field({
          name: 'account_id',
          description: 'DocuSign account ID',
          placeholder: true,
        }),
        '/envelopes/',
        field({
          name: 'envelope_id',
          description: 'the envelope ID',
        }),
        '/recipients',
      ],
      query: {
        resend_envelope: 'true',
      },
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {},
    },
  }),

  // --- SQL interface ---

  'docusign/sql/exec': createAuxiliaryTemplate<Schema>({
    provider: 'docusign',
    icon: '@logo/docusign.com',
    name: 'Execute DocuSign SQL Query',
    description:
      'Execute a simple SQL query in DocuSign. Known tables include docusign.envelopes and docusign.templates. Joining tables and other complex queries are not supported.',
    tags: ['crm', 'docusign', 'sql', 'beta'],
    path: '/api/auxiliary/skillset/ability/docusign/sql',
    secret: '@platform/docusign',
    instruction: {
      sql: field({
        name: 'sql',
        description:
          'the SQL query to execute - describe, select are supported',
        placeholder: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  'pack/docusign': createPackTemplate({
    provider: 'docusign',
    icon: '@logo/docusign.com',
    name: 'Install DocuSign Tools',
    description:
      'Installs DocuSign tools into the conversation. You can manage envelopes, templates, and recipients for e-signatures.',
    tags: ['docusign', 'pack', 'beta'],
    secret: '@platform/docusign',
    instruction: {
      abilities: [
        'docusign/envelope/list',
        'docusign/envelope/fetch',
        'docusign/envelope/create',
        'docusign/envelope/send',
        'docusign/envelope/void',
        'docusign/template/list',
        'docusign/template/fetch',
        'docusign/recipient/list',
        'docusign/recipient/resend',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/docusign[read-only]': createPackTemplate({
    provider: 'docusign',
    icon: '@logo/docusign.com',
    name: 'Install DocuSign Search Tools',
    description:
      'Installs read-only DocuSign tools into the conversation. You can list and fetch envelopes, templates, and recipients without modification.',
    tags: ['docusign', 'pack', 'beta'],
    secret: '@platform/docusign',
    instruction: {
      abilities: [
        'docusign/envelope/list',
        'docusign/envelope/fetch',
        'docusign/template/list',
        'docusign/template/fetch',
        'docusign/recipient/list',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
