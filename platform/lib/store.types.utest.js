// @ts-check
import { MemoryStore } from '@/lib/store.memory'
import { getStore } from '@/lib/store.types'
import { VectorServiceStore } from '@/lib/store.vector'
import { getRandomId } from '@/lib/string'

jest.retryTimes(3)

const { hasLanguageModelsByProvider } = jest.requireActual('@/lib/model.utils')

const describeIfConfigured = hasLanguageModelsByProvider('openai')
  ? describe
  : describe.skip

describe('getStore', () => {
  it('must get the vector store', async () => {
    expect(await getStore()).toBeInstanceOf(VectorServiceStore)
  })
})

describeIfConfigured('MemoryStore', () => {
  it('must be able to create and delete memory records', async () => {
    const ms = new MemoryStore()

    const datasetId = getRandomId('test-')
    const recordId1 = getRandomId('test-')

    await ms.createDataset({ datasetId })

    await ms.createRecord({
      datasetId,
      recordId: recordId1,
      text: 'test record 1',
    })

    expect(
      (await ms.accessRecord({ datasetId, recordId: recordId1 })).text
    ).toEqual('test record 1')

    await ms.deleteRecord({ datasetId, recordId: recordId1 })

    await expect(
      ms.accessRecord({ datasetId, recordId: recordId1 })
    ).rejects.toThrow()

    await ms.deleteDataset({ datasetId })
  })

  it('must be able to search memory records', async () => {
    const ms = new MemoryStore()

    const datasetId = getRandomId('test-')

    await ms.createDataset({ datasetId })

    await ms.createRecord({
      datasetId,
      recordId: getRandomId('test-'),
      text: 'test record 1: avocado',
    })
    await ms.createRecord({
      datasetId,
      recordId: getRandomId('test-'),
      text: 'test record 2: mango',
    })
    await ms.createRecord({
      datasetId,
      recordId: getRandomId('test-'),
      text: 'test record 3: kiwi',
    })

    expect((await ms.searchRecords({ datasetId, search: 'mango' }))[0]).toEqual(
      expect.objectContaining({
        text: 'test record 2: mango',
      })
    )

    await ms.deleteDataset({ datasetId })
  })

  it('must be able to search memory records with filter', async () => {
    const ms = new MemoryStore()

    const datasetId = getRandomId('test-')

    await ms.createDataset({ datasetId })

    await ms.createRecord({
      datasetId,
      recordId: getRandomId('test-'),
      text: 'test record 1: avocado',
      meta: { fruit: 'avocado' },
    })
    await ms.createRecord({
      datasetId,
      recordId: getRandomId('test-'),
      text: 'test record 2: mango',
      meta: { fruit: 'mango' },
    })
    await ms.createRecord({
      datasetId,
      recordId: getRandomId('test-'),
      text: 'test record 3: kiwi',
      meta: { fruit: 'kiwi' },
    })

    expect(
      (
        await ms.searchRecords({
          datasetId,
          search: 'mango',
          filter: { fruit: { $eq: 'mango' } },
        })
      )[0]
    ).toEqual(
      expect.objectContaining({
        text: 'test record 2: mango',
      })
    )

    await ms.deleteDataset({ datasetId })
  })
})
