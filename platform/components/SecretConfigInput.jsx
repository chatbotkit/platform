import { useMemo } from 'react'

import { SecretConfig } from '@/prisma/zod'

import { getTemplate } from '@/lib/template'

import ObjectInput from '@/components/ObjectInput'

import useControlledState from '@/hooks/useControlledState'

import clsx from 'clsx'

export default function SecretConfigInput({
  defaultConfig: _defaultConfig,
  config: _config,
  setConfig: _setConfig,

  secretType,
  templates = {},

  className,

  ...props
}) {
  const [config, setConfig] = useControlledState(
    _defaultConfig,
    _config,
    _setConfig
  )

  const zodSchema = useMemo(
    () =>
      SecretConfig.refine(
        (value) => {
          if (secretType !== 'template') {
            return true
          }

          if (!value?.template) {
            return true
          }

          return Boolean(getTemplate(value.template, templates))
        },
        {
          message: 'The selected secret template does not exist.',
        }
      ),
    [secretType, templates]
  )

  return (
    <ObjectInput
      {...props}
      className={clsx('default-input w-full', className)}
      object={config}
      setObject={setConfig}
      zodSchema={zodSchema}
    />
  )
}
