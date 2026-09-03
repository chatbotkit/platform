import Collapsible from '@/components/Collapsible'
import {
  TeamSwitchButton,
  UserSwitchButton,
  useSessionContext,
} from '@/components/SessionContext'

import clsx from 'clsx'

// @note uses Collapsible to animate height smoothly when switching context

export default function SwitchBar({ className, children, ...props }) {
  const {
    isTeamSwitched: teamIsSwitched,
    teamId: switchedTeamId,
    teamName: switchedTeamName,
    teams,

    isUserSwitched: userIsSwitched,
    userId: switchedUserId,
    userName: switchedUserName,
    users,
  } = useSessionContext()

  const isSwitched = teamIsSwitched || userIsSwitched

  return (
    <Collapsible
      {...props}
      className={clsx('overflow-hidden transition-all duration-300', className)}
      style={{ height: isSwitched ? undefined : 0 }}
    >
      <div className="flex flex-row items-center h-10">
        <div className="flex-1 flex flex-row items-center gap-2">
          {switchedTeamName || switchedTeamId ? (
            <div className="font-semibold">
              {switchedTeamName || switchedTeamId}
            </div>
          ) : null}
          {switchedTeamName && switchedUserName ? <div>&bull;</div> : null}
          {switchedUserName || switchedUserId ? (
            <div className="font-semibold">
              {switchedUserName || switchedUserId}
            </div>
          ) : null}
          <div className="flex-1" />
          {isSwitched && teams.length ? (
            <TeamSwitchButton className="hud-button small push">
              Switch Team
            </TeamSwitchButton>
          ) : null}
          {isSwitched && users.length ? (
            <UserSwitchButton className="hud-button small push">
              Switch User
            </UserSwitchButton>
          ) : null}
        </div>
        {children}
      </div>
    </Collapsible>
  )
}
