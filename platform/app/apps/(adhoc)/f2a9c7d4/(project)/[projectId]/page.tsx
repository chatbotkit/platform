import { Error } from '@/layouts/Errata'

import { Editor } from './components'
import { getProject } from './server'

export default async function Page(props: {
  params: Promise<{ projectId: string }>
}) {
  const params = await props.params

  const result = await getProject({ projectId: params.projectId })

  if (!result) {
    return (
      <div className="main-page main-page-full">
        <Error error="loading" error_description="Loading..." />
      </div>
    )
  }

  if ('error' in result) {
    return (
      <div className="main-page main-page-full">
        <Error
          error={result.error.code}
          error_description={result.error.message}
        />
      </div>
    )
  }

  const { project, assetUrls } = result

  return <Editor project={project} assetUrls={assetUrls} />
}
