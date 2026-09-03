import NoSsr from '@/components/NoSsr'

import { Main } from './components'

export default async function Page() {
  return (
    // @note client-only app embed - keep <NoSsr>, do not SSR these dashboard
    // tools. Full rationale: app/apps/layout.jsx
    <NoSsr>
      <Main />
    </NoSsr>
  )
}
