'use client'

import { useMemo, useState } from 'react'
import { MdCode, MdCodeOff } from 'react-icons/md'

import { stringify as stringifyYaml } from '@/lib/yaml'

import CodeBlock from '@/components/CodeBlock'
import Component from '@/components/Component'

import clsx from 'clsx'

export default function ObjectView({
  className,
  object = {},
  children,
  ...props
}) {
  const [useYaml, setUseYaml] = useState(true)

  const code = useMemo(() => {
    if (useYaml) {
      return stringifyYaml(object)
    } else {
      return JSON.stringify(object, null, 2)
    }
  }, [object, useYaml])

  return (
    <CodeBlock
      {...props}
      className={clsx('object-view', className)}
      language={useYaml ? 'yaml' : 'json'}
      actions={
        <>
          <Component
            className="cursor-pointer rounded-xl auto-text-gray-400 hover:auto-text-gray-800 w-4 h-4 transition-all"
            as={useYaml ? MdCodeOff : MdCode}
            onClick={() => {
              setUseYaml((useYaml) => !useYaml)
            }}
          />
          {children}
        </>
      }
    >
      {code}
    </CodeBlock>
  )
}
