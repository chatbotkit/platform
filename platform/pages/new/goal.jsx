import prisma from '@/prisma/client'

import { getSigninRedirect } from '@/lib/auth.signin'
import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Wizard, {
  FormContainer,
  Heading,
  NavigationButtons,
  useWizard,
} from '@/layouts/Wizard'

import DbTextInput from '@/components/DbTextInput'

import useFirst from '@/hooks/useFirst'

export default function Page({ goal }) {
  const { values, setValues } = useWizard()

  useFirst(() => {
    setValues({
      ...values,

      goal,
    })
  })

  return (
    <>
      <Heading
        title="Your Goal"
        description="Tell us what you want to achieve so we can customize your experience. The more we know about your goal, the better we can assist you in reaching it."
      />
      <FormContainer>
        {/* goal */}
        <div>
          <div>
            <DbTextInput
              className="default-input max-h-36 !overflow-auto"
              id="goal"
              name="goal"
              value={values.goal}
              onChange={(event) => {
                setValues({ ...values, goal: event.target.value })
              }}
              placeholder="e.g., automate tasks with AI, create an internal AI assistant, add AI to our product..."
              maxLength={2048}
              required
            />
          </div>
        </div>
      </FormContainer>
      <NavigationButtons />
    </>
  )
}

Page.getLayout = function (children) {
  return (
    <Wizard
      caption="Onboarding"
      title="Setup"
      description="Let's get started by preparing your account."
    >
      {children}
    </Wizard>
  )
}

export async function getServerSideProps(context) {
  const session = await getSoftSession(context.req, context.res)

  if (!session) {
    return {
      redirect: getSigninRedirect(context),
    }
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
  })

  if (!user) {
    return {
      redirect: getSigninRedirect(context),
    }
  }

  return {
    props: makeJsonSafe({
      organization: user.organization,
      role: user.role,
      industry: user.industry,
      goal: user.goal,
    }),
  }
}
