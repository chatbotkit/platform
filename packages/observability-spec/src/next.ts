export type RouterNavigationType = 'push' | 'replace' | 'traverse'

export type RouterTransitionStartHandler = (
  url: string,
  navigationType: RouterNavigationType
) => void

export type FrameworkErrorHandler = (...args: unknown[]) => Promise<void>
