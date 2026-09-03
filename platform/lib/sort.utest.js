import {
  CyclicDependencyError,
  topologicalSort,
  topologicalSortWithCycleDetection,
} from '@/lib/sort'

describe('topologicalSort', () => {
  test('should return an empty array for an empty dependency map', () => {
    const dependencies = {}

    const result = topologicalSort(dependencies)

    expect(result).toEqual([])
  })

  test('should handle nodes with no dependencies', () => {
    const dependencies = {
      A: [],
      B: [],
      C: [],
    }

    const result = topologicalSort(dependencies)

    expect(result).toEqual(expect.arrayContaining(['A', 'B', 'C']))

    expect(result.length).toBe(3)
  })

  test('should handle a simple dependency chain', () => {
    const dependencies = {
      A: [],
      B: ['A'],
      C: ['B'],
    }

    const result = topologicalSort(dependencies)

    expect(result).toEqual(['A', 'B', 'C'])
  })

  test('should include dependencies that are not top-level keys', () => {
    const dependencies = {
      B: ['A'],
    }

    const result = topologicalSort(dependencies)

    expect(result).toEqual(['A', 'B'])
  })

  test('should handle branches in dependency graph', () => {
    const dependencies = {
      A: [],
      B: ['A'],
      C: ['A'],
      D: ['B', 'C'],
    }

    const result = topologicalSort(dependencies)

    expect(result).toEqual(['A', 'B', 'C', 'D'])
  })

  test('should handle nodes with multiple dependencies', () => {
    const dependencies = {
      A: [],
      B: ['A'],
      C: ['A'],
      D: ['B', 'C'],
      E: ['D'],
    }

    const result = topologicalSort(dependencies)

    expect(result).toEqual(['A', 'B', 'C', 'D', 'E'])
  })

  test('should handle complex dependency graph', () => {
    const dependencies = {
      A: [],
      B: ['A'],
      C: ['A'],
      D: ['B'],
      E: ['C', 'D'],
      F: ['E'],
    }

    const result = topologicalSort(dependencies)

    expect(result).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
  })

  test('should return a stable best-effort order when cycles exist', () => {
    const dependencies = {
      A: ['B'],
      B: ['C'],
      C: ['A'],
    }

    expect(topologicalSort(dependencies)).toEqual(['C', 'B', 'A'])
  })
})

describe('topologicalSortWithCycleDetection', () => {
  test('should handle a simple dependency chain', () => {
    const dependencies = {
      A: [],
      B: ['A'],
      C: ['B'],
    }

    const result = topologicalSortWithCycleDetection(dependencies)

    expect(result).toEqual(['A', 'B', 'C'])
  })

  test('should include dependencies that are not top-level keys', () => {
    const dependencies = {
      B: ['A'],
    }

    const result = topologicalSortWithCycleDetection(dependencies)

    expect(result).toEqual(['A', 'B'])
  })

  test('should handle shared dependencies', () => {
    const dependencies = {
      A: [],
      B: ['A'],
      C: ['A'],
      D: ['B', 'C'],
    }

    const result = topologicalSortWithCycleDetection(dependencies)

    expect(result).toEqual(['A', 'B', 'C', 'D'])
  })

  test('should throw a structured error when cycles exist', () => {
    const dependencies = {
      A: ['B'],
      B: ['C'],
      C: ['A'],
    }

    expect(() => topologicalSortWithCycleDetection(dependencies)).toThrow(
      CyclicDependencyError
    )

    try {
      topologicalSortWithCycleDetection(dependencies)
    } catch (error) {
      expect(error).toEqual(
        expect.objectContaining({
          cycle: ['A', 'B', 'C', 'A'],
          details: {
            issues: [
              {
                error: 'cyclic_dependency',
                cycle: ['A', 'B', 'C', 'A'],
              },
            ],
          },
        })
      )
    }
  })

  test('should throw a structured error for self cycles', () => {
    const dependencies = {
      A: ['A'],
    }

    expect(() => topologicalSortWithCycleDetection(dependencies)).toThrow(
      'Cyclic dependency detected: A -> A'
    )
  })
})
