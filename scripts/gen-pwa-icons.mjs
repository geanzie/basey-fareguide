// One-off generator for PWA app icons. Re-run if the brand mark changes:
//   node scripts/gen-pwa-icons.mjs
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

mkdirSync('public/icons', { recursive: true })

function svg(size, rounded) {
  const r = rounded ? size * 0.18 : 0
  const fs = Math.round(size * 0.5)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#16a34a"/>
  <text x="50%" y="50%" font-family="Arial, Helvetica, sans-serif" font-size="${fs}" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="central">&#8369;</text>
</svg>`
}

const targets = [
  { name: 'icon-192.png', size: 192, rounded: true },
  { name: 'icon-512.png', size: 512, rounded: true },
  { name: 'icon-maskable-512.png', size: 512, rounded: false },
]

for (const t of targets) {
  await sharp(Buffer.from(svg(t.size, t.rounded))).png().toFile(`public/icons/${t.name}`)
  console.log('wrote', t.name)
}
