import { useState } from 'react'
import { HexColorInput, RgbaStringColorPicker } from 'react-colorful'

import useControlledState from '@/hooks/useControlledState'

import {
  autoPlacement,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
} from '@floating-ui/react'

import clsx from 'clsx'

export const colorPickerFloatingPadding = 8
export const colorPickerReferenceOffset = 10

export default function ColorInput({
  className,

  defaultValue: _defaultValue,
  value: _value,
  setValue: _setValue,

  disabled,

  ...props
}) {
  const [value, setValue] = useControlledState(_defaultValue, _value, _setValue)

  const [isOpen, setIsOpen] = useState(false)

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,

    middleware: [
      autoPlacement({ padding: colorPickerFloatingPadding }),
      offset(colorPickerReferenceOffset),
      shift({ padding: colorPickerFloatingPadding }),
    ],
  })

  const click = useClick(context, {
    enabled: !disabled,
    toggle: true,
  })

  const dismiss = useDismiss(context, {
    enabled: !disabled,
    escapeKey: true,
    outsidePress: true,
  })

  const { getReferenceProps, getFloatingProps } = useInteractions([
    click,
    dismiss,
  ])

  return (
    <div
      {...props}
      className={clsx(
        'flex flex-row items-center gap-1',
        { disabled },
        className
      )}
    >
      <button
        ref={refs.setReference}
        {...getReferenceProps()}
        className="w-[1em] h-[1em] rounded cursor-pointer border border-gray-200 dark:border-gray-800"
        style={{ backgroundColor: value }}
        type="button"
      />
      <HexColorInput
        className="none-input [font-size:inherit] [line-height:inherit] w-full"
        color={value}
        onChange={setValue}
        alpha={true}
        disabled={disabled}
      />
      {isOpen && (
        <div
          ref={refs.setFloating}
          {...getFloatingProps()}
          style={floatingStyles}
          className="rounded-lg overflow-hidden bg-white border border-gray-500 dark:border-gray-500 space-y-1"
        >
          <RgbaStringColorPicker
            color={value}
            onChange={setValue}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  )
}
