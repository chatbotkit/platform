import useRouter from '@/hooks/useRouter'

export default function useDebugMode(): boolean {
  const router = useRouter()

  return router.query.debug === '1' || router.query.debug === 'true'
}
