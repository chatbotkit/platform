export interface AppManifest {
  /**
   * The start path of the app. This is useful to define a specific entry
   * point for the app if it is not served from the root of the host.
   */
  start: string

  name: string
  description: string

  headline?: string

  /**
   * A icon image URL for the app, can also use @pack/name syntax to refer to
   * a package asset used by DynamicIcon component.
   */
  icon?: string

  /**
   * Similar to icon, but a larger image used in app listings and detailed
   * views.
   */
  logo?: string

  /**
   * An optional banner image URL for the app. When set, the app is rendered as
   * a prominent banner in app listings, displaying its name, description and a
   * button to access the app on top of the image.
   */
  banner?: string

  /**
   * The order in which the app should be displayed in listings and navigation.
   */
  order?: number

  /**
   * The category of the app for organizational purposes.
   */
  category?:
    | 'main'
    | 'support'
    | 'admin'
    | 'user'
    | 'developer'
    | 'help'
    | 'other'
    | 'lab'
    | 'service'

  /**
   * A configuration applied to the app when used from the host. This config is
   * not available when used from portals or when accessed directly in the
   * dashboard.
   */
  config?: Record<string, unknown>

  /**
   * A global configuration available to the app in all contexts.
   */
  global?: Record<string, unknown>

  /**
   * Whether the app should be hidden from app listings and navigation.
   */
  hidden?: boolean
}

declare module '@/app/apps/*/app.manifest' {
  export type AppManifest = globalThis.AppManifest

  const manifest: AppManifest
  export default manifest
}

declare module '**/app.manifest' {
  export type AppManifest = globalThis.AppManifest

  const manifest: AppManifest
  export default manifest
}
