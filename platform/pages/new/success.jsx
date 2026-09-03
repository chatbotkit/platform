import { useContext, useEffect, useMemo } from 'react'

import { Heading } from '@/layouts/Wizard'
import Wizard, { wizardContext } from '@/layouts/Wizard'

import Link from '@/components/Link'

import useBuilderExperience from '@/hooks/useBuilderExperience'
import { persistProjectScope } from '@/hooks/useProjectScope'
import useSession from '@/hooks/useSession'

import { CheckCircleIcon } from '@heroicons/react/24/outline'

export default function Page() {
  const { options, loading, setLoading } = useContext(wizardContext)

  const { data: session } = useSession()

  const isBuilderExperience = useBuilderExperience()

  useEffect(() => {
    if (loading) {
      setLoading(false)
    }
  }, [loading, setLoading])

  const projectScopeReturn =
    options.projectScopeReturnPath && options.createdBlueprintId

  useEffect(() => {
    if (!options.createdBlueprintId) {
      return
    }

    persistProjectScope(session?.user?.id, {
      id: options.createdBlueprintId,
      name: options.createdBlueprintName || 'Untitled',
    })
  }, [
    session?.user?.id,
    options.createdBlueprintId,
    options.createdBlueprintName,
  ])

  const { successMessage, successButtonAction, successButtonCaption } =
    useMemo(() => {
      const successMessage =
        options.successMessage ||
        'Your setup is complete. Continue to the next step.'

      // @note the builder experience navigates by project scope - it has no
      // blueprint surfaces in its menu (see buildMenu in layouts/Dashboard.jsx)
      // - so a completed setup lands on the project-scoped overview for the
      // project we just created rather than on the resource the template
      // created. The template caption names that resource, so it is dropped
      // here too. The platform experience keeps landing on the resource.
      if (isBuilderExperience && options.createdBlueprintId) {
        return {
          successMessage,

          successButtonAction: projectScopeReturn
            ? options.projectScopeReturnPath
            : '/overview',

          successButtonCaption: projectScopeReturn
            ? 'Use this project'
            : 'Continue to your project',
        }
      }

      const successButtonAction =
        options.successButtonAction ||
        (projectScopeReturn ? options.projectScopeReturnPath : '/overview')

      const successButtonCaption =
        options.successButtonCaption ||
        (options.successButtonAction
          ? 'Continue'
          : projectScopeReturn
            ? 'Use this project'
            : 'Continue to overview')

      return { successMessage, successButtonAction, successButtonCaption }
    }, [
      options.successMessage,
      options.successButtonAction,
      options.successButtonCaption,
      options.projectScopeReturnPath,
      options.createdBlueprintId,
      projectScopeReturn,
      isBuilderExperience,
    ])

  return (
    <>
      <Heading
        title={
          <>
            <CheckCircleIcon className="w-12 h-12 text-green-600 mb-2" />
            <span>Setup Complete</span>
          </>
        }
        description={successMessage}
      />
      <div className="px-8 md:px-0">
        {typeof successButtonAction === 'string' ? (
          <Link className="primary-button" href={successButtonAction}>
            {successButtonCaption}
          </Link>
        ) : (
          successButtonAction && (
            <button
              className="primary-button"
              type="button"
              onClick={successButtonAction}
            >
              {successButtonCaption}
            </button>
          )
        )}
      </div>
    </>
  )
}

Page.getLayout = function (children) {
  return (
    <Wizard
      caption="You are ready!"
      title="Success"
      description="Your setup is complete!"
    >
      {children}
    </Wizard>
  )
}
