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

const availableRoles = [
  '',
  'CEO / Founder',
  'CTO / Head of Technology',
  'CIO / Head of IT',
  'CMO / Head of Marketing',
  'CFO / Head of Finance',
  'CMO / Head of Marketing',
  'COO / Head of Operations',
  'CISO / Head of Security',
  'CAIO / Head of AI',
  'Product Manager',
  'Software Engineer / Developer',
  'Data Scientist / Analyst',
  'Customer Support',
  'Sales / Account Executive',
  'HR / Recruiter',
  'Designer / UI / UX',
  'Project Manager',
  'Researcher',
  'Student',
  'Other',
]

const availableIndustries = [
  '',
  'Technology',
  'Consulting',
  'Healthcare',
  'Finance',
  'Retail',
  'Education',
  'Marketing',
  'Manufacturing',
  'Hospitality',
  'Legal',
  'Insurance',
  'Pharmaceuticals',
  'Real Estate',
  'Entertainment',
  'Accounting',
  'Automotive',
  'Advertising',
  'Non-profit',
  'Transportation',
  'Travel',
  'Food',
  'Cybersecurity',
  'Government',
  'Energy',
  'Agriculture',
  'Other',
]

export default function Page({ organization, role, industry }) {
  const { values, setValues } = useWizard()

  // @note goal is deliberately not seeded here - it is collected by the
  // preceding /new/goal step and only persisted once the wizard completes, so
  // re-seeding it from this page would overwrite the value the user just typed
  useFirst(() => {
    setValues({
      ...values,

      organization,
      role,
      industry,
    })
  })

  return (
    <>
      <Heading
        title="About You"
        description="Help us customize your experience by sharing a bit about you and your organization."
      />
      <FormContainer>
        {/* organization */}
        <div>
          <label className="default-label" htmlFor="organization">
            Whats your company / organization name?
          </label>
          <div className="mt-1">
            <input
              className="default-input w-full"
              id="organization"
              name="organization"
              type="text"
              value={values.organization}
              onChange={(e) => {
                setValues({ ...values, organization: e.target.value })
              }}
              placeholder="Your Company / Organization Name"
              maxLength={128}
              required
            />
          </div>
        </div>
        {/* role */}
        <div>
          <label className="default-label" htmlFor="role">
            What is your role?
          </label>
          <div className="mt-1">
            <select
              className="default-input w-full"
              id="role"
              name="role"
              value={values.role}
              onChange={(e) => {
                setValues({ ...values, role: e.target.value })
              }}
              placeholder="Your role"
              required
            >
              {availableRoles.map((value) => (
                <option key={`role: ${value}`} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>
        {/* industry */}
        <div>
          <label className="default-label" htmlFor="industry">
            Whats industry are you in?
          </label>
          <div className="mt-1">
            <select
              className="default-input w-full"
              id="industry"
              name="industry"
              value={values.industry}
              onChange={(e) => {
                setValues({ ...values, industry: e.target.value })
              }}
              placeholder="Industry"
              required
            >
              {availableIndustries.map((value) => (
                <option key={`industry: ${value}`} value={value}>
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
      organization: user.organization,
      role: user.role,
      industry: user.industry,
    }),
  }
}
