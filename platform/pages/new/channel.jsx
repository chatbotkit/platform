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

import useFirst from '@/hooks/useFirst'

const availableChannels = [
  '',
  'Google Search',
  'Bing Search',
  'ChatGPT',
  'Perplexity',
  'Gemini',
  'Copilot',
  'Twitter / X',
  'LinkedIn',
  'Reddit',
  'YouTube',
  'Facebook',
  'Friend / Colleague',
  'Other',
]

export default function Page({ channel }) {
  const { values, setValues } = useWizard()

  useFirst(() => {
    setValues({
      ...values,

      channel,
    })
  })

  return (
    <>
      <Heading
        title="Referral Source"
        description="Help us understand how you found out about ChatBotKit."
      />
      <FormContainer>
        {/* channel */}
        <div>
          {/* <label
            className="default-label"
            htmlFor="channel"
          >
            Source
          </label> */}
          <div
          // className="mt-1"
          >
            <select
              className="default-input w-full"
              id="channel"
              name="channel"
              value={values.channel}
              onChange={(e) => {
                setValues({ ...values, channel: e.target.value })
              }}
              placeholder="Channel"
              required
            >
              {availableChannels.map((value) => (
                <option key={`channel: ${value}`} value={value}>
                  {value}
                </option>
              ))}
            </select>
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
      channel: user.channel,
    }),
  }
}
