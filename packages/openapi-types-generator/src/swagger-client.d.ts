declare module 'swagger-client' {
  const SwaggerClient: {
    resolve(options: { spec: unknown }): Promise<{ spec: unknown }>
  }

  export default SwaggerClient
}
