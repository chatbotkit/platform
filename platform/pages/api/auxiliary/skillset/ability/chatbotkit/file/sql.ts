import {
  introspectDatabase,
  lockDownDuckDB,
  runReadOnlyDuckDBQuery,
} from '@/lib/auxiliary.duckdb'
import { authenticatedHandler } from '@/lib/auxiliary.handler'
import { getSessionClient } from '@/lib/cbk.sdk'
import debug from '@/lib/debug'
import { ttlFileLocation } from '@/lib/fs.cache'
import { getContentTypeHeader } from '@/lib/header'
import {
  isCsvFile,
  isJsonFile,
  isJsonlFile,
  isXlsxFile,
  typeToExtension,
} from '@/lib/mime'

import { DuckDBInstance } from '@duckdb/node-api'

import { fileTypeFromBuffer } from 'file-type'
import { z } from 'zod'

export const schema = z.object({
  sql: z.string(),
  tables: z.record(
    z.object({
      fileId: z.string(),
    })
  ),
})

export type Schema = z.infer<typeof schema>

export default authenticatedHandler(
  schema,
  async function (session, parameters, headers) {
    debug(`chatbotkit/file/sql`, { parameters, headers }).log(
      'auxiliary.skillset.ability.chatbotkit.file.sql'
    )

    const { sql, tables } = parameters

    const instance = await DuckDBInstance.create(':memory:')

    const connection = await instance.connect()

    // @note without this installing additional extensions will fail
    {
      await connection.run(`SET extension_directory = '/tmp'`)
    }

    const client = await getSessionClient(session)

    const result = await Promise.allSettled(
      Object.entries(tables).map(async ([table, { fileId }]) => {
        const {
          location,
          meta: { type },
        } = await ttlFileLocation({
          namespace: '9569552c-c0fb-4b2e-8200-025e50bc7033',

          name: fileId,

          ttlInMinutes: 5,

          async loader() {
            debug(`downloading file`, { fileId }).log(
              'auxiliary.skillset.ability.chatbotkit.file.sql'
            )

            const result = await client.file.download(fileId)

            const buffer = result.data

            let contentType = getContentTypeHeader(
              result.headers,
              'application/octet-stream'
            )

            debug(`content type`, { contentType }).log(
              'auxiliary.skillset.ability.chatbotkit.file.sql'
            )

            if (!contentType) {
              const result = await fileTypeFromBuffer(buffer)

              debug(`identified type`, { result }).log(
                'auxiliary.skillset.ability.chatbotkit.file.sql'
              )

              if (result) {
                contentType = result.mime
              }
            }

            debug(`content type`, { contentType }).log(
              'auxiliary.skillset.ability.chatbotkit.file.sql'
            )

            if (/application\/octet-stream/i.test(contentType)) {
              const result = await fileTypeFromBuffer(buffer)

              debug(`identified type`, { result }).log(
                'auxiliary.skillset.ability.chatbotkit.file.sql'
              )

              if (result) {
                contentType = result.mime
              }
            }

            if (!contentType) {
              throw new Error(
                `No content type found in response headers: ${table} ${fileId}`
              )
            }

            return {
              buffer: buffer,

              meta: {
                name: fileId,
                ext: typeToExtension(contentType),
                type: contentType,
              },
            }
          },
        })

        switch (true) {
          // load csv

          case isCsvFile({ type }): {
            debug(`loading csv`, { table, fileId, type })

            await connection.run(
              `CREATE TABLE ${JSON.stringify(
                table
              )} AS SELECT * FROM read_csv('${location}', header = true, ignore_errors = true)` // @note tried prepared statement, but it doesn't work
            )

            break
          }

          // load xlsx

          case isXlsxFile({ type: type }): {
            debug(`loading xlsx`, { table, fileId, type })

            await connection.run(
              `CREATE TABLE ${JSON.stringify(
                table
              )} AS SELECT * FROM read_xlsx('${location}', header = true)` // @note tried prepared statement, but it doesn't work
            )

            break
          }

          // load json

          case isJsonFile({ type: type }): {
            debug(`loading json`, { table, fileId, type })

            await connection.run(
              `CREATE TABLE ${JSON.stringify(
                table
              )} AS SELECT * FROM read_json('${location}')` // @note tried prepared statement, but it doesn't work
            )

            break
          }

          // load jsonl

          case isJsonlFile({ type }): {
            debug(`loading jsonl`, { table, fileId, type })

            await connection.run(
              `CREATE TABLE ${JSON.stringify(
                table
              )} AS SELECT * FROM read_json('${location}')` // @note tried prepared statement, but it doesn't work
            )

            break
          }

          default: {
            throw new Error(
              `Unsupported content type: ${table} ${fileId} ${type}`
            )
          }
        }
      })
    )

    const errors = result.filter(
      (r) => r.status === 'rejected'
    ) as PromiseRejectedResult[]

    if (errors.length > 0) {
      const message = errors.map((r) => r.reason).join('\n')

      const result = {
        error: {
          message,
        },
      }

      debug(`result`, { result }).log(
        'auxiliary.skillset.ability.chatbotkit.file.sql.error'
      )

      return result
    }

    try {
      await lockDownDuckDB(connection)

      const reader = await runReadOnlyDuckDBQuery(connection, sql)

      const rows = reader.getRowObjectsJson()

      const result = {
        rows: rows,
      }

      debug(`result`, { result }).log(
        'auxiliary.skillset.ability.chatbotkit.file.sql.result'
      )

      return result
    } catch (error) {
      debug(`error`, { error })

      return {
        error: {
          message: `Failed to run SQL query: ${error}`,
        },
        tables: await introspectDatabase(connection, Object.keys(tables)),
      }
    }
  }
)
