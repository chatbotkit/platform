import ThemeDesigner from '@/components/ThemeDesigner'

import useControlledState from '@/hooks/useControlledState'

import clsx from 'clsx'

export default function ThemeBuilder({
  className,

  name,

  defaultValue: _defaultValue,
  value: _value,
  setValue: _setValue,

  defaultThemes,
  themes,
  setThemes,

  defaultTitle,
  title,
  onTitleChange,

  defaultIntro,
  intro,
  onIntroChange,

  defaultInitial,
  initial,
  onInitialChange,

  placeholder,

  barIcon,
  userIcon,
  botIcon,
  buttonIcon,

  tools,

  poweredBy,

  ...props
}) {
  const defaultTheme = _defaultValue

  const [theme, setTheme] = useControlledState(_defaultValue, _value, _setValue)

  return (
    <div
      {...props}
      className={clsx('theme-builder', 'flex flex-col', className)}
    >
      <input type="hidden" name={name} value={theme} />
      <ThemeDesigner
        className="flex-1 w-full h-full"
        defaultThemes={defaultThemes}
        themes={themes}
        setThemes={setThemes}
        defaultTheme={defaultTheme}
        theme={theme}
        setTheme={setTheme}
        defaultTitle={defaultTitle}
        title={title}
        onTitleChange={onTitleChange}
        defaultIntro={defaultIntro}
        intro={intro}
        onIntroChange={onIntroChange}
        defaultInitial={defaultInitial}
        initial={initial}
        onInitialChange={onInitialChange}
        placeholder={placeholder}
        barIcon={barIcon}
        userIcon={userIcon}
        botIcon={botIcon}
        buttonIcon={buttonIcon}
        tools={tools}
        poweredBy={poweredBy}
      />
    </div>
  )
}
