import { useRef } from 'react'

import Component from '@/components/Component'

import clsx from 'clsx'

export function CarouselItem({
  className,

  image,
  title,
  description,

  buttons,

  buttonAs,

  ...props
}) {
  return (
    <div
      {...props}
      className={clsx(
        className,
        'carousel-item',
        'grid',
        'grid-rows-subgrid [grid-template-rows:subgrid]', // no idea why but grid-rows-subgrid is not working so I have to use this
        'row-start-1 row-end-3',
        'overflow-hidden',
        'snap-start'
      )}
    >
      <div className="carousel-image w-full overflow-hidden">
        {image ? (
          <img
            className="w-full h-full object-cover m-0 p-0 border-none"
            src={image}
            alt={title}
            onError={(event) => event.target.remove()}
          />
        ) : null}
      </div>
      {title || description || buttons?.length ? (
        <div className="carousel-content w-full p-2 flex flex-col gap-2">
          {title ? (
            <h3 className="carousel-title line-clamp-2 !m-0 !p-0">{title}</h3>
          ) : null}
          {description ? (
            <p className="carousel-description line-clamp-3 !m-0 !p-0">
              {description}
            </p>
          ) : null}
          <div className="flex-1" />
          {buttons ? (
            <div className="w-full flex flex-col gap-2">
              {buttons.map(({ caption, ...rest }, index) => {
                return (
                  <Component key={index} {...rest} as={buttonAs || 'button'}>
                    {caption}
                  </Component>
                )
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function CarouselButton({ className, position, ...props }) {
  const ref = useRef(null)

  function onButtonClick() {
    if (!ref.current) {
      return
    }

    const button = ref.current
    const carousel = button.parentElement

    const buttonRect = button.getBoundingClientRect()

    const carouselItems = Array.from(
      carousel.querySelectorAll('& > .carousel-item')
    )

    let closestItem = null
    let closestDistance = Infinity

    carouselItems.forEach((item) => {
      const itemRect = item.getBoundingClientRect()

      const distance =
        position === 'left'
          ? buttonRect.left - itemRect.right
          : buttonRect.left - itemRect.left

      if (distance > 0 && distance < closestDistance) {
        closestItem = item
        closestDistance = distance
      }
    })

    if (closestItem) {
      const carouselRect = carousel.getBoundingClientRect()
      const closestItemRect = closestItem.getBoundingClientRect()

      const newScrollPosition =
        closestItemRect.left - carouselRect.left + carousel.scrollLeft

      carousel.scrollTo({
        left: newScrollPosition,
        behavior: 'smooth',
      })
    }
  }

  return (
    <div
      ref={ref}
      {...props}
      className={clsx(className, 'carousel-button', {
        'sticky top-1/2 left-0 transform -translate-y-1/2': position === 'left',
        'sticky top-1/2 right-0 transform -translate-y-1/2':
          position === 'right',
      })}
      type="button"
      onClick={onButtonClick}
    />
  )
}

export default function Carousel({ className, children, ...props }) {
  return (
    <div
      {...props}
      className={clsx(
        className,
        'carousel',
        'relative grid grid-flow-col auto-cols-max gap-6 overflow-x-auto snap-mandatory snap-x'
      )}
    >
      {children}
    </div>
  )
}

Carousel.Item = CarouselItem
Carousel.Button = CarouselButton
