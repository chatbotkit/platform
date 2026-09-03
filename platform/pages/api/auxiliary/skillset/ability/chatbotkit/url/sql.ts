import {
  introspectDatabase,
  lockDownDuckDB,
  runReadOnlyDuckDBQuery,
} from '@/lib/auxiliary.duckdb'
import { authenticatedHandler } from '@/lib/auxiliary.handler'
import debug from '@/lib/debug'
import fetch from '@/lib/egress.fetch'
import { getFetchError } from '@/lib/fetch'
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

const schema = z.object({
  sql: z.string(),
  tables: z.record(
    z.object({
      url: z.string(),
    })
  ),
})

export type Schema = z.infer<typeof schema>

export default authenticatedHandler(
  schema,
  async function (_session, parameters, headers) {
    debug(`chatbotkit/url/sql`, { parameters, headers }).log(
      'auxiliary.skillset.ability.chatbotkit.url.sql'
    )

    const { sql, tables } = parameters

    const instance = await DuckDBInstance.create(':memory:')

    const connection = await instance.connect()

    // @note without this installing additional extensions will fail
    {
      await connection.run(`SET extension_directory = '/tmp'`)
    }

    const result = await Promise.allSettled(
      Object.entries(tables).map(async ([table, { url }]) => {
        const {
          location,
          meta: { type },
        } = await ttlFileLocation({
          namespace: '8435aa53-7677-4480-9a4c-001d036ca791',

          name: url,

          ttlInMinutes: 5,

          async loader() {
            debug(`downloading file`, { url }).log(
              'auxiliary.skillset.ability.chatbotkit.url.sql'
            )

            const result = await fetch(url)

            if (!result.ok) {
              throw await getFetchError(result, { table, url })
            }

            const buffer = await result.arrayBuffer()

            let contentType = getContentTypeHeader(
              result,
              'application/octet-stream'
            )

            debug(`content type`, { contentType }).log(
              'auxiliary.skillset.ability.chatbotkit.url.sql'
            )

            if (!contentType) {
              const result = await fileTypeFromBuffer(buffer)

              debug(`identified type`, { result }).log(
                'auxiliary.skillset.ability.chatbotkit.url.sql'
              )

              if (result) {
                contentType = result.mime
              }
            }

            debug(`content type`, { contentType }).log(
              'auxiliary.skillset.ability.chatbotkit.url.sql'
            )

            if (/application\/octet-stream/i.test(contentType)) {
              const result = await fileTypeFromBuffer(buffer)

              debug(`identified type`, { result }).log(
                'auxiliary.skillset.ability.chatbotkit.url.sql'
              )

              if (result) {
                contentType = result.mime
              }
            }

            if (!contentType) {
              throw new Error(
                `No content type found in response headers: ${table} ${url}`
              )
            }

            return {
              buffer: buffer,

              meta: {
                name: url,
                ext: typeToExtension(contentType),
                type: contentType,
              },
            }
          },
        })

        switch (true) {
          // load csv

          case isCsvFile({ type }): {
            debug(`loading csv`, { table, url, type })

            await connection.run(
              `CREATE TABLE ${JSON.stringify(
                table
              )} AS SELECT * FROM read_csv('${location}', header = true, ignore_errors = true)` // @note tried prepared statement, but it doesn't work
            )

            break
          }

          // load xlsx

          case isXlsxFile({ type }): {
            debug(`loading xlsx`, { table, url, type })

            await connection.run(
              `CREATE TABLE ${JSON.stringify(
                table
              )} AS SELECT * FROM read_xlsx('${location}', header = true)` // @note tried prepared statement, but it doesn't work
            )

            break
          }

          // load json

          case isJsonFile({ type }): {
            debug(`loading json`, { table, url, type })

            await connection.run(
              `CREATE TABLE ${JSON.stringify(
                table
              )} AS SELECT * FROM read_json('${location}')` // @note tried prepared statement, but it doesn't work
            )

            break
          }

          // load jsonl

          case isJsonlFile({ type }): {
            debug(`loading jsonl`, { table, url, type })

            await connection.run(
              `CREATE TABLE ${JSON.stringify(
                table
              )} AS SELECT * FROM read_json('${location}')` // @note tried prepared statement, but it doesn't work
            )

            break
          }

          default: {
            throw new Error(`Unsupported content type: ${table} ${url} ${type}`)
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
        'auxiliary.skillset.ability.chatbotkit.url.sql.error'
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
        'auxiliary.skillset.ability.chatbotkit.url.sql.result'
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
