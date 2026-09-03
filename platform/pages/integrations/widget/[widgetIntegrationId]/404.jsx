import { makeJsonSafe } from '@/lib/struct'
import { useContext, useEffect } from 'react'

import Console from '@/components/Console'
import Emoji from '@/components/Emoji'
import Meta from '@/components/Meta'

import { ResizeContext, ResizeWrapper } from './frame'

export function Inner() {
  const { resize } = useContext(ResizeContext)

  // @todo appear smoothly using transition
  // @todo navigate to a special error page rather than chatbotkit

  useEffect(() => {
    resize('70px', '70px', 'open')
  }, [resize])

  return (
    <div className="p-2 inline-block overflow-hidden">
      <div className="rounded-full text-4xl w-[3rem] h-[3rem] flex items-center justify-center">
        <a href="/" target="_blank" rel="noopener">
          <Emoji>😞</Emoji>
        </a>
      </div>
    </div>
  )
}

export default function P404({ widgetIntegrationId }) {
  return (
    <>
      <Console
        message={`
    d8888   .d8888b.      d8888  
   d8P888  d88P  Y88b    d8P888  
  d8P 888  888    888   d8P 888  
 d8P  888  888    888  d8P  888  
d88   888  888    888 d88   888  
8888888888 888    888 8888888888 
      888  Y88b  d88P       888  
      888   "Y8888P"        888  

This ChatBotKit widget is not found!

Widget ID: ${widgetIntegrationId} 
`}
      />
      <ResizeWrapper className="w-[70px]">
        <Inner />
      </ResizeWrapper>
    </>
  )
}

P404.getLayout = function (children) {
  return (
    <>
      <Meta title="404" />
      {children}
    </>
  )
}

P404.theme = 'none' // ensure that the frame is not styled by the theme

export async function getServerSideProps(context) {
  return {
    props: makeJsonSafe({
      widgetIntegrationId: context.params.widgetIntegrationId,
    }),
  }
}
