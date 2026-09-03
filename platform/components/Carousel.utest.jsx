import Carousel, { CarouselButton, CarouselItem } from './Carousel'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('@/components/Component', () => {
  return function Component({ as: As = 'div', children, ...props }) {
    return <As {...props}>{children}</As>
  }
})

describe('CarouselItem', () => {
  describe('basic functionality', () => {
    it('should render with all content', () => {
      render(
        <CarouselItem
          image="https://example.com/image.jpg"
          title="Test Title"
          description="Test description"
        />
      )

      expect(screen.getByRole('img')).toHaveAttribute(
        'src',
        'https://example.com/image.jpg'
      )
      expect(screen.getByText('Test Title')).toBeInTheDocument()
      expect(screen.getByText('Test description')).toBeInTheDocument()
    })

    it('should render without image', () => {
      render(<CarouselItem title="Test Title" description="Test description" />)

      expect(screen.queryByRole('img')).not.toBeInTheDocument()
      expect(screen.getByText('Test Title')).toBeInTheDocument()
    })

    it('should render without title', () => {
      render(
        <CarouselItem
          image="https://example.com/image.jpg"
          description="Test description"
        />
      )

      expect(screen.getByRole('img')).toBeInTheDocument()
      expect(screen.getByText('Test description')).toBeInTheDocument()
    })

    it('should render without description', () => {
      render(
        <CarouselItem
          image="https://example.com/image.jpg"
          title="Test Title"
        />
      )

      expect(screen.getByRole('img')).toBeInTheDocument()
      expect(screen.getByText('Test Title')).toBeInTheDocument()
    })

    it('should render with only image', () => {
      render(<CarouselItem image="https://example.com/image.jpg" />)

      expect(screen.getByRole('img')).toBeInTheDocument()
      expect(
        document.querySelector('.carousel-content')
      ).not.toBeInTheDocument()
    })
  })

  describe('buttons functionality', () => {
    it('should render buttons with default button element', () => {
      const buttons = [
        { caption: 'Button 1', onClick: jest.fn() },
        { caption: 'Button 2', onClick: jest.fn() },
      ]

      render(<CarouselItem title="Test" buttons={buttons} />)

      const button1 = screen.getByText('Button 1')
      const button2 = screen.getByText('Button 2')

      expect(button1).toBeInTheDocument()
      expect(button2).toBeInTheDocument()
      expect(button1.tagName).toBe('BUTTON')
      expect(button2.tagName).toBe('BUTTON')
    })

    it('should render buttons with custom element via buttonAs', () => {
      const buttons = [{ caption: 'Link Button', href: '/test' }]

      render(<CarouselItem title="Test" buttons={buttons} buttonAs="a" />)

      const link = screen.getByText('Link Button')

      expect(link.tagName).toBe('A')
      expect(link).toHaveAttribute('href', '/test')
    })

    it('should pass button props correctly', () => {
      const onClick = jest.fn()
      const buttons = [
        { caption: 'Click Me', onClick, className: 'custom-btn' },
      ]

      render(<CarouselItem title="Test" buttons={buttons} />)

      const button = screen.getByText('Click Me')

      expect(button).toHaveClass('custom-btn')

      fireEvent.click(button)
      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('should render multiple buttons', () => {
      const buttons = [
        { caption: 'Button 1', onClick: jest.fn() },
        { caption: 'Button 2', onClick: jest.fn() },
      ]

      render(<CarouselItem title="Test" buttons={buttons} />)

      const button1 = screen.getByText('Button 1')
      const button2 = screen.getByText('Button 2')

      expect(button1).toBeInTheDocument()
      expect(button2).toBeInTheDocument()
      expect(button1.tagName).toBe('BUTTON')
      expect(button2.tagName).toBe('BUTTON')
    })

    it('should not render empty buttons container when buttons array is empty', () => {
      render(<CarouselItem title="Test" buttons={[]} />)

      expect(screen.queryByText('Button 1')).not.toBeInTheDocument()
    })

    it('should not render buttons container when buttons is undefined', () => {
      render(<CarouselItem title="Test" />)

      expect(screen.queryByText('Button 1')).not.toBeInTheDocument()
    })
  })

  describe('image error handling', () => {
    it('should remove image element on error', () => {
      render(
        <CarouselItem image="https://example.com/broken.jpg" title="Test" />
      )

      const img = screen.getByRole('img')

      fireEvent.error(img)

      expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })
  })

  describe('styling', () => {
    it('should apply custom className', () => {
      render(<CarouselItem className="custom-carousel-item" title="Test" />)

      const item = document.querySelector('.carousel-item')

      expect(item).toHaveClass('custom-carousel-item')
    })

    it('should have correct CSS classes', () => {
      render(<CarouselItem title="Test" />)

      const item = document.querySelector('.carousel-item')

      expect(item).toHaveClass('grid')
      expect(item).toHaveClass('overflow-hidden')
      expect(item).toHaveClass('snap-start')
    })
  })

  describe('edge cases', () => {
    it('should render with all props undefined', () => {
      const { container } = render(<CarouselItem />)

      expect(container.querySelector('.carousel-item')).toBeInTheDocument()
      expect(
        container.querySelector('.carousel-content')
      ).not.toBeInTheDocument()
    })

    it('should render multiple buttons with unique keys', () => {
      const buttons = [
        { caption: 'Button 1' },
        { caption: 'Button 2' },
        { caption: 'Button 3' },
      ]

      render(<CarouselItem title="Test" buttons={buttons} />)

      expect(screen.getByText('Button 1')).toBeInTheDocument()
      expect(screen.getByText('Button 2')).toBeInTheDocument()
      expect(screen.getByText('Button 3')).toBeInTheDocument()
    })
  })
})

describe('CarouselButton', () => {
  describe('basic functionality', () => {
    it('should render button element', () => {
      const { container } = render(
        <CarouselButton position="left">Previous</CarouselButton>
      )

      const button = container.querySelector('.carousel-button')

      expect(button).toBeInTheDocument()
    })

    it('should apply left position classes', () => {
      const { container } = render(
        <CarouselButton position="left">Previous</CarouselButton>
      )

      const button = container.querySelector('.carousel-button')

      expect(button).toHaveClass('sticky')
      expect(button).toHaveClass('left-0')
    })

    it('should apply right position classes', () => {
      const { container } = render(
        <CarouselButton position="right">Next</CarouselButton>
      )

      const button = container.querySelector('.carousel-button')

      expect(button).toHaveClass('sticky')
      expect(button).toHaveClass('right-0')
    })
  })

  describe('edge cases', () => {
    it('should render button without crashing', () => {
      const { container } = render(
        <CarouselButton position="left">Previous</CarouselButton>
      )

      const button = container.querySelector('.carousel-button')

      expect(button).toBeInTheDocument()
    })

    it('should pass through custom className', () => {
      const { container } = render(
        <CarouselButton position="left" className="custom-btn">
          Previous
        </CarouselButton>
      )

      const button = container.querySelector('.carousel-button')

      expect(button).toHaveClass('custom-btn')
    })

    it('should render children', () => {
      render(<CarouselButton position="left">Previous</CarouselButton>)

      expect(screen.getByText('Previous')).toBeInTheDocument()
    })
  })
})

describe('Carousel', () => {
  describe('basic functionality', () => {
    it('should render children', () => {
      render(
        <Carousel>
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
        </Carousel>
      )

      expect(screen.getByTestId('child-1')).toBeInTheDocument()
      expect(screen.getByTestId('child-2')).toBeInTheDocument()
    })

    it('should have correct CSS classes', () => {
      const { container } = render(
        <Carousel>
          <div>Child</div>
        </Carousel>
      )

      const carousel = container.querySelector('.carousel')

      expect(carousel).toHaveClass('relative')
      expect(carousel).toHaveClass('grid')
      expect(carousel).toHaveClass('grid-flow-col')
      expect(carousel).toHaveClass('overflow-x-auto')
      expect(carousel).toHaveClass('snap-mandatory')
      expect(carousel).toHaveClass('snap-x')
    })

    it('should apply custom className', () => {
      const { container } = render(
        <Carousel className="custom-carousel">
          <div>Child</div>
        </Carousel>
      )

      const carousel = container.querySelector('.carousel')

      expect(carousel).toHaveClass('custom-carousel')
    })
  })

  describe('compound component pattern', () => {
    it('should expose CarouselItem as Carousel.Item', () => {
      expect(Carousel.Item).toBe(CarouselItem)
    })

    it('should expose CarouselButton as Carousel.Button', () => {
      expect(Carousel.Button).toBe(CarouselButton)
    })

    it('should work with compound component syntax', () => {
      render(
        <Carousel>
          <Carousel.Item title="Item 1" description="Description 1" />
          <Carousel.Item title="Item 2" description="Description 2" />
          <Carousel.Button position="left">Prev</Carousel.Button>
          <Carousel.Button position="right">Next</Carousel.Button>
        </Carousel>
      )

      expect(screen.getByText('Item 1')).toBeInTheDocument()
      expect(screen.getByText('Item 2')).toBeInTheDocument()
      expect(screen.getByText('Prev')).toBeInTheDocument()
      expect(screen.getByText('Next')).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('should render with no children', () => {
      const { container } = render(<Carousel />)

      const carousel = container.querySelector('.carousel')

      expect(carousel).toBeInTheDocument()
    })

    it('should pass through other props', () => {
      const { container } = render(
        <Carousel data-testid="custom-carousel" id="carousel-1">
          <div>Child</div>
        </Carousel>
      )

      const carousel = screen.getByTestId('custom-carousel')

      expect(carousel).toHaveAttribute('id', 'carousel-1')
    })
  })
})
