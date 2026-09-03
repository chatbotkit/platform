import type { Immutable } from '@chatbotkit-dev/typescript-utils/object'

import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'

export type PageProperties = PageObjectResponse['properties']

export type SimplifiedPageProperties = Record<string, unknown>

export function getSimplifiedPageProperties(
  properties: Immutable<PageProperties>
): SimplifiedPageProperties {
  const simplified: SimplifiedPageProperties = {}

  for (const [key, value] of Object.entries(properties)) {
    if (
      value.type === 'unique_id' ||
      value.type === 'formula' ||
      value.type === 'rollup' ||
      value.type === 'relation' ||
      value.type === 'people' ||
      value.type === 'files' ||
      value.type === 'button' ||
      value.type === 'created_by' ||
      value.type === 'last_edited_by' ||
      value.type === 'verification'
    ) {
      continue
    }

    switch (value.type) {
      case 'title': {
        simplified[key] = value.title
          .map((item: { plain_text: string }) => item.plain_text)
          .join(' ')

        break
      }

      case 'status': {
        simplified[key] = value.status?.name || null

        break
      }

      case 'rich_text': {
        simplified[key] = value.rich_text
          .map((item: { plain_text: string }) => item.plain_text)
          .join(' ')

        break
      }

      case 'number': {
        simplified[key] = value.number

        break
      }

      case 'checkbox': {
        simplified[key] = value.checkbox

        break
      }

      case 'select': {
        simplified[key] = value.select?.name || null

        break
      }

      case 'multi_select': {
        simplified[key] = value.multi_select.map(
          (item: { name: string }) => item.name
        )

        break
      }

      case 'date': {
        if (value.date) {
          simplified[key] = value.date.start
        } else {
          simplified[key] = null
        }

        break
      }

      case 'url': {
        simplified[key] = value.url || null

        break
      }

      case 'email': {
        simplified[key] = value.email || null

        break
      }

      case 'phone_number': {
        simplified[key] = value.phone_number || null

        break
      }

      case 'created_time': {
        simplified[key] = value.created_time

        break
      }

      case 'last_edited_time': {
        simplified[key] = value.last_edited_time

        break
      }

      default: {
        const x: never = value

        x
      }
    }
  }

  return simplified
}
