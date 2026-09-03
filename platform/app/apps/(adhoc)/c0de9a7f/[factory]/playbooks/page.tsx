import NoSsr from '@/components/NoSsr'

import { PlaybooksMain } from './components'

export default async function Page(props) {
  const params = await props.params

  const { factory } = params

  // @note client-only app embed - keep <NoSsr>, do not SSR this dashboard
  // (see the root page for the full rationale).
  return (
    <NoSsr>
      <PlaybooksMain factory={factory} />
    </NoSsr>
  )
}
