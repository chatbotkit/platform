/* eslint-disable import/no-anonymous-default-export */
// @ts-check

const WIDGET_INTEGRATION_SCRIPT_VERSIONS = ['v1', 'v2']
const WIDGET_INTEGRATION_PLUGIN_SCRIPTS = ['analytics-consent']

const MCP_INTEGRATION_SCRIPT_VERSIONS = ['v1']

/** @type {import('next').NextConfig} */
export default {
  webpack(config, _options) {
    const originalEntry = config.entry

    config.entry = async () => {
      const entries = await originalEntry()

      // widget integration scripts
      WIDGET_INTEGRATION_SCRIPT_VERSIONS.forEach((version) => {
        entries[`static/embed.widget.${version}.js`] = {
          import: `./embeds/widget/${version}.ts`,
          filename: `./static/embed.widget.${version}.js`,
          dependOn: undefined,
          runtime: false,
          // @note the following options sort of disable hot reloading but I
          // don't know which one and why - it does work though
          chunkLoading: false,
          layer: null,
        }
      })

      // widget integration plugins
      WIDGET_INTEGRATION_PLUGIN_SCRIPTS.forEach((name) => {
        entries[`static/embed.widget.plugin.${name}.js`] = {
          import: `./embeds/widget/plugins/${name}.js`,
          filename: `./static/embed.widget.plugin.${name}.js`,
          dependOn: undefined,
          runtime: false,
          // @note the following options sort of disable hot reloading but I
          // don't know which one and why - it does work though
          chunkLoading: false,
          layer: null,
        }
      })

      // mcp integration scripts
      MCP_INTEGRATION_SCRIPT_VERSIONS.forEach((version) => {
        entries[`static/embed.mcp.${version}.js`] = {
          import: `./embeds/mcp/${version}.ts`,
          filename: `./static/embed.mcp.${version}.js`,
          dependOn: undefined,
          runtime: false,
          // @note the following options sort of disable hot reloading but I
          // don't know which one and why - it does work though
          chunkLoading: false,
          layer: null,
        }
      })

      return entries
    }

    return config
  },

  async rewrites() {
    return {
      beforeFiles: [
        // @note each widget is mapped to a specific location - this is because
        // the widgets are generated in the _next/static folder and we need to
        // redirect the user to the correct location
        ...WIDGET_INTEGRATION_SCRIPT_VERSIONS.map((version) => {
          return {
            source: `/integrations/widget/${version}.js`,
            destination: `/_next/static/embed.widget.${version}.js`,
          }
        }),
        // @note same goes for the plugins
        ...WIDGET_INTEGRATION_PLUGIN_SCRIPTS.map((name) => {
          return {
            source: `/integrations/widget/plugins/${name}.js`,
            destination: `/_next/static/embed.widget.plugin.${name}.js`,
          }
        }),
        // @note same goes for the mcp widgets
        ...MCP_INTEGRATION_SCRIPT_VERSIONS.map((version) => {
          return {
            source: `/integrations/mcpserver/${version}.js`,
            destination: `/_next/static/embed.mcp.${version}.js`,
          }
        }),
      ],

      afterFiles: [],

      fallback: [],
    }
  },
}
