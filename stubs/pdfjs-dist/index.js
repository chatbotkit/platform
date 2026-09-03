// @note stub for pdfjs-dist - we use a separate PDF parser, not officeparser's
// This prevents webpack from trying to bundle the ESM pdfjs-dist package

export const GlobalWorkerOptions = {
  workerSrc: '',
}

export const OPS = {
  dependency: 0,
  paintImageXObject: 0,
  paintXObject: 0,
  transform: 0,
}

export function getDocument() {
  throw new Error(
    'pdfjs-dist is stubbed out - PDF parsing is not available via officeparser'
  )
}
