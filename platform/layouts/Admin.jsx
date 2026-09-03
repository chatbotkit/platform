import MainNavbar from '@/components/MainNavbar'
import Meta from '@/components/Meta'
import NavbarAccount from '@/components/NavbarAccount'

export const rootUrl = '/admin/system'

const navigation = [
  {
    title: 'System',
    href: '/admin/system',
  },
  {
    title: 'Users',
    href: '/admin/users',
  },
]

export default function Admin({
  breadcrumbs,
  title,
  description,
  keywords,
  image,

  children,
}) {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-white dark:bg-black">
      <Meta
        breadcrumbs={breadcrumbs || ['Admin', 'ChatBotKit']}
        title={title}
        description={description}
        keywords={keywords}
        image={image}
      />
      <MainNavbar
        rootUrl={rootUrl}
        navigation={navigation}
        account={NavbarAccount}
      />
      <main>
        <div>{children}</div>
      </main>
    </div>
  )
}
