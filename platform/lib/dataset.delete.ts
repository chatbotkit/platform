import prisma from '@/prisma/client'
import type { Dataset } from '@/prisma/types'

import { type Store, getStore } from './store.types'

export async function deleteDatasetAndStore(
  dataset: Pick<Dataset, 'id'>,
  store: Store
) {
  // @note it is important to first delete the store reference

  await store.deleteDataset({ datasetId: dataset.id })

  await prisma.$transaction(async (tx) => {
    await tx.conversation.updateMany({
      where: { datasetId: dataset.id },
      data: { datasetId: null },
    })
    // eslint-disable-next-line custom-eslint-rules/require-safe-prisma-delete
    await tx.dataset.delete({
      where: { id: dataset.id },
    })
  })

  // @todo record audit log
}

export async function deleteDataset(dataset: Pick<Dataset, 'id'>) {
  const thisDataset = await prisma.dataset.findUnique({
    where: { id: dataset.id },
  })

  if (!thisDataset) {
    return // @note prisma deleting a non-existing record is a no-op
  }

  const store = await getStore()

  await deleteDatasetAndStore(thisDataset, store)

  // @todo record audit log
}

export async function deleteManyDatasets(datasets: Pick<Dataset, 'id'>[]) {
  await Promise.all(
    datasets.map(async (dataset) => {
      await deleteDataset(dataset)
    })
  )

  // @todo record audit log
}
