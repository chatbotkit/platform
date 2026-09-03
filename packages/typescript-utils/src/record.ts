/* eslint-disable @typescript-eslint/no-explicit-any */

export type ToReadonlyRecord<T extends Record<string, any>> = Readonly<T>
