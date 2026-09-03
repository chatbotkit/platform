import {
  type ReadonlyURLSearchParams,
  useSearchParams as useNextSearchParams,
} from 'next/navigation'

export default function useSearchParams(): ReadonlyURLSearchParams | null {
  const searchParams = useNextSearchParams()

  return searchParams
}
