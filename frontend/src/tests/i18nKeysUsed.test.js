import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { DICTIONARIES } from '../i18n/locales'

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === 'tests' || name === 'locales' ? [] : sourceFiles(path)
    return /\.(jsx?|mjs)$/.test(name) ? [path] : []
  })
}

describe('translation keys used in the code', () => {
  it('all exist in English (plural keys may use _one/_other)', () => {
    const missing = []
    for (const file of sourceFiles(join(process.cwd(), 'src'))) {
      const code = readFileSync(file, 'utf8')
      for (const match of code.matchAll(/\b(?:t|translate)\((?:[a-zA-Z]+,\s*)?'([a-z][\w.]*\.[\w.]+)'/g)) {
        const key = match[1]
        const found = key in DICTIONARIES.en || `${key}_other` in DICTIONARIES.en
        if (!found) missing.push(`${file.split('src/')[1]}: ${key}`)
      }
    }
    expect(missing).toEqual([])
  })
})
