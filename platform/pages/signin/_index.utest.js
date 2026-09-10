import Signin, { getServerSideProps } from '@/pages/signin'

jest.mock('@/config/origins', () => ({
  appMainHost: 'main.revalidation.localhost:4300',
  appLabsHost: 'labs.revalidation.localhost:4300',
}))

jest.mock('@/config/hosts', () => ({
  ...jest.requireActual('@/config/hosts'),
  hostsConfig: {
    shell: {
      match: ['main.revalidation.localhost:4400'],
      site: 'console.revalidation.localhost:4400',
      api: 'console.revalidation.localhost:4400',
      static: 'console.revalidation.localhost:4400',
      widgets: 'console.revalidation.localhost:4400',
    },
  },
}))

jest.mock('@/lib/auth.providers', () => ({
  providers: [{ id: 'email' }, { id: 'email', options: { id: 'trusted' } }],
}))

function authProps(props) {
  return Signin(props).props.children[1].props.children.props
}

describe('sign-in handoff', () => {
  it.each([
    'main.revalidation.localhost:4300',
    'labs.revalidation.localhost:4300',
    'main.revalidation.localhost:4400',
  ])('keeps %s out of platform-only onboarding routes', async (host) => {
    const { props } = await getServerSideProps({
      req: { headers: { host }, url: '/signin' },
      res: {},
      query: {},
    })

    expect(authProps(props).intermediateURL).toBeNull()
    expect(props.providers).toEqual(['email', 'trusted'])
  })

  it('retains onboarding on a platform hostname', async () => {
    const { props } = await getServerSideProps({
      req: {
        headers: { host: 'console.revalidation.localhost:4300' },
        url: '/signin',
      },
      res: {},
      query: {},
    })

    expect(authProps(props).intermediateURL).toBe('/welcome')
  })
})
