import {
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

/**
 * Catalogue of BambooHR abilities.
 *
 * BambooHR is a cloud-based HR software platform for managing employee data,
 * time-off, onboarding, and HR workflows.
 *
 * @see https://documentation.bamboohr.com/reference
 */
const abilities = {
  'bamboohr/employee/list': createFetchTemplate({
    provider: 'bamboohr',
    icon: '@logo/bamboohr.com',
    name: 'List Employees',
    description:
      'Get the employee directory listing all employees with basic information',
    tags: ['bamboohr', 'employee', 'list', 'hr'],
    secret: '@bamboohr',
    instruction: {
      method: 'GET',
      url: 'https://api.bamboohr.com/api/gateway.php',
      path: [
        '/',
        field({
          name: 'subdomain',
          description: 'the BambooHR company subdomain',
          placeholder: true,
        }),
        '/v1/employees/directory',
      ],
      headers: {
        Accept: 'application/json',
        Authorization: secret(),
      },
    },
  }),

  'bamboohr/employee/fetch': createFetchTemplate({
    provider: 'bamboohr',
    icon: '@logo/bamboohr.com',
    name: 'Get Employee',
    description:
      'Get detailed information about a specific employee by their ID',
    tags: ['bamboohr', 'employee', 'fetch', 'hr'],
    secret: '@bamboohr',
    instruction: {
      method: 'GET',
      url: 'https://api.bamboohr.com/api/gateway.php',
      path: [
        '/',
        field({
          name: 'subdomain',
          description: 'the BambooHR company subdomain',
          placeholder: true,
        }),
        '/v1/employees/',
        field({
          name: 'employeeId',
          description: 'the employee ID',
        }),
      ],
      query: {
        fields: field({
          name: 'fields',
          description:
            'comma-separated list of fields to include (e.g., firstName,lastName,department)',
          optional: true,
        }),
      },
      headers: {
        Accept: 'application/json',
        Authorization: secret(),
      },
    },
  }),

  'bamboohr/employee/create': createFetchTemplate({
    provider: 'bamboohr',
    icon: '@logo/bamboohr.com',
    name: 'Create Employee',
    description: 'Add a new employee to BambooHR',
    tags: ['bamboohr', 'employee', 'create', 'hr'],
    secret: '@bamboohr',
    instruction: {
      method: 'POST',
      url: 'https://api.bamboohr.com/api/gateway.php',
      path: [
        '/',
        field({
          name: 'subdomain',
          description: 'the BambooHR company subdomain',
          placeholder: true,
        }),
        '/v1/employees',
      ],
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: secret(),
      },
      body: {
        firstName: field({
          name: 'firstName',
          description: 'the first name of the employee',
        }),
        lastName: field({
          name: 'lastName',
          description: 'the last name of the employee',
        }),
        department: field({
          name: 'department',
          description: 'the department the employee belongs to',
          optional: true,
        }),
        division: field({
          name: 'division',
          description: 'the division the employee belongs to',
          optional: true,
        }),
        hireDate: field({
          name: 'hireDate',
          description: 'the hire date in YYYY-MM-DD format',
          optional: true,
        }),
        location: field({
          name: 'location',
          description: 'the work location of the employee',
          optional: true,
        }),
        jobTitle: field({
          name: 'jobTitle',
          description: 'the job title of the employee',
          optional: true,
        }),
        mobilePhone: field({
          name: 'mobilePhone',
          description: 'the mobile phone number',
          optional: true,
        }),
        workEmail: field({
          name: 'workEmail',
          description: 'the work email address',
          optional: true,
        }),
      },
    },
  }),

  'bamboohr/employee/update': createFetchTemplate({
    provider: 'bamboohr',
    icon: '@logo/bamboohr.com',
    name: 'Update Employee',
    description: 'Update an existing employee record in BambooHR',
    tags: ['bamboohr', 'employee', 'update', 'hr'],
    secret: '@bamboohr',
    instruction: {
      method: 'POST',
      url: 'https://api.bamboohr.com/api/gateway.php',
      path: [
        '/',
        field({
          name: 'subdomain',
          description: 'the BambooHR company subdomain',
          placeholder: true,
        }),
        '/v1/employees/',
        field({
          name: 'employeeId',
          description: 'the employee ID to update',
        }),
      ],
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: secret(),
      },
      body: {
        firstName: field({
          name: 'firstName',
          description: 'the first name of the employee',
          optional: true,
        }),
        lastName: field({
          name: 'lastName',
          description: 'the last name of the employee',
          optional: true,
        }),
        department: field({
          name: 'department',
          description: 'the department the employee belongs to',
          optional: true,
        }),
        division: field({
          name: 'division',
          description: 'the division the employee belongs to',
          optional: true,
        }),
        hireDate: field({
          name: 'hireDate',
          description: 'the hire date in YYYY-MM-DD format',
          optional: true,
        }),
        location: field({
          name: 'location',
          description: 'the work location of the employee',
          optional: true,
        }),
        jobTitle: field({
          name: 'jobTitle',
          description: 'the job title of the employee',
          optional: true,
        }),
        mobilePhone: field({
          name: 'mobilePhone',
          description: 'the mobile phone number',
          optional: true,
        }),
        workEmail: field({
          name: 'workEmail',
          description: 'the work email address',
          optional: true,
        }),
      },
    },
  }),

  'bamboohr/file/list': createFetchTemplate({
    provider: 'bamboohr',
    icon: '@logo/bamboohr.com',
    name: 'List Company Files',
    description: 'List all company files and their categories in BambooHR',
    tags: ['bamboohr', 'file', 'list', 'hr'],
    secret: '@bamboohr',
    instruction: {
      method: 'GET',
      url: 'https://api.bamboohr.com/api/gateway.php',
      path: [
        '/',
        field({
          name: 'subdomain',
          description: 'the BambooHR company subdomain',
          placeholder: true,
        }),
        '/v1/files/view',
      ],
      headers: {
        Accept: 'application/json',
        Authorization: secret(),
      },
    },
  }),

  'bamboohr/report/fetch': createFetchTemplate({
    provider: 'bamboohr',
    icon: '@logo/bamboohr.com',
    name: 'Get Company Report',
    description:
      'Retrieve a custom company report with specified fields from BambooHR',
    tags: ['bamboohr', 'report', 'fetch', 'hr'],
    secret: '@bamboohr',
    instruction: {
      method: 'POST',
      url: 'https://api.bamboohr.com/api/gateway.php',
      path: [
        '/',
        field({
          name: 'subdomain',
          description: 'the BambooHR company subdomain',
          placeholder: true,
        }),
        '/v1/reports/custom',
      ],
      query: {
        format: field({
          name: 'format',
          description: 'the output format',
          enum: ['json', 'csv', 'xml', 'pdf'],
          optional: true,
          default: 'json',
        }),
      },
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: secret(),
      },
      body: {
        title: field({
          name: 'title',
          description: 'the title of the report',
          optional: true,
          default: 'Custom Report',
        }),
        fields: field({
          name: 'fields',
          description:
            'array of field names to include (e.g., ["firstName", "lastName", "department"])',
        }),
      },
    },
  }),

  'bamboohr/time-off/request/list': createFetchTemplate({
    provider: 'bamboohr',
    icon: '@logo/bamboohr.com',
    name: 'List Time Off Requests',
    description:
      'Get a list of time off requests within a date range from BambooHR',
    tags: ['bamboohr', 'time-off', 'list', 'hr'],
    secret: '@bamboohr',
    instruction: {
      method: 'GET',
      url: 'https://api.bamboohr.com/api/gateway.php',
      path: [
        '/',
        field({
          name: 'subdomain',
          description: 'the BambooHR company subdomain',
          placeholder: true,
        }),
        '/v1/time_off/requests',
      ],
      query: {
        start: field({
          name: 'startDate',
          description: 'start date for the range in YYYY-MM-DD format',
        }),
        end: field({
          name: 'endDate',
          description: 'end date for the range in YYYY-MM-DD format',
        }),
        status: field({
          name: 'status',
          description: 'filter by request status',
          enum: ['approved', 'pending', 'denied', 'canceled', 'superseded'],
          optional: true,
        }),
        employeeId: field({
          name: 'employeeId',
          description: 'filter by specific employee ID',
          optional: true,
        }),
      },
      headers: {
        Accept: 'application/json',
        Authorization: secret(),
      },
    },
  }),

  'bamboohr/api/call': createFetchTemplate({
    provider: 'bamboohr',
    icon: '@logo/bamboohr.com',
    name: 'Call Bamboohr API',
    description:
      'Make a generic API call to Bamboohr. This is a flexible template that can be used to call any Bamboohr API endpoint by specifying the method, URL, and request body.',
    tags: ['bamboohr', 'api', 'call', 'generic'],
    secret: '@bamboohr',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Bamboohr API endpoint to call',
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

  'pack/bamboohr': createPackTemplate({
    provider: 'bamboohr',
    icon: '@logo/bamboohr.com',
    name: 'Install BambooHR Tools',
    description:
      'Installs BambooHR tools into the conversation. You can manage employees, files, reports, and time-off requests.',
    tags: ['bamboohr', 'pack', 'beta'],
    secret: '@bamboohr',
    instruction: {
      abilities: [
        'bamboohr/employee/list',
        'bamboohr/employee/fetch',
        'bamboohr/employee/create',
        'bamboohr/employee/update',
        'bamboohr/file/list',
        'bamboohr/report/fetch',
        'bamboohr/time-off/request/list',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/bamboohr[read-only]': createPackTemplate({
    provider: 'bamboohr',
    icon: '@logo/bamboohr.com',
    name: 'Install BambooHR Search Tools',
    description:
      'Installs read-only BambooHR tools into the conversation. You can list and fetch employees, files, and reports without modification.',
    tags: ['bamboohr', 'pack', 'beta'],
    secret: '@bamboohr',
    instruction: {
      abilities: [
        'bamboohr/employee/list',
        'bamboohr/employee/fetch',
        'bamboohr/file/list',
        'bamboohr/report/fetch',
        'bamboohr/time-off/request/list',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
