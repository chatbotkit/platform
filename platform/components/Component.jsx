import { Fragment, createElement, forwardRef } from 'react'

export const Component = forwardRef(function Component(
  { as = Fragment, ...props },
  forwardedRef
) {
  const element = as ? createElement(as, { ref: forwardedRef, ...props }) : null

  return <>{element}</>
})

export default Component
