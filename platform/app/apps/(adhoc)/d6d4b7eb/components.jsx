'use client'

import { useState } from 'react'

import { captureException } from '@/lib/error'
import { formToData } from '@/lib/form'
import toast from '@/lib/toast'

import { AppScene } from '@/layouts/App'

import AutoTextarea from '@/components/AutoTextarea'

import { updateProfile } from './server'

import clsx from 'clsx'

export function Form({ contact, className, children, ...props }) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()

    const data = formToData(event.target)

    if (!data) {
      return
    }

    toast.loading('Saving changes...')

    setIsSubmitting(true)

    try {
      const result = await updateProfile(data)

      if (result?.error) {
        toast.error(result.error)

        return
      }
    } catch (error) {
      await captureException(error)

      toast.error('An unexpected error occurred. Please try again.')
    } finally {
      toast.dismiss()

      setIsSubmitting(false)
    }
  }

  return (
    <form className={clsx('space-y-6')} onSubmit={handleSubmit}>
      <fieldset className="space-y-4" disabled={isSubmitting}>
        {/* name */}
        <div>
          <label className="default-label" htmlFor="name">
            Full Name
          </label>
          <div className="mt-1">
            <input
              className="default-input w-full"
              id="name"
              name="name"
              defaultValue={contact.name}
              placeholder="Enter your full name"
            />
          </div>
          <p className="input-description">
            Your full name as you&apos;d like it to appear in your profile.
          </p>
        </div>
        {/* description */}
        <div>
          <label className="default-label" htmlFor="description">
            Description
          </label>
          <div className="mt-1">
            <AutoTextarea
              className="default-input w-full"
              id="description"
              name="description"
              defaultValue={contact.description}
              placeholder="Tell us a bit about yourself..."
            />
          </div>
          <p className="input-description">
            A brief description about yourself.
          </p>
        </div>
        {/* preferences */}
        <div>
          <label className="default-label" htmlFor="preferences">
            Preferences
          </label>
          <div className="mt-1">
            <AutoTextarea
              className="default-input w-full"
              id="preferences"
              name="preferences"
              defaultValue={contact.preferences}
              placeholder="Your preferences..."
            />
          </div>
          <p className="input-description">
            Any specific preferences or settings you would like to note. This
            will help us tailor your experience.
          </p>
        </div>
      </fieldset>
      <div className="flex items-center space-x-4">
        <button
          type="submit"
          className="primary-button"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : 'Save'}
        </button>
      </div>
      {children}
    </form>
  )
}

function Scene({ className, ...props }) {
  return (
    <AppScene
      {...props}
      className={clsx('scene', className)}
      name={null}
      headline="Personal Information"
      description="Update your name and description to personalize your profile."
    />
  )
}

export function Main({ contact }) {
  return (
    <>
      {/* scene */}
      <Scene compact={true} />
      {/* secret */}
      <Form contact={contact} />
    </>
  )
}
