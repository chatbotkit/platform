export { CONTACT_NAMESPACE } from '../const'

export const APP_NAME = 'code'

/**
 * The routes a minted coding token is scoped to. The token can only call the
 * stateless `conversation/complete` endpoint and nothing else.
 */
export const TOKEN_ALLOWED_ROUTES = ['conversation/complete']

/**
 * Marker stored in `meta.app` of every token minted by this app so the app
 * only ever lists and revokes the tokens it created itself.
 */
export const TOKEN_META_APP = 'code'
