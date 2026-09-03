import { useRouter } from 'next/compat/router'

export default function useIsAppRouter(): boolean {
  const router = useRouter()

  return !router
}
