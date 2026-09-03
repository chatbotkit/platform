/* eslint-disable no-restricted-globals */
import { useEffect, useRef, useState } from 'react'

import Head from 'next/head'
import Script from 'next/script'

import { readSource } from '@/lib/source'
import { makeJsonSafe } from '@/lib/struct'

import Demo, { SideBySidePage } from '@/layouts/Demo'

import DotsLoader from '@/components/DotsLoader'

// source start
import useWidgetInstance from '@chatbotkit/react/hooks/useWidgetInstance'

import clsx from 'clsx'

/**
 * The example demonstrates how to use client-side functions to interact with
 * the ChatBotKit AI Widget. The example allows an AI bot to control a Mapbox
 * globe, flying to different locations around the world via chat messages.
 */
export default function Page({ mapboxToken }) {
  const mapContainerRef = useRef(null)

  const mapRef = useRef(null)

  const [mapboxLoaded, setMapboxLoaded] = useState(false)

  const widget = useWidgetInstance('chatbotkit-widget', {
    waitForReady: true,
  })

  useEffect(() => {
    if (!mapContainerRef.current || !mapboxLoaded || !window.mapboxgl) {
      return
    }

    const map = new window.mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      projection: 'globe',
      center: [0, 20],
      zoom: 1.5,
      accessToken: mapboxToken,
    })

    map.addControl(new window.mapboxgl.NavigationControl())

    map.on('load', () => {
      map.setFog({
        color: 'rgb(220, 220, 220)',
        'high-color': 'rgb(240, 240, 240)',
        'horizon-blend': 0.02,
        'space-color': 'rgb(243, 244, 246)',
        'star-intensity': 0,
      })
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [mapboxLoaded, mapboxToken])

  useEffect(() => {
    // if the widget is not ready, do nothing

    if (!widget) {
      return
    }

    // setup the functions available to the widget AI bot

    widget.functions = {
      flyTo: {
        description: 'Fly the map to a specific location with coordinates',
        parameters: {
          type: 'object',
          properties: {
            longitude: {
              type: 'number',
              description: 'The longitude coordinate (-180 to 180)',
            },
            latitude: {
              type: 'number',
              description: 'The latitude coordinate (-90 to 90)',
            },
            zoom: {
              type: 'number',
              description: 'The zoom level (0-22, default is 10)',
            },
            duration: {
              type: 'number',
              description:
                'Animation duration in milliseconds (default is 3000)',
            },
          },
          required: ['longitude', 'latitude'],
        },
        handler: async ({
          longitude,
          latitude,
          zoom = 10,
          duration = 3000,
        }) => {
          if (!mapRef.current) {
            return { success: false, error: 'Map not initialized' }
          }

          mapRef.current.flyTo({
            center: [longitude, latitude],
            zoom: zoom,
            duration: duration,
            essential: true,
          })

          return {
            success: true,
            location: { longitude, latitude, zoom },
          }
        },
      },

      flyToPlace: {
        description:
          'Fly the map to a named place or city. Use this when the user mentions a city or location name.',
        parameters: {
          type: 'object',
          properties: {
            place: {
              type: 'string',
              description: 'The name of the place, city, or landmark',
            },
            zoom: {
              type: 'number',
              description: 'The zoom level (0-22, default is 10)',
            },
          },
          required: ['place'],
        },
        handler: async ({ place, zoom = 10 }) => {
          try {
            const response = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
                place
              )}.json?access_token=${mapboxToken}`
            )

            const data = await response.json()

            if (!data.features || data.features.length === 0) {
              return { success: false, error: `Location "${place}" not found` }
            }

            const [longitude, latitude] = data.features[0].center

            if (!mapRef.current) {
              return { success: false, error: 'Map not initialized' }
            }

            mapRef.current.flyTo({
              center: [longitude, latitude],
              zoom: zoom,
              duration: 3000,
              essential: true,
            })

            return {
              success: true,
              place: data.features[0].place_name,
              location: { longitude, latitude, zoom },
            }
          } catch (error) {
            return { success: false, error: error.message }
          }
        },
      },

      setZoom: {
        description: 'Set the zoom level of the map',
        parameters: {
          type: 'object',
          properties: {
            zoom: {
              type: 'number',
              description: 'The zoom level (0-22)',
            },
          },
          required: ['zoom'],
        },
        handler: async ({ zoom }) => {
          if (!mapRef.current) {
            return { success: false, error: 'Map not initialized' }
          }

          mapRef.current.setZoom(zoom)

          return { success: true, zoom }
        },
      },

      setPitch: {
        description: 'Set the pitch (tilt) of the map camera',
        parameters: {
          type: 'object',
          properties: {
            pitch: {
              type: 'number',
              description: 'The pitch angle in degrees (0-85)',
            },
          },
          required: ['pitch'],
        },
        handler: async ({ pitch }) => {
          if (!mapRef.current) {
            return { success: false, error: 'Map not initialized' }
          }

          mapRef.current.setPitch(pitch)

          return { success: true, pitch }
        },
      },

      setBearing: {
        description: 'Set the bearing (rotation) of the map',
        parameters: {
          type: 'object',
          properties: {
            bearing: {
              type: 'number',
              description: 'The bearing angle in degrees (0-360)',
            },
          },
          required: ['bearing'],
        },
        handler: async ({ bearing }) => {
          if (!mapRef.current) {
            return { success: false, error: 'Map not initialized' }
          }

          mapRef.current.setBearing(bearing)

          return { success: true, bearing }
        },
      },

      resetView: {
        description: 'Reset the map to the default globe view',
        parameters: {
          type: 'object',
          properties: {},
        },
        handler: async () => {
          if (!mapRef.current) {
            return { success: false, error: 'Map not initialized' }
          }

          mapRef.current.flyTo({
            center: [0, 20],
            zoom: 1.5,
            pitch: 0,
            bearing: 0,
            duration: 2000,
            essential: true,
          })

          return { success: true }
        },
      },
    }
  }, [widget, mapboxToken])

  return (
    <>
      <Head>
        <link
          href="https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css"
          rel="stylesheet"
        />
      </Head>
      <Script
        src="https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.js"
        onLoad={() => setMapboxLoaded(true)}
      />
      <SideBySidePage className="bg-gray-100">
        <div className="w-full h-full relative bg-gray-100">
          <div
            ref={mapContainerRef}
            className="w-full h-full overflow-hidden bg-gray-100 rounded-xl"
          />
        </div>
        <div className="relative border border-1 border-gray-200 rounded-xl overflow-hidden flex min-w-[30rem] max-w-[60rem] shadow-lg bg-white">
          <chatbotkit-widget
            class="flex-1 w-full h-full"
            widget="/examples/world-map/frame"
          />
          <div
            className={clsx(
              'absolute inset-0 flex items-center justify-center',
              {
                hidden: !!widget,
              }
            )}
          >
            <DotsLoader className="text-xl text-gray-500 dark:text-gray-500" />
          </div>
        </div>
      </SideBySidePage>
    </>
  )
}

// source end

Page.getLayout = function getLayout(children, { source }) {
  return (
    <Demo
      title="World Map Control"
      description="This demo shows how to use client-side functions to control a Mapbox globe with the ChatBotKit AI Widget."
      slug="world-map"
      source={source}
    >
      {children}
    </Demo>
  )
}

Page.theme = 'light'

export async function getStaticProps() {
  const source = readSource('./pages/examples/world-map/demo/index.jsx')

  return {
    props: makeJsonSafe({
      source,

      // @note public token for demo purposes only

      mapboxToken:
        'pk.eyJ1IjoicGRwYXJjaGl0ZWN0IiwiYSI6ImNtZ2gzNWt3dTBuNW0ybHM1bWtiNzY5OWQifQ.k-Z6yDKsrB6AkuBHupzRwQ',
    }),
  }
}
