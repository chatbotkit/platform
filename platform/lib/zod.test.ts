type EqualTypes<X, Y> = (<T>() => T extends X ? 1 : 2) extends <
  T
>() => T extends Y ? 1 : 2
  ? true
  : false

/**
 * This type is useful for testing type equality for zod types.
 *
 * example: checkSame<Dog, Dog, z.infer<typeof dogSchema>>(true)
 */
export const checkSame = <T1, _T1_REPEAT extends T2, T2 extends T1>(
  _value: EqualTypes<T1, T2>
) => undefined
