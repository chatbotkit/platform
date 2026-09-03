import { useCallback, useMemo, useRef } from 'react'
import { MdCopyAll } from 'react-icons/md'

import CopyButton from '@/components/CopyButton'
import InputArea from '@/components/InputArea'

import useControllableInput from '@/hooks/useControllableInput'

import { XMarkIcon } from '@heroicons/react/24/outline'

import clsx from 'clsx'

export default function CommaListSelect({
  className,

  name: inputName,

  defaultValue: _defaultValue = '',
  value: _value,
  setValue: _setValue,
  onChange: _onChange,

  placeholder,

  spellCheck,

  autoTrim = true,

  ...props
}) {
  const [value, onChange, setValue] = useControllableInput({
    defaultValue: _defaultValue,
    value: _value,
    setValue: _setValue,
    onChange: _onChange,
  })

  const valueToList = useCallback(
    (value) => {
      if (!value) {
        return []
      }

      return Array.from(
        new Set(
          value
            .split(',')
            .map((s) => (autoTrim ? s.trim() : s))
            .filter((s) => s)
        )
      )
    },
    [autoTrim]
  )

  const listToValue = useCallback((list) => {
    if (!list || !list.length) {
      return ''
    }

    return list.join(',')
  }, [])

  const selectedItems = useMemo(() => {
    return valueToList(value)
  }, [value, valueToList])

  const addSelectedItem = useCallback(
    (item) => {
      if (!item) {
        return
      }

      const items = valueToList(value)

      if (items.includes(item)) {
        return
      }

      setValue(listToValue([...items, item]))
    },
    [value, setValue, valueToList, listToValue]
  )

  const moveSelectedItem = useCallback(
    (index, toIndex) => {
      if (index === toIndex) {
        return
      }

      const items = valueToList(value)

      if (index < 0 || index >= items.length) {
        return
      }

      if (toIndex < 0 || toIndex >= items.length) {
        return
      }

      if (items[index] === items[toIndex]) {
        return
      }

      const newItems = [...items]

      const item = newItems[index]

      newItems.splice(index, 1)
      newItems.splice(toIndex, 0, item)

      setValue(listToValue(newItems))
    },
    [value, setValue, valueToList, listToValue]
  )

  const removeSelectedItem = useCallback(
    (item) => {
      const items = valueToList(value)

      if (!items.includes(item)) {
        return
      }

      setValue(listToValue(items.filter((l) => l !== item)))
    },
    [value, setValue, valueToList, listToValue]
  )

  // @note drag and drop implementation inspired by https://medium.com/nerd-for-tech/simple-drag-and-drop-in-react-without-an-external-library-ebf1c1b809e

  const dragItem = useRef()
  const dragOverItem = useRef()

  function onDragStart(event) {
    dragItem.current = event.target.dataset.index
  }

  function onDragEnter(event) {
    dragOverItem.current = event.currentTarget.dataset.index
  }

  function onDragEnd() {
    moveSelectedItem(dragItem.current, dragOverItem.current)

    dragItem.current = null
    dragOverItem.current = null
  }

  function onDragOver(event) {
    event.preventDefault()
  }

  return (
    <div
      tabIndex={0}
      {...props}
      className={clsx('flex flex-col justify-center items-center', className)}
      onDragOver={onDragOver}
    >
      <input
        className="hidden"
        name={inputName}
        type="text"
        value={value}
        onChange={onChange}
      />
      <InputArea
        className="text-sm none-input w-full p-0"
        placeholder={placeholder}
        spellCheck={spellCheck}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()

            let value = event.target.value

            if (autoTrim) {
              value = value.trim()

              if (!value) {
                return
              }
            }

            addSelectedItem(value)

            event.target.value = ''
          }
        }}
        onBlur={(event) => {
          event.preventDefault()

          let value = event.target.value

          if (autoTrim) {
            value = value.trim()

            if (!value) {
              return
            }
          }

          addSelectedItem(value)

          event.target.value = ''
        }}
      />
      {selectedItems.length ? (
        <div className="flex flex-row gap-1 w-full mt-2">
          <div className="flex flex-row flex-wrap gap-1 w-full">
            {selectedItems.map((item, index) => (
              <div
                key={item}
                className={clsx(
                  'default-button small push',
                  'flex items-center',
                  'cursor-grab',

                  // @note helpers render translucent corners when dragging
                  'translate-x-0'
                )}
                onDragStart={onDragStart}
                onDragEnter={onDragEnter}
                onDragEnd={onDragEnd}
                onDragOver={onDragOver}
                draggable
                data-index={index}
              >
                <div>
                  {item === '' ? (
                    <span className="text-gray-400">Empty</span>
                  ) : item === ' ' ? (
                    <span className="text-gray-400">Space</span>
                  ) : /^\s+$/.test(item) ? (
                    <span className="text-gray-400">
                      Whitespace {item.length}
                    </span>
                  ) : (
                    item
                  )}
                </div>
                <XMarkIcon
                  className="w-4 h-4 cursor-pointer"
                  onClick={() => {
                    removeSelectedItem(item)
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex-1" />
          <div className="flex flex-col">
            <CopyButton className="h-[1em] aspect-square" text={value}>
              <MdCopyAll />
            </CopyButton>
          </div>
        </div>
      ) : null}
    </div>
  )
}
