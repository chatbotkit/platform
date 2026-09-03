import { navbarButtons } from '@/config/navigation'

import MainNavbar from '@/components/MainNavbar'
import Meta from '@/components/Meta'
import Widget from '@/components/Widget'

export const rootUrl = '/' // deliberately set / so that the user can exit

export const navigation = [
  {
    title: 'Models',
    href: '/platform/models',
    group: 'app',
  },
  {
    title: 'Actions',
    href: '/platform/actions',
    group: 'app',
  },
  {
    title: 'Reports',
    href: '/platform/reports',
    group: 'app',
  },
  {
    title: 'Limits',
    href: '/platform/limits',
    group: 'app',
  },
]

export default function Platform({
  breadcrumbs,
  title,
  description,
  keywords,
  image,

  baseUrl,

  children,
}) {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-white dark:bg-black">
      <Meta
        breadcrumbs={breadcrumbs}
        title={title}
        description={description}
        keywords={keywords}
        image={image}
        baseUrl={baseUrl}
      />
      <Widget />
      <MainNavbar
        rootUrl={rootUrl}
        navigation={navigation}
        buttons={navbarButtons}
        miniDarkModeSwitch={true}
      />
      <main>
        <div>{children}</div>
      </main>
    </div>
  )
}
