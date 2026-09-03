'use client'

import { memo, useState } from 'react'
import { LuX } from 'react-icons/lu'

import toast from '@/lib/toast'

import AutoTextarea from '@/components/AutoTextarea'

import clsx from 'clsx'

export function GenericForm({
  title,

  cancelCaption = 'Cancel',
  submitCaption = 'Submit',

  onSubmit,
  onCancel,

  className,

  disabled,

  children,

  ...props
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event?.preventDefault()

    setIsSubmitting(true)

    try {
      await onSubmit?.({})
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleCancel(event) {
    event?.preventDefault()

    onCancel?.({})
  }

  return (
    <div
      {...props}
      className={clsx(
        'auto-bg-white auto-text-black',
        'border auto-border-gray-200 rounded-xl',
        'p-4 shadow-lg',
        'w-80',
        className
      )}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-row gap-2 items-center text-sm">
          <h3 className="font-semibold w-full flex-1">{title}</h3>
          <LuX className="cursor-pointer" onClick={handleCancel} />
        </div>
        <div>
          {typeof children === 'function'
            ? children({
                isSubmitting,

                submit: () => handleSubmit(),
                cancel: () => handleCancel(),
              })
            : children}
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="default-button rounded-lg text-xs"
            disabled={isSubmitting}
          >
            {cancelCaption}
          </button>
          <button
            type="submit"
            className="primary-button rounded-lg text-xs"
            disabled={disabled || isSubmitting}
          >
            {submitCaption}
          </button>
        </div>
      </form>
    </div>
  )
}

GenericForm.Memo = memo(GenericForm)

export function FeedbackForm({ onSubmit, onCancel, className, ...props }) {
  const [feedback, setFeedback] = useState('')

  async function handleSubmit() {
    if (!feedback.trim()) {
      return
    }

    try {
      await onSubmit({ reason: feedback.trim() })

      toast.success('Thank you for your feedback!')
    } catch {
      toast.error('Failed to submit feedback. Please try again.')
    }
  }

  return (
    <GenericForm
      {...props}
      title="Why wasn't this helpful?"
      onSubmit={handleSubmit}
      onCancel={onCancel}
      disabled={!feedback.trim()}
      className={className}
    >
      {({ isSubmitting, submit, cancel }) => {
        return (
          <div className="space-y-4">
            <div>
              <label className="text-xs auto-text-gray-600 block mb-1.5">
                Tell us more (optional):
              </label>
              <AutoTextarea
                className="default-input tiny max-h-96"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault()

                    cancel()

                    return
                  }

                  if (e.key === 'Enter' && e.metaKey) {
                    e.preventDefault()

                    submit()

                    return
                  }
                }}
                placeholder="What could have been better?"
                autoFocus={true}
                disabled={isSubmitting}
              />
            </div>
          </div>
        )
      }}
    </GenericForm>
  )
}

FeedbackForm.Memo = memo(FeedbackForm)

export function ClipForm({ onSubmit, onCancel, text, ...props }) {
  const [comment, setComment] = useState('')

  async function handleSubmit() {
    if (!comment.trim()) {
      return
    }

    try {
      await onSubmit({ comment: comment.trim() })
    } catch {
      toast.error('Failed to add clip. Please try again.')
    }
  }

  return (
    <GenericForm
      {...props}
      title="Add clip"
      onSubmit={handleSubmit}
      onCancel={onCancel}
      disabled={!comment.trim()}
    >
      {({ isSubmitting, submit, cancel }) => {
        return (
          <div className="space-y-4">
            <div className="text-xs italic line-clamp-2">{text}</div>
            <div>
              <label className="text-xs auto-text-gray-600 block mb-1.5">
                Your comment:
              </label>
              <AutoTextarea
                className="default-input max-h-96 rounded-lg p-2 text-xs"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault()

                    cancel()

                    return
                  }

                  if (e.key === 'Enter' && e.metaKey) {
                    e.preventDefault()

                    submit()

                    return
                  }
                }}
                placeholder="What do you think?"
                autoFocus={true}
                disabled={isSubmitting}
              />
            </div>
          </div>
        )
      }}
    </GenericForm>
  )
}

ClipForm.Memo = memo(ClipForm)
