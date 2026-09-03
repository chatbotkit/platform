import { withGet } from '@/lib/method'
import { notFound, ok } from '@/lib/response'

// @note Microsoft domain verification for the "Sign in with Microsoft"
// provider: Azure AD proves domain ownership by fetching this file and
// matching the application id. The id is deployment configuration - the same
// client id that enables the provider in lib/auth.providers.ts - so the route
// is presence-gated on it: a deployment without Microsoft sign-in serves no
// association at all, and one with it serves its own application, never
// another deployment's.

export default withGet(async function () {
  const applicationId = process.env.NEXTAUTH_AZURE_AD_CLIENT_ID

  if (!applicationId) {
    return notFound()
  }

  return ok({
    associatedApplications: [
      {
        applicationId: applicationId,
      },
    ],
  })
})
