import MovingScreen from '@/components/MovingScreen'
import WidgetPreview from '@/components/WidgetPreview'

import clsx from 'clsx'

export default function WidgetsScreen({ widgets, ...props }) {
  return (
    <MovingScreen movingScreenExposeMaxHeight="600px" {...props}>
      <div className="relative">
        <div
          className={clsx(
            'mx-auto flex flex-row justify-center',
            'relative z-20',
            {
              'max-w-6xl': widgets.length === 3,
              'max-w-4xl': widgets.length <= 2,
            }
          )}
        >
          {widgets.map(({ slug, title, intro, messages, theme }, index) => {
            return (
              <div
                key={index}
                className={clsx('min-w-sm max-w-md scale-[0.9]', {
                  'hidden md:block': index > 0,
                })}
                style={{ marginTop: index * 40 + 'px' }}
              >
                <WidgetPreview
                  key={slug}
                  className="shadow-xl"
                  title={title}
                  intro={intro}
                  messages={messages}
                  theme={theme}
                  disabled={true}
                />
              </div>
            )
          })}
        </div>
        <div className="pointer-events-none absolute z-10 bottom-0 left-0 w-full h-full pt-rectangles gradient-mask-t-10" />
      </div>
    </MovingScreen>
  )
}
