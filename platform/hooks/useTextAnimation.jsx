import { useEffect, useState } from 'react'

export default function useTextAnimation({
  texts,

  typingSpeed,

  deletingSpeed,

  delayBetweenTexts,

  disabled,
}) {
  const [text, setText] = useState('')
  const [index, setIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const [delay, setDelay] = useState(false)

  useEffect(() => {
    if (disabled) {
      setText('')

      return
    }

    if (!texts || texts.length === 0) {
      setText('')

      return
    }

    if (delay) {
      const delayTimeout = setTimeout(() => {
        setDelay(false)
        setIsDeleting((prev) => !prev)
      }, delayBetweenTexts)

      return () => clearTimeout(delayTimeout)
    }

    let timeoutId

    if (!isDeleting) {
      if (text !== texts[index]) {
        timeoutId = setTimeout(() => {
          setText(
            (currentText) => currentText + texts[index][currentText.length]
          )
        }, typingSpeed)
      } else {
        setDelay(true)
      }
    } else {
      if (text.length > 0) {
        timeoutId = setTimeout(() => {
          setText((currentText) => currentText.slice(0, -1))
        }, deletingSpeed)
      } else {
        setDelay(true)
        setIndex((currentIndex) => (currentIndex + 1) % texts.length)
      }
    }

    return () => timeoutId && clearTimeout(timeoutId)
  }, [
    texts,

    typingSpeed,

    deletingSpeed,

    delayBetweenTexts,

    disabled,

    text,

    index,

    isDeleting,

    delay,
  ])

  return text
}
