import { Micro, ThemeContext } from './frame'

const meta = {
  title: 'Pages/Integrations/Widget/Frame/Micro',
  component: Micro,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A component that displays a micro preview card with an image, title, description, and link to an external resource.',
      },
    },
  },
  argTypes: {
    type: {
      control: 'select',
      options: ['bot', 'user'],
      description: 'The message type (bot or user)',
      defaultValue: 'bot',
    },
    data: {
      control: 'object',
      description: 'Data object containing micro preview information',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
  decorators: [
    (Story, context) => {
      const theme = {
        messageStyle: context.args.messageStyle || 'bubble',
      }

      return (
        <ThemeContext.Provider value={{ theme }}>
          <div className="max-w-2xl p-4">
            <Story />
          </div>
        </ThemeContext.Provider>
      )
    },
  ],
}

export const Default = {
  args: {
    type: 'bot',
    data: {
      url: 'https://en.wikipedia.org/wiki/Tokyo',
      image:
        'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Skyscrapers_of_Shinjuku_2009_January.jpg/330px-Skyscrapers_of_Shinjuku_2009_January.jpg',
      title: 'Tokyo - Wikipedia',
      description:
        "Tokyo, officially Tokyo Metropolis, is the capital and most populous prefecture of Japan. It is located on the eastern coast of Honshu, the country's main island.",
      publisher: 'Wikipedia',
    },
  },
}

export const YouTubeVideo = {
  args: {
    type: 'bot',
    data: {
      url: 'https://www.youtube.com/watch?v=36qeiAPkbcE',
      image: 'https://i.ytimg.com/vi/36qeiAPkbcE/hqdefault.jpg',
      title: 'Example YouTube Video',
      description:
        'This is a YouTube video preview that will render an embedded player.',
      publisher: 'YouTube',
    },
  },
}

export const NoImage = {
  args: {
    type: 'bot',
    data: {
      url: 'https://en.wikipedia.org/wiki/Artificial_intelligence',
      title: 'Artificial intelligence - Wikipedia',
      description:
        'Artificial intelligence (AI) is intelligence demonstrated by machines, as opposed to natural intelligence displayed by animals and humans.',
      publisher: 'Wikipedia',
    },
  },
}

export const LongTitle = {
  args: {
    type: 'bot',
    data: {
      url: 'https://en.wikipedia.org/wiki/Kyoto',
      image:
        'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Kiyomizu.jpg/330px-Kiyomizu.jpg',
      title:
        'Kyoto - Wikipedia with an exceptionally long title that might overflow',
      description:
        'Kyoto, once the capital of Japan, is a city on the island of Honshu. It is famous for its classical Buddhist temples, as well as gardens, imperial palaces, Shinto shrines and traditional wooden houses.',
      publisher: 'Wikipedia',
    },
  },
}

export const LongDescription = {
  args: {
    type: 'bot',
    data: {
      url: 'https://en.wikipedia.org/wiki/Machine_learning',
      image:
        'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/Kernel_Machine.svg/330px-Kernel_Machine.svg.png',
      title: 'Machine learning - Wikipedia',
      description:
        'Machine learning is a branch of artificial intelligence and computer science that focuses on the use of data and algorithms to imitate the way humans learn, gradually improving accuracy. It is seen as part of artificial intelligence and uses statistical techniques to give computer systems the ability to learn from data without being explicitly programmed. The field has many applications including computer vision, speech recognition, email filtering, medicine, agriculture, and more.',
      publisher: 'Wikipedia',
    },
  },
}

export const WithLogo = {
  args: {
    type: 'bot',
    data: {
      url: 'https://en.wikipedia.org/wiki/Deep_learning',
      logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Wikipedia-logo-v2.svg/50px-Wikipedia-logo-v2.svg.png',
      title: 'Deep learning - Wikipedia',
      description:
        'Deep learning is part of a broader family of machine learning methods based on artificial neural networks.',
      publisher: 'Wikipedia',
    },
  },
}

export const MinimalData = {
  args: {
    type: 'bot',
    data: {
      url: 'https://en.wikipedia.org/wiki/Neural_network',
      title: 'Neural network - Wikipedia',
    },
  },
}

export const NoURL = {
  args: {
    type: 'bot',
    data: {
      title: 'Wikipedia Without URL',
      description: 'This should not render because there is no URL provided.',
      image:
        'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Wikipedia-logo-v2.svg/200px-Wikipedia-logo-v2.svg.png',
    },
  },
}

export const LoadingState = {
  args: {
    type: 'bot',
    data: {
      url: 'https://en.wikipedia.org/wiki/Computer_science',
      image: 'https://via.placeholder.com/1x1', // Very small image to trigger loading state
      title: 'Computer science - Wikipedia',
      description: 'This simulates a loading state with skeleton placeholders.',
      publisher: 'Wikipedia',
    },
  },
}

export const MultipleCards = {
  render: () => {
    const cards = [
      {
        url: 'https://en.wikipedia.org/wiki/Python_(programming_language)',
        image:
          'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Python-logo-notext.svg/230px-Python-logo-notext.svg.png',
        title: 'Python (programming language) - Wikipedia',
        description:
          'Python is a high-level, general-purpose programming language.',
      },
      {
        url: 'https://en.wikipedia.org/wiki/JavaScript',
        image:
          'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/JavaScript-logo.png/240px-JavaScript-logo.png',
        title: 'JavaScript - Wikipedia',
        description:
          'JavaScript is a programming language that is one of the core technologies of the World Wide Web.',
      },
      {
        url: 'https://en.wikipedia.org/wiki/TypeScript',
        image:
          'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Typescript_logo_2020.svg/240px-Typescript_logo_2020.svg.png',
        title: 'TypeScript - Wikipedia',
        description:
          'TypeScript is a free and open-source programming language developed and maintained by Microsoft.',
      },
    ]

    return (
      <ThemeContext.Provider value={{ theme: { messageStyle: 'bubble' } }}>
        <div className="max-w-2xl space-y-4">
          {cards.map((data, index) => (
            <Micro key={index} type="bot" data={data} />
          ))}
        </div>
      </ThemeContext.Provider>
    )
  },
}

export default meta
