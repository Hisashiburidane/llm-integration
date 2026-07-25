#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { createWriteStream, createReadStream } from 'node:fs'
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = resolve(projectDir, 'data')

function parseArgs(argv) {
  const options = { dataset: '', force: false }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--') continue
    if (argument === '--help') {
      console.log('Usage: pnpm data:download [-- --dataset <id>] [--force]')
      process.exit(0)
    }
    if (argument === '--dataset') {
      options.dataset = argv[index + 1] ?? ''
      index += 1
      continue
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
  for await (const chunk of createReadStream(filePath)) hash.update(chunk)
  return hash.digest('hex')
}

async function downloadFile(file, force) {
  const destination = resolve(projectDir, file.downloadTo)
  await mkdir(dirname(destination), { recursive: true })
  if (!force) {
    try {
      const existing = await stat(destination)
      if (existing.size > 0) {
        return { ...file, status: 'skipped', bytes: existing.size, sha256: await sha256(destination) }
      }
    } catch {
      // The destination does not exist yet.
    }
  }

  const temporary = `${destination}.part`
  try {
    const response = await fetch(file.url, { headers: { 'User-Agent': 'EnchantForge example data setup' } })
    if (!response.ok || !response.body) throw new Error(`${response.status} ${response.statusText}`)
    await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary))
    const bytes = (await stat(temporary)).size
    const digest = await sha256(temporary)
    await rename(temporary, destination)
    return { ...file, status: 'downloaded', bytes, sha256: digest }
  } catch (error) {
    await unlink(temporary).catch(() => {})
    throw new Error(`${file.url}: ${error.message}`)
  }
}

async function readPlans(dataset) {
  const entries = dataset ? [dataset] : (await import('node:fs/promises')).readdir(dataDir, { withFileTypes: true })
  const ids = dataset ? entries : entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  const plans = []
  for (const id of ids) {
    try {
      plans.push(JSON.parse(await readFile(resolve(dataDir, id, 'download-plan.json'), 'utf8')))
    } catch {
      if (dataset) throw new Error(`No plan found for ${id}; run data:plan first`)
    }
  }
  return plans
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const plans = await readPlans(options.dataset)
  if (plans.length === 0) throw new Error('No plans found; run data:plan first')

  for (const plan of plans) {
    if (!plan.files?.length) {
      console.log(`${plan.datasetId}: no direct files (${plan.status}); follow the source page or commands in its plan`)
      continue
    }
    const results = []
    for (const file of plan.files) {
      console.log(`${plan.datasetId}: ${file.url}`)
      results.push(await downloadFile(file, options.force))
    }
    const manifestPath = resolve(dataDir, plan.datasetId, 'manifests/download-manifest.json')
    await mkdir(dirname(manifestPath), { recursive: true })
    await writeFile(manifestPath, `${JSON.stringify({
      datasetId: plan.datasetId,
      sourcePage: plan.sourcePage,
      downloadedAt: new Date().toISOString(),
      files: results,
    }, null, 2)}\n`)
    console.log(`Manifest: ${manifestPath}`)
  }
}

main().catch((error) => {
  console.error(`Unable to download data plans: ${error.message}`)
  process.exitCode = 1
})
