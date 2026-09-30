#!/usr/bin/env node
/**
 * generate-icons.mjs
 *
 * Generates the PWA icon PNG files required by public/site.webmanifest
 * and the apple-touch-icon fallback from the SVG source files.
 *
 * Usage:
 *   node scripts/generate-icons.mjs
 *
 * Requires:
 *   npm install --save-dev sharp   (one-time, already in devDependencies)
 *
 * Output files (all under public/icons/):
 *   icon-192x192.png
 *   icon-192x192-maskable.png
 *   icon-512x512.png
 *   icon-512x512-maskable.png
 *   favicon-16x16.png
 *   favicon-32x32.png
 *
 * Also outputs:
 *   public/apple-touch-icon.png   (180x180, static fallback)
 */

import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

async function run() {
  let sharp
  try {
    sharp = require('sharp')
  } catch {
    console.error(
      '❌  sharp is not installed. Run: npm install --save-dev sharp',
    )
    process.exit(1)
  }

  const iconsDir = path.join(root, 'public', 'icons')
  fs.mkdirSync(iconsDir, { recursive: true })

  const regularSrc = path.join(iconsDir, 'icon-source.svg')
  const maskableSrc = path.join(iconsDir, 'icon-maskable-source.svg')

  /** @type {Array<{src: string, dest: string, size: number}>} */
  const tasks = [
    // Standard PWA icons
    { src: regularSrc, dest: path.join(iconsDir, 'icon-192x192.png'), size: 192 },
    { src: regularSrc, dest: path.join(iconsDir, 'icon-512x512.png'), size: 512 },
    // Maskable PWA icons
    { src: maskableSrc, dest: path.join(iconsDir, 'icon-192x192-maskable.png'), size: 192 },
    { src: maskableSrc, dest: path.join(iconsDir, 'icon-512x512-maskable.png'), size: 512 },
    // Favicon sizes
    { src: regularSrc, dest: path.join(iconsDir, 'favicon-16x16.png'), size: 16 },
    { src: regularSrc, dest: path.join(iconsDir, 'favicon-32x32.png'), size: 32 },
    // Static apple touch icon fallback (for browsers that don't hit App Router)
    {
      src: regularSrc,
      dest: path.join(root, 'public', 'apple-touch-icon.png'),
      size: 180,
    },
  ]

  for (const { src, dest, size } of tasks) {
    await sharp(src).resize(size, size).png().toFile(dest)
    console.log(`✅  ${path.relative(root, dest)} (${size}x${size})`)
  }

  console.log('\n🎉  All icons generated successfully.')
}

run().catch((err) => {
  console.error('❌  Icon generation failed:', err)
  process.exit(1)
})
