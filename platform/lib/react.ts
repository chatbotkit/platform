import type {
  ComponentType,
  ForwardRefExoticComponent,
  MemoExoticComponent,
} from 'react'

interface ReactInternalComponent {
  $$typeof?: {
    toString(): string
  }
}

export function isFunctionComponent(
  component: unknown
): component is ComponentType {
  return typeof component === 'function'
}

export function isMemoComponent(
  component: unknown
): component is MemoExoticComponent<ComponentType> {
  return (
    typeof component === 'object' &&
    component !== null &&
    (component as ReactInternalComponent).$$typeof?.toString() ===
      'Symbol(react.memo)'
  )
}

export function isForwardRefComponent(
  component: unknown
): component is ForwardRefExoticComponent<ComponentType> {
  return (
    typeof component === 'object' &&
    component !== null &&
    (component as ReactInternalComponent).$$typeof?.toString() ===
      'Symbol(react.forward_ref)'
  )
}

export function isComponent(
  component: unknown
): component is
  | ComponentType
  | MemoExoticComponent<ComponentType>
  | ForwardRefExoticComponent<ComponentType> {
  return (
    isFunctionComponent(component) ||
    isMemoComponent(component) ||
    isForwardRefComponent(component)
  )
}
