// @note type stubs for @napi-rs/canvas to satisfy unpdf type declarations

export declare class Canvas {
  constructor(width: number, height: number)
  width: number
  height: number
  getContext(contextId: '2d'): CanvasRenderingContext2D
}

// @note SKRSContext2D is the internal name used by @napi-rs/canvas for its
// canvas rendering context, exported alongside the standard name
export declare class SKRSContext2D {
  canvas: Canvas
  fillStyle: string
  strokeStyle: string
  lineWidth: number
  font: string
  textAlign: string
  textBaseline: string
  fillRect(x: number, y: number, width: number, height: number): void
  strokeRect(x: number, y: number, width: number, height: number): void
  clearRect(x: number, y: number, width: number, height: number): void
  fillText(text: string, x: number, y: number, maxWidth?: number): void
  strokeText(text: string, x: number, y: number, maxWidth?: number): void
  drawImage(image: unknown, dx: number, dy: number): void
  drawImage(
    image: unknown,
    dx: number,
    dy: number,
    dw: number,
    dh: number
  ): void
  drawImage(
    image: unknown,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number
  ): void
  getImageData(sx: number, sy: number, sw: number, sh: number): ImageData
  putImageData(imageData: ImageData, dx: number, dy: number): void
  save(): void
  restore(): void
  scale(x: number, y: number): void
  rotate(angle: number): void
  translate(x: number, y: number): void
  transform(
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number
  ): void
  setTransform(
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number
  ): void
  beginPath(): void
  closePath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  stroke(): void
  fill(): void
  clip(): void
}

export declare class CanvasRenderingContext2D extends SKRSContext2D {}

export declare class ImageData {
  constructor(width: number, height: number)
  constructor(data: Uint8ClampedArray, width: number, height?: number)
  readonly data: Uint8ClampedArray
  readonly width: number
  readonly height: number
}
