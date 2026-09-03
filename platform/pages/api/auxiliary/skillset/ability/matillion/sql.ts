import type { Column } from '@chatbotkit-dev/sql/driver'
import { GenericDriver } from '@chatbotkit-dev/sql/driver'
import type { WhereStatement } from '@chatbotkit-dev/sql/parse'
import { getTableName, getWhereProperties } from '@chatbotkit-dev/sql/parse'

import handler from '@/lib/auxiliary.sql'
import call, { getCallError } from '@/lib/call'
import { throwNotAuthenticated } from '@/lib/response'

import { z } from 'zod'

const schema = z.object({
  sql: z.string(),
})

export type Schema = z.infer<typeof schema>

interface Row {
  id: string
}

interface PipelineExecutionRow extends Row {
  projectId?: string
}

/**
 * Driver for Matillion DPC projects.
 *
 * @see https://docs.matillion.com/data-productivity-cloud/api/docs/intro/
 */
class MatillionProjectDriver extends GenericDriver<Row> {
  #token: string

  constructor({ token }: { token: string }) {
    super()

    this.#token = token
  }

  async describeColumns(): Promise<Column[]> {
    return [
      { type: 'string', name: 'id' },
      { type: 'string', name: 'name' },
      { type: 'string', name: 'description' },
      { type: 'string', name: 'warehouse' },
      { type: 'string', name: 'agentDeploymentType' },
      { type: 'string', name: 'createdAt', readOnly: true },
      { type: 'string', name: 'updatedAt', readOnly: true },
    ]
  }

  async doSelect(_columns: string[], where?: WhereStatement) {
    const properties = where ? getWhereProperties(where) : {}

    // @note there's no single project GET endpoint, so we list and filter
    const url = new URL('https://eu1.api.matillion.com/dpc/v1/projects')

    url.searchParams.set('size', '100')

    const response = await call(url.href, {
      headers: {
        Authorization: this.#token,
      },
    })

    if (!response.ok) {
      throw await getCallError(response)
    }

    const result = await response.json()
    let projects = result.results || []

    // @note filter by id if specified
    if (properties['id']) {
      projects = projects.filter((p) => p.id === properties['id'])
    }

    return projects.map((project) => ({ row: project }))
  }

  async doInsert(parameters: Record<string, unknown>) {
    const url = new URL('https://eu1.api.matillion.com/dpc/v1/projects')

    const response = await call(url.href, {
      method: 'POST',
      headers: {
        Authorization: this.#token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(parameters),
    })

    if (!response.ok) {
      throw await getCallError(response)
    }

    const result = await response.json()

    return { id: result.id }
  }

  async doUpdate({ row }: { row: Row }, parameters: Record<string, unknown>) {
    void row
    void parameters

    // @note Matillion DPC API does not support project updates
    throw new Error('Project update is not supported by Matillion API')
  }

  async doDelete({ row }: { row: Row }) {
    const url = new URL(
      `https://eu1.api.matillion.com/dpc/v1/projects/${row.id}`
    )

    const response = await call(url.href, {
      method: 'DELETE',
      headers: {
        Authorization: this.#token,
      },
    })

    if (!response.ok) {
      throw await getCallError(response)
    }
  }
}

/**
 * Driver for Matillion DPC pipelines (published pipelines).
 *
 * @see https://docs.matillion.com/data-productivity-cloud/api/docs/executing-and-managing-a-pipeline/
 */
class MatillionPipelineDriver extends GenericDriver<Row> {
  #token: string

  constructor({ token }: { token: string }) {
    super()

    this.#token = token
  }

  async describeColumns(): Promise<Column[]> {
    return [
      { type: 'string', name: 'name' },
      { type: 'string', name: 'projectId' },
      { type: 'string', name: 'environmentName' },
      { type: 'string', name: 'publishedTime', readOnly: true },
    ]
  }

  async doSelect(_columns: string[], where?: WhereStatement) {
    const properties = where ? getWhereProperties(where) : {}

    if (!properties['projectId']) {
      throw new Error(
        'projectId is required in WHERE clause for pipelines (e.g., WHERE projectId = "...")'
      )
    }

    const url = new URL(
      `https://eu1.api.matillion.com/dpc/v1/projects/${properties['projectId']}/published-pipelines`
    )

    if (properties['environmentName']) {
      url.searchParams.set(
        'environmentName',
        String(properties['environmentName'])
      )
    }

    url.searchParams.set('size', '100')

    const response = await call(url.href, {
      headers: {
        Authorization: this.#token,
      },
    })

    if (!response.ok) {
      throw await getCallError(response)
    }

    const result = await response.json()
    let pipelines = result.results || []

    // @note filter by name if specified
    if (properties['name']) {
      pipelines = pipelines.filter((p) => p.name === properties['name'])
    }

    return pipelines.map((pipeline) => ({
      row: { ...pipeline, projectId: properties['projectId'] },
    }))
  }

  async doInsert(parameters: Record<string, unknown>) {
    void parameters

    // @note pipelines are created through the UI/Git, not via API
    throw new Error(
      'Pipeline creation is not supported via API - use Matillion Designer'
    )
  }

  async doUpdate({ row }: { row: Row }, parameters: Record<string, unknown>) {
    void row
    void parameters

    throw new Error(
      'Pipeline update is not supported via API - use Matillion Designer'
    )
  }

  async doDelete({ row }: { row: Row }) {
    void row

    throw new Error(
      'Pipeline deletion is not supported via API - use Matillion Designer'
    )
  }
}

/**
 * Driver for Matillion DPC pipeline executions.
 *
 * @see https://docs.matillion.com/data-productivity-cloud/api/docs/executing-and-managing-a-pipeline/
 */
class MatillionPipelineExecutionDriver extends GenericDriver<PipelineExecutionRow> {
  #token: string

  constructor({ token }: { token: string }) {
    super()

    this.#token = token
  }

  async describeColumns(): Promise<Column[]> {
    return [
      { type: 'string', name: 'pipelineExecutionId', readOnly: true },
      { type: 'string', name: 'pipelineName' },
      { type: 'string', name: 'projectId' },
      { type: 'string', name: 'environmentName' },
      { type: 'string', name: 'versionName' },
      { type: 'string', name: 'agentId' },
      { type: 'string', name: 'executionTag' },
      { type: 'string', name: 'status', readOnly: true },
      { type: 'string', name: 'startedAt', readOnly: true },
      { type: 'string', name: 'finishedAt', readOnly: true },
      { type: 'string', name: 'message', readOnly: true },
    ]
  }

  async doSelect(_columns: string[], where?: WhereStatement) {
    const properties = where ? getWhereProperties(where) : {}

    // @note if we have pipelineExecutionId and projectId, fetch single execution
    if (properties['pipelineExecutionId'] && properties['projectId']) {
      const url = new URL(
        `https://eu1.api.matillion.com/dpc/v1/projects/${properties['projectId']}/pipeline-executions/${properties['pipelineExecutionId']}`
      )

      const response = await call(url.href, {
        headers: {
          Authorization: this.#token,
        },
      })

      if (!response.ok) {
        throw await getCallError(response)
      }

      const result = await response.json()

      return [{ row: { ...result, id: result.pipelineExecutionId } }]
    }

    // @note list all pipeline executions with optional filters
    const url = new URL(
      'https://eu1.api.matillion.com/dpc/v1/pipeline-executions'
    )

    if (properties['projectId']) {
      url.searchParams.set('projectId', String(properties['projectId']))
    }

    if (properties['pipelineName']) {
      url.searchParams.set('pipelineName', String(properties['pipelineName']))
    }

    if (properties['environmentName']) {
      url.searchParams.set(
        'environmentName',
        String(properties['environmentName'])
      )
    }

    if (properties['status']) {
      url.searchParams.set('status', String(properties['status']))
    }

    url.searchParams.set('limit', '100')

    const response = await call(url.href, {
      headers: {
        Authorization: this.#token,
      },
    })

    if (!response.ok) {
      throw await getCallError(response)
    }

    const result = await response.json()
    const executions = result.results || []

    return executions.map((exec) => ({
      row: { ...exec, id: exec.pipelineExecutionId },
    }))
  }

  async doInsert(parameters: Record<string, unknown>) {
    const { projectId, pipelineName, environmentName, ...rest } = parameters

    if (!projectId) {
      throw new Error('projectId is required to execute a pipeline')
    }

    if (!pipelineName) {
      throw new Error('pipelineName is required to execute a pipeline')
    }

    if (!environmentName) {
      throw new Error('environmentName is required to execute a pipeline')
    }

    const url = new URL(
      `https://eu1.api.matillion.com/dpc/v1/projects/${projectId}/pipeline-executions`
    )

    const response = await call(url.href, {
      method: 'POST',
      headers: {
        Authorization: this.#token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pipelineName,
        environmentName,
        ...rest,
      }),
    })

    if (!response.ok) {
      throw await getCallError(response)
    }

    const result = await response.json()

    return { id: result.pipelineExecutionId }
  }

  async doUpdate(
    { row }: { row: PipelineExecutionRow },
    parameters: Record<string, unknown>
  ) {
    // @note only status can be updated (to cancel)
    const { status, forceUpdate, projectId } = parameters as {
      status?: string
      forceUpdate?: boolean
      projectId?: string
    }

    if (status !== 'CANCELLED') {
      throw new Error('Only CANCELLED status update is supported')
    }

    const actualProjectId = projectId || row.projectId

    if (!actualProjectId) {
      throw new Error('projectId is required to cancel a pipeline execution')
    }

    const url = new URL(
      `https://eu1.api.matillion.com/dpc/v1/projects/${actualProjectId}/pipeline-executions/${row.id}`
    )

    const response = await call(url.href, {
      method: 'PATCH',
      headers: {
        Authorization: this.#token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'CANCELLED',
        ...(forceUpdate !== undefined ? { forceUpdate } : {}),
      }),
    })

    if (!response.ok) {
      throw await getCallError(response)
    }
  }

  async doDelete({ row }: { row: PipelineExecutionRow }) {
    void row

    throw new Error('Pipeline execution deletion is not supported')
  }
}

export default handler(
  schema,
  [
    {
      database: 'matillion',
      name: 'projects',
    },
    {
      database: 'matillion',
      name: 'pipelines',
    },
    {
      database: 'matillion',
      name: 'pipeline_executions',
    },
  ],
  async (table, _parameters, headers) => {
    const token = headers.get('x-access-token')

    if (!token) {
      return throwNotAuthenticated()
    }

    const tableName = getTableName(table)

    switch (tableName) {
      case 'matillion.projects': {
        return new MatillionProjectDriver({ token })
      }

      case 'matillion.pipelines': {
        return new MatillionPipelineDriver({ token })
      }

      case 'matillion.pipeline_executions': {
        return new MatillionPipelineExecutionDriver({ token })
      }
    }

    throw new Error(`No driver found for table ${tableName}`)
  }
)
