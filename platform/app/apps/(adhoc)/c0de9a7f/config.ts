import z from '@/lib/zod.schema'

/**
 * Configuration schema for the GitHub Ops app (c0de9a7f).
 *
 * @description Validates the `config` field from app.manifest. This app is a
 * single instance bound to a blueprint by alias. It self-provisions the
 * `github-ops` blueprint on first load and exposes a Connections panel (to
 * connect an organisation-scoped GitHub token), a Tasks console (to create and
 * run recurring and one-off tasks) and a Playbooks panel (to author the
 * standards the agent reads before each task).
 */
const ConfigSchema = z
  .object({
    // Optional override for the blueprint alias this instance maps to. Falls
    // back to BLUEPRINT_ALIAS ('github-ops') when omitted.
    blueprintAlias: z.string().optional(),
  })
  .passthrough()

export default ConfigSchema
