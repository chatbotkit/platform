import '@/lib/scope.server'

import platformSecretTemplatesData from '@chatbotkit-dev/secrets-platform'

import standardSecretTemplatesData from '@/data/secrets/catalogue/standard.yaml'

import type { Secret} from '@/prisma/types';
import { SecretType } from '@/prisma/types'

import { decryptRecord } from '@/lib/cloak'
import debug from '@/lib/debug'
import { isDevelopment, isProduction, isStaging, isTest } from '@/lib/env'
import { merge, pick } from '@/lib/object'
import { ALLOWED_TEMPLATE_CONFIG_FIELDS } from '@/lib/secret.constants'
import { isPlatformTemplate, getTemplate } from '@/lib/template'

/**
 * Utility type to get the value of a key in an object type.
 */
type ValueOf<T> = T[keyof T]

/**
 * Retrieves a secret template instance by name. It does not decrypt the config.
 *
 * @param template
 * @returns
 */
export async function getTemplateInstance(
  template: string
): Promise<ValueOf<typeof standardSecretTemplatesData> | null> {
  let instance

  instance = getTemplate(template, platformSecretTemplatesData)

  if (instance) {
    const {
      config,

      developmentConfig,
      stagingConfig,
      productionConfig,

      ...rest
    } = instance

    let finalConfig = config

    {
      if (isDevelopment || isTest) {
        debug('using development config', { config, developmentConfig }).log(
          'secret.template.getTemplateInstance'
        )

        finalConfig = merge(finalConfig, developmentConfig || {})
      }

      if (isStaging) {
        debug('using staging config', { config, stagingConfig }).log(
          'secret.template.getTemplateInstance'
        )

        finalConfig = merge(finalConfig, stagingConfig || {})
      }

      if (isProduction) {
        debug('using production config', { config, productionConfig }).log(
          'secret.template.getTemplateInstance'
        )

        finalConfig = merge(finalConfig, productionConfig || {})
      }

      debug('final config', { finalConfig }).log(
        'secret.template.getTemplateInstance'
      )
    }

    return {
      ...rest,

      config: finalConfig,
    }
  }

  instance = getTemplate(template, standardSecretTemplatesData)

  if (instance) {
    // pass
  }

  return instance
}

/**
 * Retrieves a secret template instance by name and decrypts the config.
 *
 * @param template
 * @returns
 */
export async function revealTemplateInstance(
  template: string
): Promise<ValueOf<typeof standardSecretTemplatesData> | null> {
  if (isPlatformTemplate(template)) {
    const instance = await getTemplateInstance(template)

    if (instance) {
      // @note decryptRecord returns Record<string, unknown> but the decrypted
      // config maintains the same structure as the original

      const config = await decryptRecord(
        instance.config as Record<string, unknown>
      )

      return {
        ...instance,

        config,
      } as typeof instance
    }
  }

  return null
}

/**
 * Retrieves a secret template instance from a secret.
 *
 * @param templateSecret
 * @returns
 */
export async function resolveTemplateSecret(
  templateSecret: Secret
): Promise<Secret | null> {
  if (templateSecret.type === SecretType.template) {
    const { template, parameters } = (templateSecret.config || {}) as {
      template?: string
      parameters?: Record<string, unknown>
    }

    if (template) {
      const instance = await getTemplateInstance(template)

      if (instance) {
        return {
          ...templateSecret,

          ...instance,

          config: {
            // @note template definition config provides the base configuration

            ...instance.config,

            // @note user-specific overrides take precedence, but we only allow
            // specific fields to prevent security issues

            ...pick((templateSecret.config as object) || {}, [
              ...ALLOWED_TEMPLATE_CONFIG_FIELDS,
            ]),

            // @note parameters are applied last for maximum flexibility

            ...parameters,
          },
        }
      }
    }
  }

  return null
}

/**
 * Retrieves a secret template instance from a secret and decrypts the config.
 *
 * @param templateSecret
 * @returns
 */
export async function revealSecretInstanceFromTemplateSecret(
  templateSecret: Secret
): Promise<Secret | null> {
  debug('revealing secret instance from template secret', {
    templateSecret,
  }).log('secret.value.revealSecretInstanceFromTemplateSecret')

  if (templateSecret.type === SecretType.template) {
    const { template, parameters } = (templateSecret.config || {}) as {
      template?: string
      parameters?: Record<string, unknown>
    }

    if (template) {
      const instance = await revealTemplateInstance(template)

      if (instance) {
        return {
          ...templateSecret,

          ...instance,

          config: {
            // @note template definition config provides the base configuration

            ...(typeof instance.config === 'object' ? instance.config : {}),

            // @note user-specific overrides take precedence over template
            // definition config (e.g., clientId from dynamic registration)

            ...pick((templateSecret.config as object) || {}, [
              ...ALLOWED_TEMPLATE_CONFIG_FIELDS,
            ]),

            // @note parameters are applied last for maximum flexibility

            ...parameters,
          },

          value: templateSecret.value,
        }
      }
    }
  }

  return null
}
