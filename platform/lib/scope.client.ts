if (process.env.NODE_ENV !== 'test') {
  // when imported we check if this code is running in the client, if not throw
  // an error

  if (typeof window === 'undefined') {
    throw new Error('This code should only run in the client')
  }
}
