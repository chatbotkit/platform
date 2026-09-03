import { captureError } from '@/lib/error'
import {
  raceTasks,
  runAbortableTask,
  runTasks,
  runTasksBatch,
  runTasksEach,
  runTasksIt,
  runTasksMap,
} from '@/lib/job'

jest.mock('@/lib/error', () => ({
  captureError: jest.fn(),
}))

describe('runAbortableTask', () => {
  it('should run the task with an AbortSignal', async () => {
    const task = runAbortableTask(async (abortSignal) => {
      expect(abortSignal).toBeInstanceOf(AbortSignal)
      expect(abortSignal.aborted).toBe(false)

      return 'done'
    })

    await expect(task.promise).resolves.toBe('done')
    expect(task.signal).toBeInstanceOf(AbortSignal)
    expect(task.signal.aborted).toBe(false)
  })

  it('should abort the task signal when aborted', async () => {
    const task = runAbortableTask(async (abortSignal) => {
      await new Promise((resolve) => {
        abortSignal.addEventListener('abort', resolve, { once: true })
      })

      return abortSignal.aborted
    })

    expect(task.signal.aborted).toBe(false)

    task.abort()

    expect(task.signal.aborted).toBe(true)
    await expect(task.promise).resolves.toBe(true)
  })

  it('should keep abort idempotent', async () => {
    const task = runAbortableTask(async (abortSignal) => {
      return abortSignal
    })

    task.abort()
    task.abort()

    await expect(task.promise).resolves.toBe(task.signal)
    expect(task.signal.aborted).toBe(true)
  })

  it('should capture synchronous task errors in the returned promise', async () => {
    const task = runAbortableTask(() => {
      throw new Error('sync failure')
    })

    await expect(task.promise).rejects.toThrow('sync failure')
  })
})

describe('raceTasks', () => {
  it('should race tasks and return the fastest result', async () => {
    jest.useFakeTimers()

    try {
      const result = raceTasks([
        async () => {
          return new Promise((resolve) => {
            setTimeout(() => resolve('slow-task'), 200)
          })
        },
        async () => {
          return new Promise((resolve) => {
            setTimeout(() => resolve('fast-task'), 50)
          })
        },
        async () => {
          return new Promise((resolve) => {
            setTimeout(() => resolve('medium-task'), 100)
          })
        },
      ])

      // Advance just past the fastest timer so its ordering is deterministic
      // rather than dependent on wall-clock scheduling under load.
      await jest.advanceTimersByTimeAsync(50)

      await expect(result).resolves.toBe('fast-task')
    } finally {
      jest.useRealTimers()
    }
  })

  it('should handle promise tasks (not functions)', async () => {
    jest.useFakeTimers()

    try {
      const promise1 = new Promise((resolve) => {
        setTimeout(() => resolve('promise1'), 100)
      })

      const promise2 = new Promise((resolve) => {
        setTimeout(() => resolve('promise2'), 50)
      })

      const result = raceTasks([promise1, promise2])

      await jest.advanceTimersByTimeAsync(50)

      await expect(result).resolves.toBe('promise2')
    } finally {
      jest.useRealTimers()
    }
  })

  it('should handle mixed promise and function tasks', async () => {
    jest.useFakeTimers()

    try {
      const promise = new Promise((resolve) => {
        setTimeout(() => resolve('promise-result'), 100)
      })

      const func = async () => {
        return new Promise((resolve) => {
          setTimeout(() => resolve('function-result'), 50)
        })
      }

      const result = raceTasks([promise, func])

      await jest.advanceTimersByTimeAsync(50)

      await expect(result).resolves.toBe('function-result')
    } finally {
      jest.useRealTimers()
    }
  })

  it('should handle empty tasks array', async () => {
    const result = await raceTasks([])

    expect(result).toBeUndefined()
  })

  it('should propagate errors from the fastest task', async () => {
    jest.useFakeTimers()

    try {
      const result = raceTasks([
        async () => {
          return new Promise((_, reject) => {
            setTimeout(() => reject(new Error('fast-error')), 50)
          })
        },
        async () => {
          return new Promise((resolve) => {
            setTimeout(() => resolve('slow-success'), 200)
          })
        },
      ])

      // Attach the rejection expectation before advancing timers so the
      // rejection is always handled (no unhandled-rejection warning).
      const assertion = expect(result).rejects.toThrow('fast-error')

      await jest.advanceTimersByTimeAsync(50)

      await assertion
    } finally {
      jest.useRealTimers()
    }
  })
})

describe('runTasks', () => {
  it('should run tasks in parallel', async () => {
    const results = await runTasks([
      async () => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve('result-task1')
          }, 100)
        })
      },
      async () => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve('result-task2')
          }, 100)
        })
      },
      async () => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve('result-task3')
          }, 100)
        })
      },
    ])

    expect(results).toEqual(true)
  })

  it('should handle empty tasks', async () => {
    const results = await runTasks([])

    expect(results).toEqual(true)
  })

  it('should handle promise tasks (not functions)', async () => {
    const promise1 = Promise.resolve('result1')
    const promise2 = Promise.resolve('result2')

    const result = await runTasks([promise1, promise2])

    expect(result).toBe(true)
  })

  it('should handle mixed promise and function tasks', async () => {
    const promise = Promise.resolve('promise-result')
    const func = async () => 'function-result'

    const result = await runTasks([promise, func])

    expect(result).toBe(true)
  })

  it('should return false when any task fails', async () => {
    const results = await runTasks([
      async () => {
        return new Promise((resolve) => {
          setTimeout(() => resolve('success'), 50)
        })
      },
      async () => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('task failed')), 100)
        })
      },
      async () => {
        return new Promise((resolve) => {
          setTimeout(() => resolve('another success'), 150)
        })
      },
    ])

    expect(captureError).toHaveBeenCalled()
    expect(results).toBe(false)
  })

  it('should capture all errors and continue running other tasks', async () => {
    const results = await runTasks([
      async () => {
        throw new Error('error 1')
      },
      async () => {
        throw new Error('error 2')
      },
      async () => {
        return 'success'
      },
    ])

    expect(captureError).toHaveBeenCalledTimes(2)
    expect(results).toBe(false)
  })
})

describe('runTasksIt', () => {
  it('should run iterables with specified number of workers', async () => {
    const items = [1, 2, 3, 4, 5]
    const results = []

    const success = await runTasksIt(2, items, async (it) => {
      for await (const item of it) {
        results.push(item * 2)
      }
    })

    expect(success).toBe(true)
    expect(results.sort()).toEqual([2, 4, 6, 8, 10].sort())
  })

  it('should handle async iterables', async () => {
    async function* asyncIterable() {
      for (let i = 1; i <= 3; i++) {
        yield i
      }
    }

    const results = []

    const success = await runTasksIt(1, asyncIterable(), async (it) => {
      for await (const item of it) {
        results.push(item)
      }
    })

    expect(success).toBe(true)
    expect(results).toEqual([1, 2, 3])
  })

  it('should handle empty iterables', async () => {
    const results = []

    const success = await runTasksIt(2, [], async (it) => {
      for await (const item of it) {
        results.push(item)
      }
    })

    expect(success).toBe(true)
    expect(results).toEqual([])
  })

  it('should return false when handler throws error', async () => {
    const items = [1, 2, 3]

    const success = await runTasksIt(2, items, async (it) => {
      for await (const item of it) {
        if (item === 2) {
          throw new Error('Handler error')
        }
      }
    })

    expect(success).toBe(false)
  })

  it('should work with single worker', async () => {
    const items = [1, 2, 3]
    const results = []

    const success = await runTasksIt(1, items, async (it) => {
      for await (const item of it) {
        results.push(item)
      }
    })

    expect(success).toBe(true)
    expect(results).toEqual([1, 2, 3])
  })

  test('should handle iterator sharing between workers correctly', async () => {
    const items = Array.from({ length: 100 }, (_, i) => i + 1)
    const processedItems = []

    const success = await runTasksIt(3, items, async (it) => {
      for await (const item of it) {
        processedItems.push(item)
      }
    })

    expect(success).toBe(true)

    const sortedProcessed = processedItems.sort((a, b) => a - b)
    const uniqueProcessed = [...new Set(processedItems)]

    expect(uniqueProcessed.length).toBe(processedItems.length) // No duplicates
    expect(sortedProcessed).toEqual(items) // All items processed
  })

  it('should handle zero workers gracefully', async () => {
    const items = [1, 2, 3]
    const results = []

    const success = await runTasksIt(0, items, async (it) => {
      for await (const item of it) {
        results.push(item)
      }
    })

    expect(success).toBe(true)
    expect(results).toEqual([1, 2, 3])
  })

  test('should handle negative worker count gracefully', async () => {
    const items = [1, 2, 3]
    const results = []

    const success = await runTasksIt(-1, items, async (it) => {
      for await (const item of it) {
        results.push(item)
      }
    })

    expect(success).toBe(true)
    expect(results).toEqual([1, 2, 3])
  })
})

describe('runTasksEach', () => {
  it('should process each item with specified number of workers', async () => {
    const items = [1, 2, 3, 4, 5]
    const results = []

    const success = await runTasksEach(2, items, async (item) => {
      results.push(item * 2)
    })

    expect(success).toBe(true)
    expect(results.sort()).toEqual([2, 4, 6, 8, 10].sort())
  })

  it('should handle async iterables', async () => {
    async function* asyncIterable() {
      for (let i = 1; i <= 3; i++) {
        yield i
      }
    }

    const results = []

    const success = await runTasksEach(2, asyncIterable(), async (item) => {
      results.push(item)
    })

    expect(success).toBe(true)
    expect(results.sort()).toEqual([1, 2, 3])
  })

  it('should handle empty collections', async () => {
    const results = []

    const success = await runTasksEach(2, [], async (item) => {
      results.push(item)
    })

    expect(success).toBe(true)
    expect(results).toEqual([])
  })

  it('should return false when handler throws error', async () => {
    const items = [1, 2, 3]
    const results = []

    const success = await runTasksEach(2, items, async (item) => {
      if (item === 2) {
        throw new Error('Handler error')
      }

      results.push(item)
    })

    expect(success).toBe(false)
  })

  it('should work with single worker', async () => {
    const items = [1, 2, 3]
    const results = []

    const success = await runTasksEach(1, items, async (item) => {
      results.push(item)
    })

    expect(success).toBe(true)
    expect(results).toEqual([1, 2, 3])
  })

  test('should handle large datasets efficiently', async () => {
    const items = Array.from({ length: 100 }, (_, i) => i + 1)
    const results = []

    const success = await runTasksEach(5, items, async (item) => {
      results.push(item)
    })

    expect(success).toBe(true)
    expect(results.length).toBe(100)
    expect(results.sort((a, b) => a - b)).toEqual(items)
  })
})

describe('runTasksBatch', () => {
  it('should process items in batches with specified size', async () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const batches = []

    const success = await runTasksBatch(
      2,
      items,
      async (batch) => {
        batches.push([...batch])
      },
      3
    )

    expect(success).toBe(true)
    expect(batches.length).toBeGreaterThan(0)

    const allProcessedItems = batches.flat().sort((a, b) => a - b)

    expect(allProcessedItems).toEqual(items)
  })

  it('should use default batch size when not specified', async () => {
    const items = Array.from({ length: 50 }, (_, i) => i + 1)
    const batches = []

    const success = await runTasksBatch(1, items, async (batch) => {
      batches.push(batch.length)
    })

    expect(success).toBe(true)
    expect(batches.length).toBeGreaterThan(0)
  })

  it('should handle async iterables', async () => {
    async function* asyncIterable() {
      for (let i = 1; i <= 5; i++) {
        yield i
      }
    }

    const batches = []

    const success = await runTasksBatch(
      1,
      asyncIterable(),
      async (batch) => {
        batches.push([...batch])
      },
      2
    )

    expect(success).toBe(true)
    expect(batches.length).toBeGreaterThan(0)

    const allProcessedItems = batches.flat().sort((a, b) => a - b)

    expect(allProcessedItems).toEqual([1, 2, 3, 4, 5])
  })

  it('should handle empty collections', async () => {
    const batches = []

    const success = await runTasksBatch(2, [], async (batch) => {
      batches.push(batch)
    })

    expect(success).toBe(true)
    expect(batches).toEqual([])
  })

  it('should return false when handler throws error', async () => {
    const items = [1, 2, 3, 4, 5, 6]

    const success = await runTasksBatch(
      1,
      items,
      async (batch) => {
        if (batch.includes(3)) {
          throw new Error('Batch processing error')
        }
      },
      2
    )

    expect(success).toBe(false)
  })

  it('should handle small batch sizes', async () => {
    const items = [1, 2, 3]
    const batches = []

    const success = await runTasksBatch(
      1,
      items,
      async (batch) => {
        batches.push([...batch])
      },
      1
    )

    expect(success).toBe(true)
    expect(batches).toEqual([[1], [2], [3]])
  })

  it('should handle batch size larger than collection', async () => {
    const items = [1, 2, 3]
    const batches = []

    const success = await runTasksBatch(
      1,
      items,
      async (batch) => {
        batches.push([...batch])
      },
      10
    )

    expect(success).toBe(true)
    expect(batches).toEqual([[1, 2, 3]])
  })
})

describe('runTasksMap', () => {
  it('should run tasks in parallel and return results', async () => {
    const results = await runTasksMap(
      10,
      ['task1', 'task2', 'task3'],
      async (task) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(`result-${task}`)
          }, 100)
        })
      }
    )

    expect(results).toEqual(['result-task1', 'result-task2', 'result-task3'])
  })

  it('should maintain order of results even with different completion times', async () => {
    const results = await runTasksMap(
      3,
      ['slow', 'fast', 'medium'],
      async (task) => {
        const delays = { slow: 150, fast: 50, medium: 100 }

        return new Promise((resolve) => {
          setTimeout(() => resolve(`result-${task}`), delays[task])
        })
      }
    )

    expect(results).toEqual(['result-slow', 'result-fast', 'result-medium'])
  })

  it('should handle async iterables', async () => {
    async function* asyncIterable() {
      for (let i = 1; i <= 3; i++) {
        yield i
      }
    }

    const results = await runTasksMap(2, asyncIterable(), async (item) => {
      return item * 2
    })

    expect(results).toEqual([2, 4, 6])
  })

  it('should handle empty collections', async () => {
    const results = await runTasksMap(2, [], async (item) => {
      return item * 2
    })

    expect(results).toEqual([])
  })

  it('should handle single worker', async () => {
    const results = await runTasksMap(1, [1, 2, 3], async (item) => {
      return item * 2
    })

    expect(results).toEqual([2, 4, 6])
  })

  test('should handle large datasets with limited workers', async () => {
    const items = Array.from({ length: 100 }, (_, i) => i + 1)

    const results = await runTasksMap(5, items, async (item) => {
      return item * 2
    })

    expect(results.length).toBe(100)
    expect(results[0]).toBe(2)
    expect(results[99]).toBe(200)
  })

  it('should handle mapper function errors gracefully', async () => {
    const result = await runTasksMap(2, [1, 2, 3], async (item) => {
      if (item === 2) {
        throw new Error('Mapper error')
      }

      return item * 2
    })

    expect(result).toEqual([2, undefined, 6])
  })

  it('should handle complex data transformations', async () => {
    const users = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' },
    ]

    const results = await runTasksMap(2, users, async (user) => {
      // Simulate async operation like API call
      return new Promise((resolve) => {
        setTimeout(
          () =>
            resolve({
              ...user,
              email: `${user.name.toLowerCase()}@example.com`,
            }),
          50
        )
      })
    })

    expect(results).toEqual([
      { id: 1, name: 'Alice', email: 'alice@example.com' },
      { id: 2, name: 'Bob', email: 'bob@example.com' },
      { id: 3, name: 'Charlie', email: 'charlie@example.com' },
    ])
  })

  it('should handle zero workers', async () => {
    const results = await runTasksMap(0, [1, 2, 3], async (item) => {
      return item * 2
    })

    expect(results).toEqual([2, 4, 6])
  })

  it('should handle negative worker count', async () => {
    const results = await runTasksMap(-1, [1, 2, 3], async (item) => {
      return item * 2
    })

    expect(results).toEqual([2, 4, 6])
  })
})

describe('Edge Cases and Error Handling', () => {
  describe('raceTasks edge cases', () => {
    it('should handle null and undefined tasks', async () => {
      await expect(raceTasks([null])).resolves.toEqual(null)
    })

    it('should handle mixed valid and invalid tasks', async () => {
      const result = await raceTasks([() => Promise.resolve('success'), null])

      expect(result).toBe('success')
    })
  })

  describe('runTasks error capture integration', () => {
    it('should capture multiple different error types', async () => {
      const result = await runTasks([
        () => Promise.reject(new Error('Standard error')),
        () => Promise.reject(new TypeError('Type error')),
        () => Promise.reject('String error'),
        () => Promise.resolve('success'),
      ])

      expect(result).toBe(false)
    })

    it('should handle synchronous errors in task functions', async () => {
      const result = await runTasks([
        () => {
          throw new Error('Sync error')
        },
        () => Promise.resolve('success'),
      ])

      expect(result).toBe(false)
    })
  })

  describe('runTasksEach edge cases', () => {
    it('should handle iterator that throws during iteration', async () => {
      function* errorIterator() {
        yield 1
        yield 2

        throw new Error('Iterator error')
      }

      const result = await runTasksEach(2, errorIterator(), async (item) => {
        return item
      })

      expect(result).toBe(false)
    })

    test('should handle very large worker counts', async () => {
      const items = [1, 2, 3]
      const results = []

      const success = await runTasksEach(1000, items, async (item) => {
        results.push(item)
      })

      expect(success).toBe(true)
      expect(results.sort()).toEqual([1, 2, 3])
    })
  })

  describe('runTasksBatch edge cases', () => {
    it('should handle zero batch size', async () => {
      const items = [1, 2, 3]
      const batches = []

      const success = await runTasksBatch(
        1,
        items,
        async (batch) => {
          batches.push(batch.length)
        },
        0
      )

      expect(success).toBe(true)
      expect(batches.length).toBeGreaterThan(0)
    })

    it('should handle negative batch size', async () => {
      const items = [1, 2, 3]
      const batches = []

      const success = await runTasksBatch(
        1,
        items,
        async (batch) => {
          batches.push(batch.length)
        },
        -5
      )

      expect(success).toBe(true)
      expect(batches.length).toBeGreaterThan(0)
    })
  })

  describe('Timeout and performance tests', () => {
    it('should handle tasks that complete at different times', async () => {
      const startTime = Date.now()

      const result = await runTasks([
        () => new Promise((resolve) => setTimeout(() => resolve('fast'), 10)),
        () => new Promise((resolve) => setTimeout(() => resolve('medium'), 50)),
        () => new Promise((resolve) => setTimeout(() => resolve('slow'), 100)),
      ])

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(result).toBe(true)
      expect(duration).toBeGreaterThan(90)
      expect(duration).toBeLessThan(200)
    })

    test('should handle concurrent access to shared resources', async () => {
      let counter = 0
      const results = []

      const success = await runTasksEach(5, Array(20).fill(0), async () => {
        const currentValue = counter

        await new Promise((resolve) => setTimeout(resolve, Math.random() * 10))

        counter = currentValue + 1

        results.push(counter)
      })

      expect(success).toBe(true)
      expect(results.length).toBe(20)
    })
  })
})
