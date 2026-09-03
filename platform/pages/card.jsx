import { generateContentCard } from '@/lib/card'
import { withImageResponse } from '@/lib/card.response'

export default function Page() {
  return null
}

export const getServerSideProps = withImageResponse(async function () {
  const image = await generateContentCard({
    category: 'AI Agent Platform',
    title: 'Build, scale and ship intelligence',
  })

  return image
})
