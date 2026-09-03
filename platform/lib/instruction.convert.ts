import {
  ACTION_TAGS_SCHEMA,
  ArrayField,
  BooleanField,
  NumberField,
  ObjectField,
  StringField,
} from '@/lib/action.tags'
import type { FieldSchema } from '@/lib/instruction.field'
import { extractInstructionFields } from '@/lib/instruction.field'

import yaml from 'js-yaml'

interface Template {
  template: string
  instruction: string
}

type ActionTagField =
  | StringField
  | NumberField
  | BooleanField
  | ArrayField
  | ObjectField

/**
 * Converts a FieldSchema items/properties structure to the format expected by ArrayField/ObjectField.
 * These field classes expect items and properties to be plain objects, not FieldSchema objects.
 */
function convertFieldSchemaToPlain(
  schema: FieldSchema
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    type: schema.type,
    description: schema.description,
  }

  if (schema.items) {
    result.items = convertFieldSchemaToPlain(schema.items)
  }

  if (schema.properties) {
    result.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([key, value]) => [
        key,
        convertFieldSchemaToPlain(value),
      ])
    )
  }

  return result
}

/**
 * The name is not super clear what it does but in general terms, it takes a
 * template and converts it to a template instruction which contains the id of
 * the template as well as the parameters that the template accepts. This method
 * is used both in the designer as well as the InstructionInput to provide the
 * right information to the user when they are creating a new instruction.
 */
export function convertToCallableTemplateInstruction(
  template: Template
): string {
  // @note extract all instruction fields and filter to only placeholders (round bracket fields)

  const allFields = extractInstructionFields(template.instruction)
  const placeholderFields = allFields.filter((field) => field.placeholder)

  // @note build the parameters object with action tag field instances

  const parameters: Record<string, ActionTagField> = {}

  for (const field of placeholderFields) {
    const fieldDef = {
      name: field.name,
      description: field.description,
      optional: !field.required,
      placeholder: true,
    }

    // @note create appropriate field instance based on field type

    switch (field.type) {
      case 'number': {
        parameters[field.name] = new NumberField(fieldDef)

        break
      }

      case 'boolean': {
        parameters[field.name] = new BooleanField(fieldDef)

        break
      }

      case 'array': {
        parameters[field.name] = new ArrayField({
          ...fieldDef,
          items: field.items
            ? convertFieldSchemaToPlain(field.items)
            : { type: 'string' },
        })

        break
      }

      case 'object': {
        parameters[field.name] = new ObjectField({
          ...fieldDef,
          properties: field.properties
            ? Object.fromEntries(
                Object.entries(field.properties).map(([key, value]) => [
                  key,
                  convertFieldSchemaToPlain(value),
                ])
              )
            : {},
        })

        break
      }

      case 'string':
      default: {
        parameters[field.name] = new StringField(fieldDef)

        break
      }
    }
  }

  // @note use js-yaml with ACTION_TAGS_SCHEMA to serialize the field instances with proper YAML tags

  const result = yaml.dump(
    {
      template: template.template,
      parameters: placeholderFields.length ? parameters : undefined,
    },
    {
      schema: ACTION_TAGS_SCHEMA,
      forceQuotes: true,
      quotingType: '"',
    }
  )

  return result
}
