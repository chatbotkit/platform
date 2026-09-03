import useSearchParams from '@/hooks/useSearchParams'

export default function useSearchParam(key: string): string | undefined {
  const searchParams = useSearchParams()

  return searchParams?.get(key) || undefined
}
