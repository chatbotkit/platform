export function unreachable(x: never) {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  x
}

export function assertUnreachable(x: never): never {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  x

  // @note we need to print x in order to make sure we capture the problem

  throw new Error(`Didn't expect to get here: ${x}`)
}
