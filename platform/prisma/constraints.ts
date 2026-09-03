// @note the platform's side of the column size limits.
//
// The numbers belong to the installed database module - they are properties of
// its engine, not of the platform - so they are re-exported here rather than
// imported across the app. Everything that validates against them goes through
// `@/prisma`, the same seam as the client, which keeps the app free of direct
// imports of whichever module pnpm resolved.

export * from '@chatbotkit-dev/db/constraints'
