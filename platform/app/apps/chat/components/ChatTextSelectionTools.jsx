'use client'

import { memo, useCallback, useEffect, useState } from 'react'
import { LuMessageCircleMore } from 'react-icons/lu'

import FloatingBox from '@/components/FloatingBox'
import PopButton from '@/components/PopButton'
import TextSelectionTools from '@/components/TextSelectionTools'

import { ClipForm } from './Form'

export function ChatTextSelectionTools({ target, appendClip }) {
  const [text, setText] = useState(null)
  const [rect, setRect] = useState(null)
  const [location, setLocation] = useState(null)

  const handleTextSelectionChange = useCallback(({ text, rect }) => {
    if (text) {
      setText(text)
    }

    if (rect) {
      setRect(rect)
    }
  }, [])

  const handleBeforeOpen = useCallback(({ location }) => {
    if (location) {
      setLocation(location)
    }
  }, [])

  useEffect(() => {
    if (!text) {
      return
    }

    function onKeyDown(event) {
      if (event.key === 'i' && event.metaKey) {
        setLocation({ x: rect.x, y: rect.y })
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [text, rect])

  return (
    <>
      <TextSelectionTools
        target={target}
        delay={1000}
        onTextSelectionChange={handleTextSelectionChange}
      >
        <div>
          <PopButton
            className="default-button push"
            caption={<LuMessageCircleMore />}
            onBeforeOpen={handleBeforeOpen}
            transitionStyles="scale"
          >
            <div
            // @note div required in order to trigger rendering
            />
          </PopButton>
        </div>
      </TextSelectionTools>
      {!!text && !!location ? (
        <FloatingBox
          strategy="fixed"
          x={location.x}
          y={location.y}
          offset={5}
          allowedPlacements={['top', 'bottom', 'left', 'right']}
          transitionStyles="scale"
          onUnmount={() => {
            setText(null)
            setLocation(null)
          }}
        >
          {({ close }) => {
            return (
              <ClipForm
                text={text}
                onSubmit={({ comment }) => {
                  appendClip({ text, comment })

                  close()
                }}
                onCancel={() => {
                  close()
                }}
              />
            )
          }}
        </FloatingBox>
      ) : null}
    </>
  )
}

ChatTextSelectionTools.Memo = memo(ChatTextSelectionTools)

export default ChatTextSelectionTools
