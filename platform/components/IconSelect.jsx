import { useCallback, useRef, useState } from 'react'

import Emoji from '@/components/Emoji'

import useClickOutside from '@/hooks/useClickOutside'
import useControllableInput from '@/hooks/useControllableInput'
import useTheme from '@/hooks/useTheme'

import clsx from 'clsx'
import emojiNameMap from 'emoji-name-map'
import EmojiPicker from 'emoji-picker-react'
import emojiUnicodeMap from 'emoji-unicode-map'

export default function IconSelect({
  name: inputName,

  defaultValue: _defaultValue,
  value: _value,
  setValue: _setValue,
  onChange: _onChange,

  disabled,

  className,

  ...props
}) {
  const emojiPickerRef = useRef()

  const { theme } = useTheme()

  const [value, onChange, setValue] = useControllableInput({
    defaultValue: _defaultValue,
    value: _value,
    setValue: _setValue,
    onChange: _onChange,
  })

  const [hidden, setHidden] = useState(true)

  const close = useCallback(() => setHidden(true), [])

  useClickOutside(emojiPickerRef, close)

  function handleOnClick() {
    if (disabled) {
      return
    }

    setHidden(!hidden)
  }

  function handleEmojiClick(emojiObject, _event) {
    let name = emojiUnicodeMap.get(emojiObject.emoji)

    if (!name) {
      const alts = emojiObject.names
        .map((name) => [name, ...name.split(/\s+/g)])
        .flat(1)
        .map((name) => name.replace(/\s+/g, '_'))
        .filter((name) => !!emojiNameMap.get(name))

      name = alts[0]
    }

    if (!name) {
      return
    }

    setValue(`:${name}:`)

    setHidden(true)
  }

  return (
    <div>
      {hidden ? null : (
        <div className="absolute z-50 [&_*]:!font-sans" ref={emojiPickerRef}>
          <EmojiPicker
            theme={theme}
            emojiStyle="twitter"
            onEmojiClick={handleEmojiClick}
          />
        </div>
      )}
      <div
        {...props}
        className={clsx(
          'rounded-xl border auto-border-gray-300 text-4xl w-16 h-16 p-2 flex items-center justify-center cursor-pointer',
          className
        )}
        onClick={handleOnClick}
      >
        <input
          className="hidden"
          name={inputName}
          value={value}
          onChange={onChange}
        />
        <Emoji>{(value ? emojiNameMap.get(value) : '') || '\xa0'}</Emoji>
      </div>
    </div>
  )
}
