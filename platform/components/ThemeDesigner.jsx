import { useEffect, useMemo } from 'react'

import demosData from '@/data/demos.yaml'

import ThemeCanvas from '@/components/ThemeCanvas'
import {
  SchemaPanelModeProvider,
  SchemaPanelPositionProvider,
} from '@/components/SchemaPanel'
import ThemePanel from '@/components/ThemePanel'
import WidgetPreview from '@/components/WidgetPreview'

import useControlledState from '@/hooks/useControlledState'

import clsx from 'clsx'

export default function ThemeDesigner({
  className,

  defaultDemo: _defaultDemo = 'default',
  demo: _demo,
  setDemo: _setDemo,

  defaultThemes: _defaultThemes,
  themes: _themes,
  setThemes: _setThemes,

  defaultTheme: _defaultTheme,
  theme: _theme,
  setTheme: _setTheme,

  defaultTitle: _defaultTitle,
  title: _title,
  onTitleChange: _onTitleChange,

  defaultIntro: _defaultIntro,
  intro: _intro,
  onIntroChange: _onIntroChange,

  defaultInitial: _defaultInitial,
  initial: _initial,
  onInitialChange: _onInitialChange,

  messages,

  placeholder,

  barIcon,
  userIcon,
  botIcon,
  buttonIcon,

  tools,

  poweredBy,

  fullscreenToggle = true,

  defaultPanelHidden: _defaultPanelHidden = true,
  panelHidden: _panelHidden,
  setPanelHidden: _setPanelHidden,

  defaultFullscreen: _defaultFullscreen = false,
  fullscreen: _fullscreen,
  setFullscreen: _setFullscreen,

  ...props
}) {
  // create controlled states

  const [demo, setDemo, defaultDemo] = useControlledState(
    _defaultDemo,
    _demo,
    _setDemo
  )

  const [theme, setTheme, defaultTheme] = useControlledState(
    _defaultTheme,
    _theme,
    _setTheme
  )

  const [title, setTitle, defaultTitle] = useControlledState(
    _defaultTitle,
    _title,
    _onTitleChange
  )

  const [intro, setIntro, defaultIntro] = useControlledState(
    _defaultIntro,
    _intro,
    _onIntroChange
  )

  const [initial, setInitial, defaultInitial] = useControlledState(
    _defaultInitial,
    _initial,
    _onInitialChange
  )

  const [panelHidden, setPanelHidden, defaultPanelHidden] = useControlledState(
    _defaultPanelHidden,
    _panelHidden,
    _setPanelHidden
  )

  const [fullscreen, setFullscreen] = useControlledState(
    _defaultFullscreen,
    _fullscreen,
    _setFullscreen
  )

  // sync panel hidden

  useEffect(() => {
    setPanelHidden(!fullscreen)
  }, [fullscreen, setPanelHidden])

  // update properties based on the controls

  const previewTitle = useMemo(() => {
    return title ?? demosData[demo]?.title
  }, [title, demo])

  const previewIntro = useMemo(() => {
    return intro ?? demosData[demo]?.intro
  }, [intro, demo])

  const previewInitial = useMemo(() => {
    return initial ?? demosData[demo]?.initial
  }, [initial, demo])

  const previewMessages = useMemo(() => {
    return messages ?? demosData[demo]?.messages
  }, [messages, demo])

  // render

  return (
    <SchemaPanelModeProvider storageKey="theme-designer:panel:mode">
      <SchemaPanelPositionProvider>
        <ThemePanel
          // demo
          defaultDemo={defaultDemo}
          demo={demo}
          setDemo={setDemo}
          // themes
          defaultThemes={_defaultThemes}
          themes={_themes}
          setThemes={_setThemes}
          // theme
          defaultTheme={defaultTheme}
          theme={theme}
          setTheme={setTheme}
          // title
          defaultTitle={defaultTitle}
          title={title}
          onTitleChange={setTitle}
          // intro
          defaultIntro={defaultIntro}
          intro={intro}
          onIntroChange={setIntro}
          // initial
          defaultInitial={defaultInitial}
          initial={initial}
          onInitialChange={setInitial}
          // panelHidden
          defaultPanelHidden={defaultPanelHidden}
          panelHidden={panelHidden}
          setPanelHidden={setPanelHidden}
        />
      </SchemaPanelPositionProvider>
      <div
        {...props}
        className={clsx('theme-designer', 'flex flex-col relative', className)}
      >
        <ThemeCanvas
          className="flex-1 w-full h-full"
          fullscreen={fullscreen}
          setFullscreen={setFullscreen}
          fullscreenToggle={fullscreenToggle}
        >
          <WidgetPreview
            key={`widget-preview-${demo}`} // @note needed to re-render the widget messages
            title={previewTitle}
            intro={previewIntro}
            initial={previewInitial}
            messages={previewMessages}
            placeholder={placeholder}
            barIcon={barIcon}
            userIcon={userIcon}
            botIcon={botIcon}
            buttonIcon={buttonIcon}
            tools={tools}
            poweredBy={poweredBy}
            theme={theme}
            button={true}
            interactive={true}
          />
        </ThemeCanvas>
        <div className="absolute left-4 bottom-4">
          <button
            className="primary-button small"
            type="button"
            onClick={() => setPanelHidden((hidden) => !hidden)}
          >
            Design Panel
          </button>
        </div>
      </div>
    </SchemaPanelModeProvider>
  )
}
