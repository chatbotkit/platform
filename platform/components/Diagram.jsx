import { memo, useEffect, useMemo, useState } from 'react'
import { MdCopyAll, MdDownload } from 'react-icons/md'

import { encode as encodeB64 } from '@/lib/b64'
import { merge } from '@/lib/object'
import { saveBlob } from '@/lib/save'
import toast from '@/lib/toast'

import clsx from 'clsx'
import mermaid from 'mermaid'

mermaid.initialize({
  startOnLoad: false, // @note disable automatic rendering of <pre class="mermaid"> blocks
  theme: 'neutral',
  fontFamily: 'monospace',
  suppressErrorRendering: true,
})

const cache = new Map()

export default function Diagram({
  className,

  children,

  download = true,
  copy = true,

  init: _init,

  source: _source = children,

  ...props
}) {
  const source = useMemo(() => {
    let source = _source

    if (_init) {
      let init = _init

      const initMatch = source.match(/^%%([\s\S]*?)%%/)

      if (initMatch) {
        try {
          init = merge(
            // lower priority
            JSON.parse(initMatch[1]),

            // higher priority

            init
          )

          source = source.replace(/%%\{init:\s*.+?\}%%\n?/, '')
        } catch {
          // pass
        }
      }

      source = `%%{init: ${JSON.stringify(init)}}%%\n${source}`
    }

    return source
  }, [_init, _source])

  const id = useMemo(() => {
    return encodeB64(source).replace(/\W/g, '') // @todo use a better hash - it is long and it does not support some latins
  }, [source])

  const [svg, setSvg] = useState(cache.get(id) || '')

  useEffect(() => {
    if (!source) {
      return
    }

    if (svg) {
      return
    }

    async function doRender() {
      try {
        const { svg } = await mermaid.render(id, source)

        cache.set(id, svg)

        setSvg(svg)
      } catch {
        // @note mermaid parse errors are expected when AI generates invalid syntax
        // do not report to Sentry as these are content errors, not application bugs
      }
    }

    doRender()
  }, [source, id, svg])

  return svg ? (
    <div
      {...props}
      className={clsx('diagram cursor-default dark:invert relative', className)}
    >
      <div
        className="flex flex-col justify-center items-center"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div className="absolute top-2 right-2 flex flex-row gap-2">
        {download ? (
          <MdDownload
            className="cursor-pointer text-gray-300 hover:text-gray-500 dark:text-gray-700 dark:hover:text-gray-500 w-4 h-4 transition-all"
            onClick={() => {
              saveBlob(new Blob([svg], { type: 'image/svg+xml' }), {
                name: 'diagram.svg',
              })
            }}
          />
        ) : null}
        {copy ? (
          <MdCopyAll
            className="cursor-pointer text-gray-300 hover:text-gray-500 dark:text-gray-700 dark:hover:text-gray-500 w-4 h-4 transition-all"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(svg)

                toast.success('Diagram copied to your clipboard')
              } catch {
                // @note clipboard API may be blocked by permissions policy

                toast.error('Failed to copy diagram to clipboard')
              }
            }}
          />
        ) : null}
      </div>
    </div>
  ) : null
}

Diagram.Memo = memo(Diagram)
