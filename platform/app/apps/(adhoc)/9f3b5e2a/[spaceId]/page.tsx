import { Error } from '@/layouts/Errata'

import { Main } from './components'
import { getSpace, listFiles } from './server'

export default async function Page(props: {
  params: Promise<{ spaceId: string }>
}) {
  const params = await props.params

  const [spaceResult, filesResult] = await Promise.all([
    getSpace({ id: params.spaceId }),
    listFiles({ spaceId: params.spaceId }),
  ])

  if (!spaceResult || !filesResult) {
    return (
      <div className="main-page main-page-3xl">
        <Error error="loading" error_description="Loading..." />
      </div>
    )
  }

  if ('error' in spaceResult) {
    return (
      <div className="main-page main-page-3xl">
        <Error
          error={spaceResult.error.code}
          error_description={spaceResult.error.message}
        />
      </div>
    )
  }

  if ('error' in filesResult) {
    return (
      <div className="main-page main-page-3xl">
        <Error
          error={filesResult.error.code}
          error_description={filesResult.error.message}
        />
      </div>
    )
  }

  const { space } = spaceResult
  const { items: files } = filesResult

  return (
    <div className="main-page main-page-3xl">
      {/* @ts-ignore ignore for now */}
      <Main space={space} initialFiles={files} />
    </div>
  )
}
