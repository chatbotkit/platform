import type { FrameworkErrorHandler } from '@chatbotkit-dev/observability-spec/next'

export async function register(): Promise<void> {
  // pass
}

export const onRequestError: FrameworkErrorHandler = async () => {
  // pass
}
