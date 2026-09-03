import { useMemo, useState } from 'react'

import { getColorFilter } from '@/lib/color.filter'
import { text2emoji } from '@/lib/emoji'
import { isEmoji } from '@/lib/emoji2'
import { isComponent } from '@/lib/react'
import { tryHash } from '@/lib/url'

import Emoji from '@/components/Emoji'
import GravatarIcon from '@/components/GravatarIcon'

import useTheme from '@/hooks/useTheme'

import clsx from 'clsx'

export const DEFAULT_LOGO_PROVIDER = 'google'
export const DEFAULT_LOGO_FALLBACK_PROVIDER = 'duckduckgo'

export const DEFAULT_FAVICON_PROVIDER = 'google'
export const DEFAULT_FAVICON_FALLBACK_PROVIDER = 'duckduckgo'

export function dynamicIconToUrl(icon) {
  if (typeof icon !== 'string') {
    return null
  }

  switch (true) {
    case icon.startsWith?.('blob:'):
    case icon.startsWith?.('data:'):
    case icon.startsWith?.('/'):
    case icon.startsWith?.('http://'):
    case icon.startsWith?.('https://'): {
      return icon
    }

    case icon.startsWith('blank/'):
    case icon.startsWith('@blank/'): {
      return `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=`
    }

    case icon.startsWith('heroicons/'):
    case icon.startsWith('@heroicons/'): {
      let name = icon.replace('@heroicons/', '').replace('heroicons/', '')

      if (!name.startsWith('outline/') && !name.startsWith('solid/')) {
        name = `outline/${name}`
      }

      return `https://cdn.jsdelivr.net/npm/heroicons@2.1.1/24/${name}.svg`
    }

    case icon.startsWith('lucide/'):
    case icon.startsWith('@lucide/'): {
      const name = icon.replace('@lucide/', '').replace('lucide/', '')

      return `https://unpkg.com/lucide-static@0.548.0/icons/${name}.svg`
    }

    case icon.startsWith('fontawesome/'):
    case icon.startsWith('@fontawesome/'): {
      const name = icon.replace('@fontawesome/', '').replace('fontawesome/', '')

      return `https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.7.2/svgs/${name}.svg`
    }

    case icon.startsWith('flat-color-icons/'):
    case icon.startsWith('@flat-color-icons/'): {
      const name = icon
        .replace('@flat-color-icons/', '')
        .replace('flat-color-icons/', '')

      return `https://cdn.jsdelivr.net/npm/flat-color-icons@1.1.0/svg/${name}.svg`
    }

    case icon.startsWith('logo/'):
    case icon.startsWith('@logo/'): {
      let logoIcon = icon.replace('@logo/', '').replace('logo/', '')

      try {
        if (!/^https?:\/\//i.test(logoIcon)) {
          logoIcon = `https://${logoIcon}`
        }

        const url = new URL(logoIcon)

        return `https://${DEFAULT_LOGO_PROVIDER}.com/s2/favicons?domain=${url.hostname}&sz=256`
      } catch {
        return null
      }
    }

    case icon.startsWith('favicon/'):
    case icon.startsWith('@favicon/'): {
      let faviconIcon = icon.replace('@favicon/', '').replace('favicon/', '')

      try {
        if (!/^https?:\/\//i.test(faviconIcon)) {
          faviconIcon = `https://${faviconIcon}`
        }

        const url = new URL(faviconIcon)

        return `https://${DEFAULT_FAVICON_PROVIDER}.com/s2/favicons?domain=${url.hostname}&sz=256`
      } catch {
        return null
      }
    }

    case icon.startsWith('google/'):
    case icon.startsWith('@google/'): {
      const name = icon.replace('@google/', '').replace('google/', '')

      return `https://www.google.com/s2/favicons?domain=${name}&sz=256`
    }

    case icon.startsWith('duckduckgo/'):
    case icon.startsWith('@duckduckgo/'): {
      const name = icon.replace('@duckduckgo/', '').replace('duckduckgo/', '')

      return `https://icons.duckduckgo.com/ip3/${name}.ico`
    }

    case icon.startsWith('mockingmind/'):
    case icon.startsWith('@mockingmind/'): {
      const match = icon
        .replace('@mockingmind/', '')
        .replace('mockingmind/', '')
        .match(/(\w+)\/(\d+)/)

      if (match) {
        const category = match[1]
        const number = match[2]

        return `https://mighty.tools/mockmind-api/content/${category}/${number}.jpg`
      }

      return null
    }

    case icon.startsWith('gravatar/'):
    case icon.startsWith('@gravatar/'): {
      const email = icon
        .replace('@gravatar/', '')
        .replace('gravatar/', '')
        .trim()
        .toLowerCase()

      const hash = email
        ? Array.from(new TextEncoder().encode(email))
            .reduce((hash, byte) => {
              hash = (hash << 5) - hash + byte

              return hash & hash
            }, 0)
            .toString(16)
        : '00000000000000000000000000000000'

      return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=256`
    }

    case icon.startsWith('ui-avatars/'):
    case icon.startsWith('@ui-avatars/'): {
      const name = icon
        .replace('@ui-avatars/', '')
        .replace('ui-avatars/', '')
        .trim()

      return `https://ui-avatars.com/api/?name=${encodeURIComponent(
        name
      )}&size=256&background=f3f4f6&color=111827&bold=true`
    }
  }

  return null
}

export default function DynamicIcon({
  image,
  logo,
  src,

  icon: _icon = image || logo || src,

  fallbackImage,
  fallbackLogo,
  fallbackSrc,

  fallbackIcon = fallbackImage || fallbackLogo || fallbackSrc,

  className: _className,

  style: _style,

  componentClassName,
  imageClassName,
  iconClassName,
  logoClassName,

  ...props
}) {
  const { theme } = useTheme()

  const [fallbackComponent, setFallbackComponent] = useState(null)

  let [icon, hash] = useMemo(() => {
    if (typeof _icon === 'string') {
      let [light, dark = light] = _icon.split(';').map((i) => i.trim())

      const lightHash = tryHash(light)
      const darkHash = tryHash(dark)

      if (light) {
        light = light.split('#')[0].trim()
      }

      if (dark) {
        dark = dark.split('#')[0].trim()
      }

      if (theme === 'dark') {
        return [dark, darkHash?.slice(1) || '']
      } else {
        return [light, lightHash?.slice(1) || '']
      }
    } else {
      return [_icon, '']
    }
  }, [_icon, theme])

  const className = useMemo(() => {
    return clsx('dynamic-icon', _className)
  }, [_className])

  const style = useMemo(() => {
    const hashQuery = new URLSearchParams(hash)

    let filterStyles

    {
      const filter = hashQuery.get('filter')

      try {
        filterStyles = filter
          ? {
              filter:
                {
                  invert: 'invert(1)',
                  grayscale: 'grayscale(1)',
                  invertGrayscale: 'invert(1) grayscale(1)',
                }[filter] || getColorFilter(filter),
            }
          : undefined
      } catch {
        // pass
      }
    }

    let roundedStyles

    {
      const rounded = hashQuery.get('rounded')

      if (rounded) {
        roundedStyles = {
          borderRadius:
            {
              sm: '0.125rem',
              md: '0.375rem',
              lg: '0.5rem',
              xl: '0.75rem',
              full: '9999px',
            }[rounded] || (rounded.endsWith('%') ? rounded : '0.25rem'),
        }
      }
    }

    return {
      ...filterStyles,
      ...roundedStyles,

      ..._style,
    }
  }, [hash, _style])

  if (!icon) {
    return null
  }

  function ImgComponent(props) {
    return (
      <img
        {...props}
        alt={props.alt} // @note prevents eslint warning
        onError={
          fallbackIcon
            ? () => {
                setFallbackComponent(
                  <DynamicIcon
                    {...props}
                    className={_className}
                    style={_style}
                    componentClassName={componentClassName}
                    imageClassName={imageClassName}
                    iconClassName={iconClassName}
                    logoClassName={logoClassName}
                    icon={fallbackIcon}
                    fallbackIcon={null}
                  />
                )
              }
            : undefined
        }
      />
    )
  }

  switch (true) {
    // fallback

    case !!fallbackComponent: {
      return fallbackComponent
    }

    // components

    case isComponent(icon): {
      const Icon = icon

      return (
        <Icon
          {...props}
          className={clsx(className, componentClassName)}
          style={style}
        />
      )
    }

    // urls

    case icon.startsWith?.('blob:'):
    case icon.startsWith?.('data:'):
    case icon.startsWith?.('/'):
    case icon.startsWith?.('http://'):
    case icon.startsWith?.('https://'): {
      return (
        <ImgComponent
          alt="icon"
          {...props}
          className={clsx(className, imageClassName)}
          style={style}
          src={icon}
          referrerPolicy="no-referrer"
        />
      )
    }

    // special: blank

    case icon.startsWith?.('blank/'): {
      icon = `@${icon}`
    }

    case icon.startsWith?.('@blank/'): {
      return (
        <ImgComponent
          alt="blank"
          {...props}
          className={clsx('!bg-transparent', className, imageClassName)}
          style={style}
          src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
          referrerPolicy="no-referrer"
        />
      )
    }

    // cdn: heroicons

    case icon.startsWith?.('heroicons/'): {
      icon = `@${icon}`
    }

    case icon.startsWith?.('@heroicons/'): {
      let name = icon.slice('@heroicons/'.length)

      if (!name.startsWith('outline/') && !name.startsWith('solid/')) {
        name = `outline/${name}`
      }

      return (
        <ImgComponent
          alt={name}
          {...props}
          className={clsx(
            'dark:!invert', // @note we force the inversion because in some places we remove filters
            className,
            iconClassName
          )}
          style={style}
          src={`https://cdn.jsdelivr.net/npm/heroicons@2.1.1/24/${name}.svg`}
          referrerPolicy="no-referrer"
        />
      )
    }

    // cdn: lucide

    case icon.startsWith?.('lucide/'): {
      icon = `@${icon}`
    }

    case icon.startsWith?.('@lucide/'): {
      const name = icon.slice('@lucide/'.length)

      return (
        <ImgComponent
          alt={name}
          {...props}
          className={clsx(
            'dark:!invert', // @note we force the inversion because in some places we remove filters
            className,
            iconClassName
          )}
          style={style}
          src={`https://unpkg.com/lucide-static@0.513.0/icons/${name}.svg`}
          referrerPolicy="no-referrer"
        />
      )
    }

    // cdn: fontawesome

    case icon.startsWith('fontawesome/'): {
      icon = `@${icon}`
    }

    case icon.startsWith('@fontawesome/'): {
      const name = icon.slice('@fontawesome/'.length)

      return (
        <ImgComponent
          alt={name}
          {...props}
          className={clsx(className, iconClassName)}
          style={style}
          src={`https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.7.2/svgs/${name}.svg`}
          referrerPolicy="no-referrer"
        />
      )
    }

    // cdn: flat-color-icons

    case icon.startsWith?.('flat-color-icons/'): {
      icon = `@${icon}`
    }

    case icon.startsWith?.('@flat-color-icons/'): {
      const name = icon.slice('@flat-color-icons/'.length)

      return (
        <ImgComponent
          alt={name}
          {...props}
          className={clsx(className, iconClassName)}
          style={style}
          src={`https://cdn.jsdelivr.net/npm/flat-color-icons@1.1.0/svg/${name}.svg`}
          referrerPolicy="no-referrer"
        />
      )
    }

    // special: logo

    case icon.startsWith?.('logo/'): {
      icon = `@${icon}`
    }

    case icon.startsWith?.('@logo/'): {
      icon = icon.slice('@logo/'.length)

      try {
        if (!/^https?:\/\//i.test(icon)) {
          icon = `https://${icon}`
        }

        const url = new URL(icon)

        icon = `@${DEFAULT_LOGO_PROVIDER}/${url.hostname}`

        fallbackIcon ??= `@${DEFAULT_LOGO_FALLBACK_PROVIDER}/${url.hostname}`
      } catch {
        icon = ''
      }

      return (
        <DynamicIcon
          {...props}
          className={className}
          style={style}
          icon={icon}
          fallbackIcon={fallbackIcon}
        />
      )
    }

    // special: favicon

    case icon.startsWith?.('favicon/'): {
      icon = `@${icon}`
    }

    case icon.startsWith?.('@favicon/'): {
      icon = icon.slice('@favicon/'.length)

      try {
        if (!/^https?:\/\//i.test(icon)) {
          icon = `https://${icon}`
        }

        const url = new URL(icon)

        icon = `@${DEFAULT_FAVICON_PROVIDER}/${url.hostname}`

        fallbackIcon ??= `@${DEFAULT_FAVICON_FALLBACK_PROVIDER}/${url.hostname}`
      } catch {
        icon = ''
      }

      return (
        <DynamicIcon
          {...props}
          className={className}
          style={style}
          icon={icon}
          fallbackIcon={fallbackIcon}
        />
      )
    }

    // provider: clearbit (deprecated)

    case icon.startsWith?.('clearbit/'): {
      icon = `@${icon}`
    }

    case icon.startsWith?.('@clearbit/'): {
      icon = `@google/${icon.slice('@clearbit/'.length)}`

      return (
        <DynamicIcon
          {...props}
          className={className}
          style={style}
          icon={icon}
          fallbackIcon={fallbackIcon}
        />
      )
    }

    // provider: google

    case icon.startsWith?.('google/'): {
      icon = `@${icon}`
    }

    case icon.startsWith?.('@google/'): {
      const name = icon.slice('@google/'.length)

      return (
        <ImgComponent
          alt={name}
          {...props}
          className={clsx(className, logoClassName)}
          style={style}
          src={`https://www.google.com/s2/favicons?domain=${name}&sz=256`}
          referrerPolicy="no-referrer"
        />
      )
    }

    // provider: duckduckgo

    case icon.startsWith?.('duckduckgo/'): {
      icon = `@${icon}`
    }

    case icon.startsWith?.('@duckduckgo/'): {
      const name = icon.slice('@duckduckgo/'.length)

      return (
        <ImgComponent
          alt={name}
          {...props}
          className={clsx(className, logoClassName)}
          style={style}
          src={`https://icons.duckduckgo.com/ip3/${name}.ico`}
          referrerPolicy="no-referrer"
        />
      )
    }

    // provider: mockingmind

    case icon.startsWith?.('mockingmind/'): {
      icon = `@${icon}`
    }

    case icon.startsWith?.('@mockingmind/'): {
      const match = icon.match(/@mockingmind\/(\w+)\/(\d+)/)

      if (match) {
        const category = match[1]
        const number = match[2]

        return (
          <ImgComponent
            alt={`${category} ${number}`}
            {...props}
            className={clsx(className, imageClassName)}
            style={style}
            src={`https://mighty.tools/mockmind-api/content/${category}/${number}.jpg`}
            referrerPolicy="no-referrer"
          />
        )
      }

      break
    }

    // provider: gravatar

    case icon.startsWith?.('gravatar/'): {
      icon = `@${icon}`
    }

    case icon.startsWith?.('@gravatar/'): {
      const email = icon.slice('@gravatar/'.length).trim().toLowerCase()

      return (
        <GravatarIcon
          {...props}
          className={clsx(className, imageClassName)}
          style={style}
          email={email}
        />
      )
    }

    // provider: ui-avatars

    case icon.startsWith?.('ui-avatars/'): {
      icon = `@${icon}`
    }

    case icon.startsWith?.('@ui-avatars/'): {
      const name = icon.slice('@ui-avatars/'.length).trim()

      return (
        <ImgComponent
          alt={name}
          {...props}
          className={clsx(className, imageClassName)}
          style={style}
          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
            name
          )}&size=256&background=f3f4f6&color=111827&bold=true`}
          referrerPolicy="no-referrer"
        />
      )
    }

    // default

    default: {
      return (
        <Emoji
          {...props}
          className={clsx('leading-[1em]', className, iconClassName)}
          style={style}
        >
          {isEmoji(icon) ? icon : text2emoji(icon)}
        </Emoji>
      )
    }
  }
}
