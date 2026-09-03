/**
 * Represents a dependency graph where keys are node names and values are arrays of their dependencies
 */
type DependencyGraph = Record<string, string[]>

export class CyclicDependencyError extends Error {
  cycle: string[]
  details: { issues: { error: string; cycle: string[] }[] }

  constructor(cycle: string[]) {
    super(`Cyclic dependency detected: ${cycle.join(' -> ')}`)

    this.name = 'CyclicDependencyError'
    this.cycle = cycle
    this.details = {
      issues: [
        {
          error: 'cyclic_dependency',
          cycle,
        },
      ],
    }
  }
}

/**
 * Performs a topological sort on a dependency graph using depth-first search.
 * Returns nodes in an order where all dependencies appear before the nodes that depend on them.
 */
export function topologicalSort(dependencies: DependencyGraph): string[] {
  const visited = new Set<string>()
  const stack: string[] = []

  function visit(node: string): void {
    if (!visited.has(node)) {
      visited.add(node)

      for (const dep of dependencies[node] || []) {
        visit(dep)
      }

      stack.push(node)
    }
  }

  Object.keys(dependencies).forEach(visit)

  return stack
}

/**
 * Performs a topological sort on a dependency graph and throws when the graph
 * contains a cycle.
 */
export function topologicalSortWithCycleDetection(
  dependencies: DependencyGraph
): string[] {
  const temp = new Set<string>()

  const perm = new Set<string>()

  const output: string[] = []

  const stack: string[] = []

  function visit(node: string): void {
    if (perm.has(node)) {
      return
    }

    if (temp.has(node)) {
      const cycleStartIndex = stack.indexOf(node)

      const cyclePath =
        cycleStartIndex >= 0
          ? [...stack.slice(cycleStartIndex), node]
          : [node, node]

      throw new CyclicDependencyError(cyclePath)
    }

    temp.add(node)
    stack.push(node)

    for (const dep of dependencies[node] || []) {
      visit(dep)
    }

    stack.pop()

    temp.delete(node)

    perm.add(node)

    output.push(node)
  }

  Object.keys(dependencies).forEach(visit)

  return output
}
