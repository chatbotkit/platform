'use client'

import usePlatformExperience from '@/hooks/usePlatformExperience'

/**
 * Renders its children only on the platform experience. The builder
 * experience (chatbotkit.com) hides developer-oriented content such as SDK
 * and API examples; everywhere else the children render as usual.
 */
export default function PlatformExperienceOnly({ children }) {
  const platformExperience = usePlatformExperience()

  if (!platformExperience) {
    return null
  }

  return <>{children}</>
}
