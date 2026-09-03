import DarkModeSwitch from '@/components/DarkModeSwitch'
import { MenuItem, SignInMenuItem } from '@/components/MainNavbar'
import ProfileDropdown from '@/components/ProfileDropdown'

import useSession from '@/hooks/useSession'
import useSignout from '@/hooks/useSignout'

/**
 * The signed-in account UI for MainNavbar, kept out of the navbar itself so
 * that session-free surfaces (landing pages, partner sites) do not pull
 * next-auth into their bundle. Layouts that serve signed-in users pass this
 * as the navbar's `account` slot.
 */

export function Desktop() {
  return (
    <ProfileDropdown
      withDashboard={false}
      withApps={false}
      withHub={false}
    />
  )
}

export function Mobile() {
  const { data: session } = useSession()

  const { signout } = useSignout()

  return (
    <>
      {session?.user ? (
        <div className="flex items-center px-4">
          <div className="flex-shrink-0">
            <img
              className="h-10 w-10 rounded-full"
              src={session.user.image}
              alt=""
            />
          </div>
          <div className="ml-3">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-500">
              {session.user.email}
            </div>
          </div>
        </div>
      ) : null}
      <div className="mt-3 space-y-1">
        <MenuItem as="div">
          <DarkModeSwitch />
        </MenuItem>
        {session?.user ? (
          <MenuItem as="div" onClick={() => signout()}>
            Sign Out
          </MenuItem>
        ) : (
          <SignInMenuItem />
        )}
      </div>
    </>
  )
}

const NavbarAccount = { Desktop, Mobile }

export default NavbarAccount
