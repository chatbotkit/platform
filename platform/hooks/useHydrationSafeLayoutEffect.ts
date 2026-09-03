import { useEffect, useLayoutEffect } from 'react'

const useHydrationSafeLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect

export default useHydrationSafeLayoutEffect
