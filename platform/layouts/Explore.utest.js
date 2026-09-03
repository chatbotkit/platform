import { getExploreNavbarButtons, navigation } from '@/layouts/Explore'

describe('Explore', () => {
  const askQuestionButton = {
    title: 'Ask a Question',
  }
  const navbarButtons = [
    {
      title: 'Sign In',
      href: '/overview',
    },
  ]

  it('navigates only between examples and connections', () => {
    expect(navigation).toEqual([
      {
        title: 'Examples',
        href: '/examples',
      },
      {
        title: 'Connections',
        href: '/connections',
      },
    ])
  })

  it('omits the ask question button when the widget is unavailable', () => {
    expect(
      getExploreNavbarButtons(null, askQuestionButton, navbarButtons)
    ).toEqual(navbarButtons)
  })

  it('includes the ask question button when the widget is ready', () => {
    expect(
      getExploreNavbarButtons({}, askQuestionButton, navbarButtons)
    ).toEqual([askQuestionButton, ...navbarButtons])
  })
})
