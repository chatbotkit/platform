import { useMemo, useState } from 'react'

import { getRandomId } from '@/lib/string'
import { parse, tryStringify } from '@/lib/yaml'

import DynamicIcon from '@/components/DynamicIcon'
import List from '@/components/List'
import ObjectInput from '@/components/ObjectInput'
import { useExtendWidgetFunctions } from '@/components/Widget'

import useControlledState from '@/hooks/useControlledState'
import useFuzzySearch from '@/hooks/useFuzzySearch'
import usePopup from '@/hooks/usePopup'

import { Square3Stack3DIcon } from '@heroicons/react/24/outline'

import clsx from 'clsx'

// @note extract schema templates for common use cases

const EXTRACT_SCHEMA_TEMPLATES = [
  {
    id: 'lead-capture',
    icon: '@heroicons/user-plus',
    name: 'Lead Capture',
    description: 'Capture basic lead information from conversations',
    tags: ['lead', 'contact', 'sales'],
    schema: {
      name: {
        type: 'string',
        description: "The customer's full name",
        required: true,
      },
      email: {
        type: 'string',
        description: "The customer's email address",
        required: true,
      },
      phone: {
        type: 'string',
        description: "The customer's phone number",
      },
      company: {
        type: 'string',
        description: "The customer's company name",
      },
      interest: {
        type: 'string',
        description: 'What product or service the customer is interested in',
      },
    },
  },
  {
    id: 'e-commerce-support',
    icon: '@heroicons/shopping-cart',
    name: 'E-Commerce Support',
    description: 'Extract order and product inquiry details',
    tags: ['ecommerce', 'order', 'product', 'support'],
    schema: {
      customerName: {
        type: 'string',
        description: "The customer's full name",
      },
      email: {
        type: 'string',
        description: "The customer's email address",
      },
      orderId: {
        type: 'string',
        description: 'The order ID being discussed',
      },
      product: {
        type: 'string',
        description: 'The product the customer is inquiring about',
      },
      issue: {
        type: 'string',
        description: "The customer's specific issue or question",
      },
    },
  },
  {
    id: 'e-commerce-metrics',
    icon: '@heroicons/chart-bar',
    name: 'E-Commerce with Metrics',
    description: 'Track order values and quantities as metrics',
    tags: ['ecommerce', 'metrics', 'analytics', 'numbers'],
    schema: {
      customerName: {
        type: 'string',
        description: "The customer's full name",
      },
      orderAmount: {
        type: 'number',
        description: 'The total order amount',
        collect: true,
      },
      quantity: {
        type: 'number',
        description: 'Number of items ordered',
        collect: true,
      },
      discountPercent: {
        type: 'number',
        description: 'Discount percentage applied',
        collect: true,
      },
    },
  },
  {
    id: 'customer-feedback',
    icon: '@heroicons/star',
    name: 'Customer Feedback',
    description: 'Collect customer satisfaction and feedback data',
    tags: ['feedback', 'satisfaction', 'rating', 'metrics'],
    schema: {
      customerName: {
        type: 'string',
        description: "The customer's name",
      },
      satisfactionRating: {
        type: 'number',
        description: 'Customer satisfaction rating from 1-10',
        collect: true,
      },
      npsScore: {
        type: 'number',
        description: 'Net Promoter Score from 0-10',
        collect: true,
      },
      feedback: {
        type: 'string',
        description: 'Detailed customer feedback',
      },
      recommendationLikelihood: {
        type: 'string',
        description: 'Would the customer recommend us (yes/no/maybe)',
      },
    },
  },
  {
    id: 'support-ticket',
    icon: '@heroicons/ticket',
    name: 'Support Ticket',
    description: 'Extract support ticket information',
    tags: ['support', 'ticket', 'help', 'issue'],
    schema: {
      customerName: {
        type: 'string',
        description: "The customer's name",
        required: true,
      },
      email: {
        type: 'string',
        description: "The customer's email address",
        required: true,
      },
      issueCategory: {
        type: 'string',
        description:
          'The category of the issue (billing, technical, account, other)',
      },
      priority: {
        type: 'string',
        description: 'The urgency level (low, medium, high, critical)',
      },
      issueDescription: {
        type: 'string',
        description: 'Detailed description of the issue',
      },
      resolutionStatus: {
        type: 'string',
        description: 'Whether the issue was resolved in the conversation',
      },
    },
  },
  {
    id: 'appointment-booking',
    icon: '@heroicons/calendar',
    name: 'Appointment Booking',
    description: 'Capture appointment scheduling information',
    tags: ['appointment', 'booking', 'schedule', 'calendar'],
    schema: {
      customerName: {
        type: 'string',
        description: "The customer's full name",
        required: true,
      },
      email: {
        type: 'string',
        description: "The customer's email address",
        required: true,
      },
      phone: {
        type: 'string',
        description: "The customer's phone number",
      },
      preferredDate: {
        type: 'string',
        description: "The customer's preferred appointment date",
      },
      preferredTime: {
        type: 'string',
        description: "The customer's preferred appointment time",
      },
      serviceType: {
        type: 'string',
        description: 'The type of service or appointment requested',
      },
      notes: {
        type: 'string',
        description: 'Additional notes or special requests',
      },
    },
  },
  {
    id: 'survey-responses',
    icon: '@heroicons/clipboard-document-list',
    name: 'Survey Responses',
    description: 'Collect survey and questionnaire responses with metrics',
    tags: ['survey', 'questionnaire', 'metrics', 'research'],
    schema: {
      respondentName: {
        type: 'string',
        description: 'Name of the survey respondent',
      },
      productQualityScore: {
        type: 'number',
        description: 'Product quality rating from 1-5',
        collect: true,
      },
      serviceQualityScore: {
        type: 'number',
        description: 'Service quality rating from 1-5',
        collect: true,
      },
      valueForMoneyScore: {
        type: 'number',
        description: 'Value for money rating from 1-5',
        collect: true,
      },
      overallScore: {
        type: 'number',
        description: 'Overall experience rating from 1-5',
        collect: true,
      },
      openFeedback: {
        type: 'string',
        description: 'Open-ended feedback from the respondent',
      },
    },
  },
  {
    id: 'sales-qualification',
    icon: '@heroicons/currency-dollar',
    name: 'Sales Qualification',
    description: 'Qualify leads with budget and timeline information',
    tags: ['sales', 'qualification', 'budget', 'metrics'],
    schema: {
      contactName: {
        type: 'string',
        description: "The prospect's name",
        required: true,
      },
      company: {
        type: 'string',
        description: "The prospect's company",
      },
      budgetAmount: {
        type: 'number',
        description: "The prospect's budget amount",
        collect: true,
      },
      teamSize: {
        type: 'number',
        description: "Size of the prospect's team",
        collect: true,
      },
      timeline: {
        type: 'string',
        description: 'When the prospect is looking to make a decision',
      },
      painPoints: {
        type: 'string',
        description: 'Main challenges or pain points mentioned',
      },
      decisionMaker: {
        type: 'boolean',
        description: 'Whether the contact is a decision maker',
      },
    },
  },
]

function ExtractSchemaTemplateDialog({ templates = [] }) {
  const [selectedId, setSelectedId] = useState()
  const [selectedSchema, setSelectedSchema] = useState('')
  const [search, setSearch] = useState('')

  const filteredTemplates = useFuzzySearch(templates, search, {
    keys: useMemo(() => ['id', 'name', 'description', 'tags'], []),
    threshold: 0.4,
    debounce: 1000,
    disabled: !search,
  })

  return (
    <div>
      <input type="hidden" name="schema" value={selectedSchema} />
      <div className="space-y-4 max-h-[500px] h-screen flex flex-col">
        <p className="text-sm">
          Select an extraction schema template from the list below.
        </p>
        <input
          className="default-input w-full"
          type="search"
          placeholder="Search..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="flex-1 h-full overflow-auto">
          <List>
            {filteredTemplates.map(
              ({ id, icon, name, description, schema, tags }) => {
                return (
                  <List.Item
                    key={id}
                    selected={id === selectedId}
                    icon={
                      <DynamicIcon
                        className="w-12 h-12 text-[3rem] rounded-full object-cover bg-white p-2"
                        icon={icon || '@heroicons/cube-transparent'}
                      />
                    }
                    title={name}
                    body={description}
                    onClick={() => {
                      setSelectedId(id)
                      setSelectedSchema(tryStringify(schema) || '')
                    }}
                  >
                    <div className="space-y-2 w-full">
                      {tags?.length > 0 ? (
                        <div className="space-x-1">
                          {tags.map((tag, index) => (
                            <span key={index} className="tag">
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </List.Item>
                )
              }
            )}
          </List>
        </div>
      </div>
    </div>
  )
}

function useExtractSchemaTemplateDialog() {
  const { popup, openPopup, closePopup } = usePopup()

  function open(options) {
    openPopup(
      <ExtractSchemaTemplateDialog templates={EXTRACT_SCHEMA_TEMPLATES} />,
      {
        title: 'Extract Schema Templates',
        actions: {
          Use: {
            default: true,

            async fn(props) {
              options.callback(props)

              closePopup()
            },
          },
        },
      }
    )
  }

  function close() {
    closePopup()
  }

  return [popup, open, close]
}

export default function ExtractSchemaInput({
  defaultSchema: _defaultSchema,
  schema: _schema,
  setSchema: _setSchema,

  className,

  templates = true,

  onTemplateSelect,

  ...props
}) {
  const [schema, setSchema] = useControlledState(
    _defaultSchema,
    _schema,
    _setSchema
  )

  const inputId = useMemo(() => getRandomId(), [])

  // @note register widget functions for AI assistant to get/set the extract schema

  useExtendWidgetFunctions(
    useMemo(
      () => ({
        [`extract_schema_input_get_${inputId}`]: {
          description:
            'Get the current extract schema object. Use this to read the extraction configuration.',
          parameters: {
            type: 'object',
            properties: {},
          },
          handler: async () => {
            return {
              value: schema || {},
            }
          },
        },
        [`extract_schema_input_set_${inputId}`]: {
          description:
            'Set the extract schema object. Use this to update the extraction configuration with property definitions.',
          parameters: {
            type: 'object',
            properties: {
              value: {
                type: 'object',
                description:
                  'The new extract schema object with property definitions (type, description, required, collect)',
              },
            },
            required: ['value'],
          },
          handler: async ({ value: newValue }) => {
            setSchema(newValue)

            return {
              success: true,
              value: newValue,
            }
          },
        },
      }),
      [inputId, schema, setSchema]
    )
  )

  const [templateDialog, templateDialogOpen] = useExtractSchemaTemplateDialog()

  async function handleTemplateClick(event) {
    /**
     * @note required because we do not want to submit forms
     */
    event.preventDefault()
    event.stopPropagation()

    templateDialogOpen({
      callback: (template) => {
        // @note the template dialog returns the schema as a YAML string in the form data

        const schemaValue = template.schema

        if (schemaValue) {
          const parsedSchema = parse(schemaValue)

          if (parsedSchema) {
            setSchema(parsedSchema)
          }
        }

        onTemplateSelect?.(template)
      },
    })
  }

  return (
    <>
      {templateDialog}
      <ObjectInput
        {...props}
        className={clsx('default-input w-full', className)}
        object={schema}
        setObject={setSchema}
      >
        {templates && EXTRACT_SCHEMA_TEMPLATES.length > 0 ? (
          <div className="relative group/tooltip flex">
            <button
              className="default-button tiny"
              type="button"
              onClick={handleTemplateClick}
              disabled={props.disabled}
            >
              <Square3Stack3DIcon className="w-5 h-5" />
            </button>
            <div className="tooltip below w-24">Templates</div>
          </div>
        ) : null}
      </ObjectInput>
    </>
  )
}
