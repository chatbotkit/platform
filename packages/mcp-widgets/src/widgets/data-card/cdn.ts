/**
 * CDN entry point for data-card widget
 *
 * This file is bundled by esbuild into a self-contained IIFE
 * that can be loaded via a script tag.
 */

import { register } from './DataCard'

// Auto-register when loaded
register()
