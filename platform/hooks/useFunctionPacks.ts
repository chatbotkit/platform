import { useMemo, useState } from 'react'

interface FunctionPack {
  id: string
  description: string
  default?: boolean
  functions?: Record<string, FunctionDefinition>
}

interface FunctionDefinition {
  description: string
  parameters: Record<string, unknown>
  handler: (...args: unknown[]) => unknown
}

// @todo re-enable these interfaces when dynamic pack loading is supported
// interface PackSummary {
//   id: string
//   description: string
// }

// interface LoadFunctionPackParams {
//   id: string
// }

/**
 * Hook to manage function packs for the blueprint assistant.
 *
 * @todo Currently loads ALL packs upfront because the conversation engine
 * sends functions to the server at the START of each turn. Dynamic loading
 * mid-conversation doesn't work - the server won't know about newly loaded
 * functions until the next turn.
 *
 * The pack management functions (listAvailableFunctionPacks, listLoadedFunctionPacks,
 * loadFunctionPack) are disabled and commented out below. Re-enable them when
 * the architecture supports dynamic function registration.
 */
export default function useFunctionPacks(
  packs: FunctionPack[]
): Record<string, FunctionDefinition> {
  // @todo currently we load ALL packs because dynamic loading mid-conversation
  // doesn't work - functions are sent to server at request start. Change this
  // to `packs.filter((pack) => pack.default)` once the architecture supports
  // dynamic function registration during a conversation turn.
  const [loadedFunctionPacks] = useState<FunctionPack[]>(packs)

  // @todo re-enable refs when dynamic pack loading is supported
  // const loadedFunctionPacksRef = useRef(loadedFunctionPacks)
  // loadedFunctionPacksRef.current = loadedFunctionPacks
  // const packsRef = useRef(packs)
  // packsRef.current = packs

  // @todo re-enable pack management functions when the architecture supports
  // dynamic function registration during a conversation turn
  //
  // const standardFunctions = useMemo(() => {
  //   return {
  //     listAvailableFunctionPacks: {
  //       description:
  //         'List all available function packs that can be loaded.',
  //       parameters: {},
  //       handler: (): PackSummary[] => {
  //         return packsRef.current.map((pack) => ({
  //           id: pack.id,
  //           description: pack.description,
  //         }))
  //       },
  //     },
  //
  //     listLoadedFunctionPacks: {
  //       description:
  //         'List all currently loaded function packs.',
  //       parameters: {},
  //       handler: (): PackSummary[] => {
  //         return loadedFunctionPacksRef.current.map((pack) => ({
  //           id: pack.id,
  //           description: pack.description,
  //         }))
  //       },
  //     },
  //
  //     loadFunctionPack: {
  //       description:
  //         'Load a function pack by its ID to make its functions available.',
  //       parameters: {
  //         type: 'object',
  //         properties: {
  //           id: {
  //             type: 'string',
  //             description: 'The ID of the function pack to load.',
  //           },
  //         },
  //       },
  //       handler: async ({
  //         id,
  //       }: LoadFunctionPackParams): Promise<{
  //         id: string
  //         description: string
  //         functions: { name: string; description: string }[]
  //       } | null> => {
  //         const pack = packsRef.current.find((p) => p.id === id)
  //
  //         if (pack) {
  //           setLoadedFunctionPacks((prev) => [
  //             ...prev.filter((p) => p.id !== id),
  //             pack,
  //           ])
  //
  //           return {
  //             id: pack.id,
  //             description: pack.description,
  //             functions: Object.entries(pack.functions || {}).map(
  //               ([name, fn]) => ({
  //                 name,
  //                 description: fn.description,
  //               })
  //             ),
  //           }
  //         }
  //
  //         return null
  //       },
  //     },
  //   }
  // }, [])

  return useMemo(() => {
    return {
      ...Object.fromEntries(
        loadedFunctionPacks.flatMap((pack) => {
          return Object.entries(pack.functions || {})
        })
      ),
    }
  }, [loadedFunctionPacks])
}
