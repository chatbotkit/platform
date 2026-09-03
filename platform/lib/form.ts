/* eslint-disable @typescript-eslint/no-explicit-any */
import { warn } from '@/lib/debug'
import { parse as parseYaml } from '@/lib/yaml'

export function formToData(
  form: HTMLFormElement | HTMLElement | null | undefined
): Record<string, any> | undefined {
  if (!form) {
    warn('formToData: form is null or undefined')

    return
  }

  const formElement: HTMLFormElement | undefined =
    (form as any).tagName === 'FORM' ? form : (form as any).form

  if (!formElement) {
    return
  }

  const formData = new FormData(formElement)

  const data: Record<string, any> = {
    ...Object.fromEntries(formData.entries()),
  }

  // handle object fields
  {
    const elements = Object.fromEntries(
      Array.from(
        formElement.querySelectorAll<HTMLTextAreaElement | HTMLInputElement>(
          '[data-type="object"]'
        )
      ).map((el) => [el.name, el])
    )

    for (const field of Object.keys(elements)) {
      if (!field || data[field] === undefined) {
        // @note skip elements without a name or without corresponding form data
        continue
      }

      data[field] = (data[field] as string).trim()

      if (!data[field]) {
        data[field] = null
      } else {
        try {
          data[field] = parseYaml(data[field])

          if (typeof data[field] !== 'object') {
            throw new Error('Must be an object')
          }
        } catch {
          return
        }
      }
    }
  }

  // handle data-type="number" fields
  {
    const numberFields = Array.from(
      formElement.querySelectorAll<HTMLElement>('[data-type="number"]')
    ).map((el) => (el as HTMLInputElement).name)

    for (const field of numberFields) {
      if (!field || data[field] === undefined) {
        // @note skip elements without a name or without corresponding form data
        continue
      }

      data[field] = (data[field] as string).trim()

      if (data[field] === '') {
        delete data[field]
      } else {
        data[field] = Number(data[field])

        if (isNaN(data[field])) {
          delete data[field]
        }
      }
    }
  }

  // handle data-type="number-or-null" fields
  //
  // @note like data-type="number" but an empty value resolves to an explicit
  // `null` instead of being omitted. Use this for nullable numeric fields where
  // "cleared" must overwrite a previously set value (e.g. resetting a duration
  // back to its automatic default), rather than leaving it unchanged.
  {
    const numberOrNullFields = Array.from(
      formElement.querySelectorAll<HTMLElement>('[data-type="number-or-null"]')
    ).map((el) => (el as HTMLInputElement).name)

    for (const field of numberOrNullFields) {
      if (!field || data[field] === undefined) {
        // @note skip elements without a name or without corresponding form data

        continue
      }

      data[field] = (data[field] as string).trim()

      if (data[field] === '') {
        data[field] = null
      } else {
        data[field] = Number(data[field])

        if (isNaN(data[field])) {
          data[field] = null
        }
      }
    }
  }

  // handle data-type="boolean" fields
  {
    const booleanFields = Array.from(
      formElement.querySelectorAll<HTMLElement>('[data-type="boolean"]')
    ).map((el) => (el as HTMLInputElement).name)

    for (const field of booleanFields) {
      if (!field || data[field] === undefined) {
        // @note skip elements without a name or without corresponding form data
        continue
      }

      data[field] = data[field] === 'true' || data[field] === 'on'
    }
  }

  // handle boolean fields (fallback for checkboxes without data-type)
  {
    const booleanFields = Array.from(
      formElement.querySelectorAll<HTMLInputElement>(
        'input[type="checkbox"]:not([data-type])'
      )
    ).map((input) => input.name)

    for (const field of booleanFields) {
      if (data[field] === 'on') {
        data[field] = true
      } else {
        data[field] = false
      }
    }
  }

  // handle number fields (fallback for number inputs without data-type)
  {
    const numberFields = Array.from(
      formElement.querySelectorAll<HTMLInputElement>(
        'input[type="number"]:not([data-type])'
      )
    ).map((input) => input.name)

    for (const field of numberFields) {
      if (!field || data[field] === undefined) {
        // @note skip elements without a name or without corresponding form data
        continue
      }

      data[field] = (data[field] as string).trim()

      if (data[field] === '') {
        delete data[field]
      } else {
        data[field] = Number(data[field])

        if (isNaN(data[field])) {
          delete data[field]
        }
      }
    }
  }

  // delete empty keys
  {
    for (const key in data) {
      if (!key.trim()) {
        delete data[key]
      }
    }
  }

  // delete keys starting with _
  {
    for (const key in data) {
      if (key.startsWith('_')) {
        delete data[key]
      }
    }
  }

  return data
}
