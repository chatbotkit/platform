import { useEffect, useMemo, useState } from 'react'

import clsx from 'clsx'

import BackLink from './BackLink'

function getSectionTitle(section) {
  const titleElement = section.querySelector(
    '[data-page-section-title], h1, h2, h3'
  )

  return (
    section.getAttribute('data-page-section-title') ||
    titleElement?.getAttribute('data-page-section-title') ||
    titleElement?.textContent?.trim() ||
    null
  )
}

function getSectionIndex(section) {
  const indexElement = section.querySelector('[data-page-section-index]')
  const index =
    section.getAttribute('data-page-section-index') ||
    indexElement?.getAttribute('data-page-section-index')
  const number = Number(index)

  return Number.isFinite(number) ? number : 0
}

function getSectionMore(section) {
  const moreElement = section.querySelector('[data-page-section-more]')
  const more = section.hasAttribute('data-page-section-more')
    ? section.getAttribute('data-page-section-more')
    : moreElement?.getAttribute('data-page-section-more')

  return more != null && more !== 'false'
}

function getSectionDefault(section) {
  const defaultElement = section.querySelector('[data-page-section-default]')
  const value = section.hasAttribute('data-page-section-default')
    ? section.getAttribute('data-page-section-default')
    : defaultElement?.getAttribute('data-page-section-default')

  return value != null && value !== 'false'
}

function PageSectionTabs({
  moreTabs,
  primaryTabs,
  selectedIndex,
  setSelectedIndex,
}) {
  const [more, setMore] = useState(false)
  const tabs = more ? moreTabs : primaryTabs

  if (primaryTabs.length + moreTabs.length <= 1) {
    return null
  }

  return (
    <section data-page-section-tabs className="!bg-white dark:!bg-black">
      <div className="main-page">
        <div
          role="tablist"
          className="tab-list flex w-full flex-nowrap space-x-4 overflow-hidden"
        >
          {more ? (
            <BackLink
              as="button"
              type="button"
              className={clsx(
                'tab',
                'tiny text-sm !no-underline p-2 border-b-4 focus:!ring-0 focus:!outline-none',
                'min-w-0 truncate',
                'select-none cursor-pointer transition-colors',
                'border-transparent auto-text-gray-800 hover:auto-text-gray-900'
              )}
              onClick={() => setMore(false)}
            >
              Back
            </BackLink>
          ) : null}
          {tabs.map((tab) => {
            const selected = tab.sectionIndex === selectedIndex

            return (
              <button
                key={tab.sectionIndex}
                type="button"
                role="tab"
                aria-selected={selected}
                className={clsx(
                  'tab',
                  'text-sm !no-underline p-2 border-b-4 focus:!ring-0 focus:!outline-none',
                  'min-w-0 truncate',
                  'select-none cursor-pointer transition-colors',
                  {
                    'border-transparent auto-text-gray-800 hover:auto-text-gray-900':
                      !selected,
                    'border-[var(--color-accent)] text-[var(--color-accent)]':
                      selected,
                  }
                )}
                onClick={() => setSelectedIndex(tab.sectionIndex)}
              >
                {tab.title}
              </button>
            )
          })}
          {!more && moreTabs.length ? (
            <button
              type="button"
              className={clsx(
                'tab',
                'text-sm !no-underline p-2 border-b-4 focus:!ring-0 focus:!outline-none',
                'min-w-0 truncate',
                'select-none cursor-pointer transition-colors',
                {
                  'border-transparent auto-text-gray-800 hover:auto-text-gray-900':
                    !moreTabs.some((tab) => tab.sectionIndex === selectedIndex),
                  'border-[var(--color-accent)] text-[var(--color-accent)]':
                    moreTabs.some((tab) => tab.sectionIndex === selectedIndex),
                }
              )}
              onClick={() => setMore(true)}
            >
              More
            </button>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export default function PageSections({ children, className, ...props }) {
  const [rootElement, setRootElement] = useState(null)
  const [sections, setSections] = useState([])
  const [selectedIndex, setSelectedIndex] = useState(null)

  const tabs = useMemo(() => {
    return sections
      .map((section, sectionIndex) => {
        return {
          default: getSectionDefault(section),
          index: getSectionIndex(section),
          more: getSectionMore(section),
          sectionIndex,
          title: getSectionTitle(section),
        }
      })
      .sort((a, b) => {
        return b.index - a.index || a.sectionIndex - b.sectionIndex
      })
  }, [sections])

  const tabbed = tabs.length > 1 && tabs.every((tab) => tab.title)
  const primaryTabs = useMemo(() => {
    const primaryTabs = tabs.filter((tab) => !tab.more)

    return primaryTabs.length ? primaryTabs : tabs
  }, [tabs])
  const moreTabs = useMemo(() => {
    return primaryTabs === tabs ? [] : tabs.filter((tab) => tab.more)
  }, [primaryTabs, tabs])
  const defaultTab = useMemo(() => {
    return tabs.find((tab) => tab.default)
  }, [tabs])

  useEffect(() => {
    if (!rootElement) {
      return
    }

    const nextSections = [
      ...rootElement.querySelectorAll(
        ':scope > section:not([data-page-section-tabs])'
      ),
    ]

    setSections((sections) => {
      if (
        sections.length === nextSections.length &&
        sections.every((section, index) => section === nextSections[index])
      ) {
        return sections
      }

      return nextSections
    })
  }, [rootElement, children])

  useEffect(() => {
    if (!tabbed) {
      for (const section of sections) {
        section.style.display = ''
        section.style.backgroundColor = ''

        if (section.firstElementChild) {
          section.firstElementChild.style.paddingTop = ''
        }
      }

      return
    }

    const nextSelectedIndex = tabs.some((tab) => {
      return tab.sectionIndex === selectedIndex
    })
      ? selectedIndex
      : (defaultTab?.sectionIndex ?? primaryTabs[0]?.sectionIndex)

    if (nextSelectedIndex !== selectedIndex) {
      setSelectedIndex(nextSelectedIndex)

      return
    }

    for (const [index, section] of sections.entries()) {
      if (index === selectedIndex) {
        section.style.display = ''
        section.style.backgroundColor = 'transparent'

        if (section.firstElementChild) {
          section.firstElementChild.style.paddingTop = '0'
        }
      } else {
        section.style.display = 'none'
      }
    }

    return () => {
      for (const section of sections) {
        section.style.display = ''
        section.style.backgroundColor = ''

        if (section.firstElementChild) {
          section.firstElementChild.style.paddingTop = ''
        }
      }
    }
  }, [defaultTab, primaryTabs, sections, selectedIndex, tabbed, tabs])

  return (
    <div
      ref={setRootElement}
      className={clsx(
        'page-sections',
        'zebra',
        '[&>*:first-child>.main-page]:pt-8',
        '[&>*:first-child]:!bg-white dark:[&>*:first-child]:!bg-black',
        '[&_.main-page]:py-10',
        className
      )}
      {...props}
    >
      <PageSectionTabs
        moreTabs={tabbed ? moreTabs : []}
        primaryTabs={tabbed ? primaryTabs : []}
        selectedIndex={selectedIndex}
        setSelectedIndex={setSelectedIndex}
      />
      {children}
    </div>
  )
}
