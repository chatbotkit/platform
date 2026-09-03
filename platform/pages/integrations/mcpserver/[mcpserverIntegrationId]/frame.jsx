import 'katex/dist/katex.min.css'

import { makeJsonSafe } from '@/lib/struct'

/*****************************************
 * SECTION: Frame
 *****************************************/

/**
 *
 */
export default function Frame() {
  return <h1>Hello world</h1>
}

Frame.getLayout = function (children) {
  return <>{children}</>
}

Frame.theme = 'none' // ensure that the frame is not styled by the theme

/*****************************************
 * SECTION: Server Side Rendering
 *****************************************/

// @note uncomment to turn off SSR
// @note for some reason turning it of also setups the frame background
// export default dynamic(() => Promise.resolve(Frame), {
//   ssr: false,
// })

/*****************************************
 * SECTION: Server Side Props
 *****************************************/

/**
 *
 */
export async function getServerSideProps(context) {
  return {
    props: makeJsonSafe({
      // @note add any props needed for the frame here
    }),
  }
}
