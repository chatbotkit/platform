// @ts-ignore because there are no types
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm'

import type { ReactElement } from 'react'

import { Resvg, initWasm } from '@resvg/resvg-wasm'

import satori, { type SatoriOptions } from 'satori'

/**
 * Initializes the resvg WebAssembly module for SVG-to-PNG conversion. Silently
 * ignores errors if already initialized.
 */
async function initResvg(): Promise<void> {
  const wasmBuffer = new Uint8Array((resvgWasm as { data: ArrayBuffer }).data)
  const wasmModule = WebAssembly.compile(wasmBuffer)

  try {
    await initWasm(wasmModule)
  } catch {
    // pass
  }
}

const initResvgPromise = initResvg()

/**
 * Renders a React element to a PNG image by first converting it to SVG using
 * satori, then rasterizing the SVG to PNG using resvg.
 */
export async function generateImage(
  element: ReactElement,
  options: SatoriOptions
): Promise<Uint8Array | null> {
  await initResvgPromise

  const svg = await satori(element, options)

  if (!svg) {
    return null
  }

  const resvg = new Resvg(svg)

  const render = resvg.render()
  const data = render.asPng()

  return data
}
