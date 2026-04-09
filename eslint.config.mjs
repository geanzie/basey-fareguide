import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

export default [
  {
    ignores: [
      '.git/**',
      '.next/**',
      '.next-dev/**',
      '.next-prod/**',
      'node_modules/**',
      'public/uploads/**',
      'src/generated/**',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
]