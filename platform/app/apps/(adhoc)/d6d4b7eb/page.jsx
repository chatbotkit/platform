import { Error } from '@/layouts/Errata'

import { Main } from './components'
import { fetchContact } from './server'

export default async function Page() {
  const contact = await fetchContact({})

  if (!contact) {
    return (
      <div className="main-page main-page-3xl">
        <Error error="loading" error_description="Loading..." />
      </div>
    )
  }

  if ('error' in contact) {
    return (
      <div className="main-page main-page-3xl">
        <Error
          error={contact.error.code}
          error_description={contact.error.message}
        />
      </div>
    )
  }

  return (
    <div className="main-page main-page-3xl">
      <Main contact={contact} />
    </div>
  )
}
