#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = resolve(projectDir, 'data')
const planPath = resolve(dataDir, 'download-plan.json')
const manifestPath = resolve(dataDir, 'manifests/download-manifest.json')

function usage() {
  console.log(`Usage: node scripts/download-aviation-data.mjs [--force]

Downloads every URL in data/download-plan.json into data/raw/.
Run data:plan first when the plan does not exist.

Options:
  --force  Replace archives that already exist
  --help   Show this help
`)
}

function parseArgs(argv) {
  const options = { force: false }
  for (const argument of argv) {
    if (argument === '--') continue
    if (argument === '--help') {
      usage()
      process.exit(0)
    }
    if (argument === '--force') {
      options.force = true
      continue
    }
    throw new Error(`Unknown option: ${argument}`)
  }
  return options
}

async function sha256(filePath) {
  const hash = createHash('sha256')
  const content = await readFile(filePath)
  hash.update(content)
  return hash.digest('hex')
}

async function downloadFile(file, force) {
  const destination = resolve(projectDir, file.downloadTo)
  await mkdir(dirname(destination), { recursive: true })

  if (!force) {
    try {
      const existing = await stat(destination)
      if (existing.size > 0) {
        return { ...file, status: 'skipped', localPath: file.downloadTo, bytes: existing.size, sha256: await sha256(destination) }
      }
    } catch {
      // The archive does not exist yet.
    }
  }

  const temporary = `${destination}.part`
  const response = await fetch(file.url, { headers: { 'User-Agent': 'EnchantForge dashboard data setup' } })
  if (!response.ok || !response.body) {
    throw new Error(`${response.status} ${response.statusText} while downloading ${file.url}`)
  }

  await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary))
  const bytes = (await stat(temporary)).size
  const digest = await sha256(temporary)
  await rename(temporary, destination)
  return { ...file, status: 'downloaded', localPath: file.downloadTo, bytes, sha256: digest }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  let plan
  try {
    plan = JSON.parse(await readFile(planPath, 'utf8'))
  } catch {
    throw new Error('data/download-plan.json is missing; run `pnpm data:plan` first')
  }

  const results = []
  for (const file of plan.files ?? []) {
    console.log(`${file.period}: ${file.url}`)
    results.push(await downloadFile(file, options.force))
  }

  await mkdir(dirname(manifestPath), { recursive: true })
  await writeFile(manifestPath, `${JSON.stringify({
    datasetId: plan.datasetId,
    sourceType: plan.sourceType ?? 'public_open_data',
    downloadedAt: new Date().toISOString(),
    files: results,
  }, null, 2)}\n`)
  console.log(`Manifest: ${manifestPath}`)
}

main().catch((error) => {
  console.error(`Unable to download aviation data: ${error.message}`)
  process.exitCode = 1
})
