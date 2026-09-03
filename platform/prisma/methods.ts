/* eslint-disable @typescript-eslint/no-explicit-any */
import { assert } from '@/lib/debug'

import { Prisma } from '@prisma/client/extension'

type WithoutWhere<T> = Omit<T, 'where'>

type PrismaQueryMap = Record<string, Promise<any>>

export const PAGINATION_MAX_ITERATIONS = 1_000_000

export function withMethods() {
  return {
    client: {
      // @note we use Promise.all instead of prisma.$transaction here because
      // all current usages are read-only queries that don't require ACID
      // consistency. Using a transaction holds a single database connection
      // for all queries, which can lead to connection timeouts on high-volume
      // users. With Promise.all, each query uses its own connection.

      async $queryMap<T extends PrismaQueryMap>(queries: T) {
        const keys = Object.keys(queries) as Array<keyof T>
        const values = keys.map((key) => queries[key])

        const results = await Promise.all(values)

        // @note using awaited type to properly map promise results to their
        // resolved types

        return keys.reduce(
          (acc, key, index) => {
            acc[key] = results[index]

            return acc
          },
          {} as { [K in keyof T]: Awaited<T[K]> }
        )
      },
    },

    model: {
      user: {
        /**
         * Finds a unique user by ID, name, or alias.
         *
         * Unlike the $allModels version, User records are scoped by parentId
         * (not userId), so all alias lookups use the parentId_alias index and
         * all ID/name lookups filter by parentId instead of userId.
         *
         * @alias format:
         *   @alias   → child User of caller (parentId = user.id)
         *   @@alias  → sibling user (parentId = user.parentId)
         */
        async findUniqueByIdentifier<T, A>(
          this: T,
          user: { id: string; parentId?: string | null },
          identifier: string,
          args?: Prisma.Exact<A, WithoutWhere<Prisma.Args<T, 'findUnique'>>>
        ): Promise<Prisma.Result<T, A, 'findUnique'>> {
          assert(user.id, 'User ID is required')

          identifier = identifier?.trim()

          assert(identifier, 'Identifier is required')

          const context = Prisma.getExtensionContext(this)

          // query sibling user by alias

          if (identifier.startsWith('@@')) {
            const alias = identifier.slice(2).trim()

            if (!alias) {
              throw new Error('Alias is required')
            }

            assert(user.parentId, 'Parent ID is required for @@ identifier')

            return (context as any).findUnique({
              ...(args as object),

              where: {
                parentId_alias: {
                  parentId: user.parentId,
                  alias,
                },
              },
            })
          }

          // query child User by alias
          // @note compound @user@resource is intentionally unsupported on the
          // User model - users are not resources owned by other users in the
          // same sense, so resolving @sibling@user has no defined
          // meaning here. Use @@alias to reach siblings directly.

          if (identifier.startsWith('@')) {
            const rest = identifier.slice(1)

            if (rest.includes('@')) {
              throw new Error(
                'Compound @user@resource identifier is not supported on the User model'
              )
            }

            const alias = rest.trim()

            if (!alias) {
              throw new Error('Alias is required')
            }

            return (context as any).findUnique({
              ...(args as object),

              where: {
                parentId_alias: {
                  parentId: user.id,
                  alias,
                },
              },
            })
          }

          // query child User by name

          if (identifier.startsWith('(') && identifier.endsWith(')')) {
            const name = identifier.slice(1, -1).trim()

            if (!name) {
              throw new Error('Name is required')
            }

            return (context as any).findFirst({
              ...(args as object),

              where: {
                parentId: user.id,
                name,
              },
            })
          }

          // query child User by id

          return (context as any).findUnique({
            ...(args as object),

            where: {
              // @note cannot filter by parentId - the caller must ensure the resource belongs to the user
              // parentId: user.id,
              id: identifier,
            },
          })
        },
      },

      $allModels: {
        /**
         * Finds a unique record by ID, name, or alias for a given user.
         */
        async findUniqueByIdentifier<T, A>(
          this: T,
          user: { id: string; parentId?: string | null },
          identifier: string,
          args?: Prisma.Exact<A, WithoutWhere<Prisma.Args<T, 'findUnique'>>>
        ): Promise<Prisma.Result<T, A, 'findUnique'>> {
          const userId = user.id

          assert(userId, 'User ID is required')

          identifier = identifier?.trim()

          assert(identifier, 'Identifier is required')

          const context = Prisma.getExtensionContext(this)

          // query by parent alias

          if (identifier.startsWith('@@')) {
            const alias = identifier.slice(2).trim()

            if (!alias) {
              throw new Error('Alias is required')
            }

            assert(user.parentId, 'Parent ID is required for @@ identifier')

            return (context as any).findUnique({
              ...(args as object),

              where: {
                userId_alias: {
                  userId: user.parentId,
                  alias: alias,
                },
              },
            })
          }

          // query by compound alias (@user-alias@resource-alias)

          if (identifier.startsWith('@')) {
            const rest = identifier.slice(1)
            const secondAt = rest.indexOf('@')

            if (secondAt !== -1) {
              const userAlias = rest.slice(0, secondAt).trim()
              const resourceAlias = rest.slice(secondAt + 1).trim()

              assert(userAlias, 'User alias is required')
              assert(resourceAlias, 'Resource alias is required')

              assert(
                user.parentId,
                'Parent ID is required for @user@resource identifier'
              )

              const client = (context as any).$parent

              const resolvedUser = await client.user.findUnique({
                where: {
                  parentId_alias: {
                    parentId: user.parentId,
                    alias: userAlias,
                  },
                },
                select: { id: true },
              })

              assert(resolvedUser, `User with alias "${userAlias}" not found`)

              return (context as any).findUnique({
                ...(args as object),

                where: {
                  userId_alias: {
                    userId: resolvedUser.id,
                    alias: resourceAlias,
                  },
                },
              })
            }

            // query by alias

            const alias = rest.trim()

            if (!alias) {
              throw new Error('Alias is required')
            }

            return (context as any).findUnique({
              ...(args as object),

              where: {
                userId_alias: {
                  userId: user.id,
                  alias: alias,
                },
              },
            })
          }

          // query by name

          if (identifier.startsWith('(') && identifier.endsWith(')')) {
            const name = identifier.slice(1, -1).trim()

            if (!name) {
              throw new Error('Name is required')
            }

            return (context as any).findFirst({
              ...(args as object),

              where: {
                // @todo perhaps use specific index for this query

                userId,
                name,
              },
            })
          }

          // query by id

          return (context as any).findUnique({
            ...(args as object),

            where: {
              // @note cannot filter by userId - the caller must ensure the resource belongs to the user
              // userId: user.id,
              id: identifier,
            },
          })
        },

        /**
         * Finds a unique record by ID, name, or alias for a given user.
         */
        async findMyriad<T, A>(
          this: T,
          args?: Prisma.Exact<A, Prisma.Args<T, 'findMany'>>
        ): Promise<Prisma.Result<T, A, 'findMany'>> {
          const context = Prisma.getExtensionContext(this)

          // @todo use left join to perform these queries in a single request

          try {
            const recordIds = await (context as any).findMany({
              ...(args as object),

              select: {
                id: true,
              },
            })

            const recordItems = await (context as any).findMany({
              ...(args as object),

              where: {
                id: {
                  in: recordIds.map(({ id }) => id),
                },
              },

              orderBy: undefined,

              take: undefined,
            })

            return recordItems.sort((a, b) => {
              return (
                recordIds.findIndex(({ id }) => id === a.id) -
                recordIds.findIndex(({ id }) => id === b.id)
              )
            })
          } catch {
            // @note fallback to regular findMany if myriad approach fails
            // (e.g., corrupted data in orderBy fields)
            return await (context as any).findMany(args)
          }
        },

        /**
         * A generator to paginate through all records in a model.
         */
        async *paginate<T, A>(
          this: T,
          args?: Prisma.Exact<A, Prisma.Args<T, 'findMany'>>
        ): AsyncGenerator<Prisma.Result<T, A, 'findMany'>[number]> {
          const context = Prisma.getExtensionContext(this)

          const take: number = ((userTake) => {
            if (
              typeof userTake !== 'number' ||
              !Number.isFinite(userTake) ||
              userTake <= 0
            ) {
              return 100
            }

            return Math.min(Math.trunc(userTake), 1000)
          })((args as any)?.take)

          const orderBy: Record<string, 'asc' | 'desc'>[] = ((userOrderBy) => {
            const arr = Array.isArray(userOrderBy)
              ? userOrderBy.slice()
              : userOrderBy
                ? [userOrderBy]
                : []

            const idEntries = arr.filter(
              (o) =>
                o &&
                typeof o === 'object' &&
                Object.prototype.hasOwnProperty.call(o, 'id')
            )

            const nonIdEntries = arr.filter(
              (o) =>
                !(
                  o &&
                  typeof o === 'object' &&
                  Object.prototype.hasOwnProperty.call(o, 'id')
                )
            )

            if (idEntries.length > 0) {
              const lastId = idEntries[idEntries.length - 1]

              return [...nonIdEntries, lastId]
            }

            return [...nonIdEntries, { id: 'asc' }]
          })((args as any)?.orderBy)

          if ((args as any)?.select) {
            const select = (args as any).select

            if (select.id !== true) {
              throw new Error(
                'paginate requires id in select for cursor paging'
              )
            }
          }

          let iterations = 0

          // @note deleting previously yielded rows is safe; deleting the next cursor row may end iteration early
          // @note non-id leading orderBy fields that are not stable can cause skips or duplicates under concurrent updates
          // @note distinct combined with multi-field orderBy can interact poorly with skip:1 keyset pattern
          // @note only the last user-provided id ordering is kept (if multiple provided)
          // @todo consider supporting composite cursor (multi-field) for fully stable pagination with non-unique leading fields

          let cursor: any | undefined
          let lastCursor: any | undefined // @note used to detect duplicate cursor regression

          while (true) {
            if (iterations++ > PAGINATION_MAX_ITERATIONS) {
              // @note stopping due to safety iteration cap

              break
            }

            let items: any[]

            try {
              items = await (context as any).findMany({
                ...(args as object),

                ...(cursor
                  ? {
                      cursor: { id: cursor },

                      skip: 1,
                    }
                  : null),

                take,
                orderBy,
              })
            } catch (e: any) {
              // @note prisma may throw if the cursor row no longer exists

              if (e?.code === 'P2025' || /cursor/i.test(e?.message || '')) {
                break
              }

              throw e
            }

            if (items.length === 0) {
              break
            }

            yield* items

            if (items.length < take) {
              break
            }

            const last = items[items.length - 1]

            if (!last || last.id == null) {
              break
            }

            if (last.id === lastCursor) {
              // @note duplicate cursor detected; abort to avoid infinite loop

              break
            }

            lastCursor = cursor

            cursor = last.id
          }
        },
      },
    },
  }
}
