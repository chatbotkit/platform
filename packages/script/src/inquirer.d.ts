// @note inquirer 8 ships no type declarations and @types/inquirer is not a
// dependency of this repository. In platform this module therefore resolved
// to `any`, and this declaration reproduces that rather than tightening it: the
// harness and its tests moved here unchanged, and typing them is a separate
// change.

declare module 'inquirer' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inquirer: any

  export default inquirer
}
