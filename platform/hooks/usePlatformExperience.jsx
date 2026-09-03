import useBuilderExperience from '@/hooks/useBuilderExperience'

/**
 * Reports whether the dashboard is serving the full platform experience:
 * every surface and primitive, shown on every host except chatbotkit.com.
 * Always the exact complement of useBuilderExperience, from which it is
 * derived so the two can never disagree.
 */
export default function usePlatformExperience() {
  return !useBuilderExperience()
}
