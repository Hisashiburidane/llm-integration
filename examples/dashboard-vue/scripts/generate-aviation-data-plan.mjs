#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = resolve(projectDir, 'data')

const DEFAULT_FROM = '2025-07'
const DEFAULT_TO = '2025-07'
const BTS_PREZIP_URL = 'https://transtats.bts.gov/PREZIP'

function usage() {
  console.log(`Usage: node scripts/generate-aviation-data-plan.mjs [options]

Options:
  --from YYYY-MM  First month to include (default: ${DEFAULT_FROM})
  --to YYYY-MM    Last month to include (default: ${DEFAULT_TO})
  --help          Show this help

The command does not download files. It writes a URL list and a manifest to data/.
`)
}

function parseMonth(value, option) {
  const match = /^(\d{4})-(\d{2})$/.exec(value)
  if (!match) throw new Error(`${option} must use YYYY-MM, received: ${value}`)

  const year = Number(match[1])
  const month = Number(match[2])
  if (year < 1987 || month < 1 || month > 12) {
    throw new Error(`${option} is outside the BTS monthly data range: ${value}`)
  }

  return { year, month }
}

function monthKey({ year, month }) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function monthRange(from, to) {
  const start = parseMonth(from, '--from')
  const end = parseMonth(to, '--to')
  const startIndex = start.year * 12 + start.month
  const endIndex = end.year * 12 + end.month
  if (startIndex > endIndex) throw new Error('--from must not be after --to')

  const months = []
  for (let index = startIndex; index <= endIndex; index += 1) {
    const year = Math.floor(index / 12)
    const month = index % 12 || 12
    months.push({ year: month === 12 ? year - 1 : year, month })
  }
  return months
}

function parseArgs(argv) {
  const options = { from: DEFAULT_FROM, to: DEFAULT_TO }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--help') {
      usage()
      process.exit(0)
    }
    if (argument === '--from' || argument === '--to') {
      const value = argv[index + 1]
      if (!value) throw new Error(`${argument} requires a value`)
      options[argument.slice(2)] = value
      index += 1
      continue
    }
    throw new Error(`Unknown option: ${argument}`)
  }
  return options
}

function sourceFileFor({ year, month }) {
  const fileName = `On_Time_Reporting_Carrier_On_Time_Performance_1987_present_${year}_${month}.zip`
  return {
    fileName,
    url: `${BTS_PREZIP_URL}/${fileName}`,
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const months = monthRange(options.from, options.to)
  const files = months.map((month) => {
    const source = sourceFileFor(month)
    return {
      period: monthKey(month),
      provider: 'US Bureau of Transportation Statistics',
      sourceType: 'public_open_data',
      url: source.url,
      fileName: source.fileName,
      downloadTo: `data/raw/${source.fileName}`,
      checksum: 'pending: calculate SHA-256 after download',
    }
  })

  const plan = {
    datasetId: 'aviation_ontime',
    name: 'US Airline On-Time Performance',
    provider: 'US Bureau of Transportation Statistics',
    sourceIndex: 'https://www.transtats.bts.gov/ontime/',
    fieldSelector: 'https://www.transtats.bts.gov/DL_SelectFields.aspx?QO_fu146_anzr=b0-gvzr&gnoyr_VQ=FGJ',
    rawDirectory: 'data/raw',
    files,
    expectedTransformations: [
      'normalize airport and carrier codes',
      'derive departure hour from CRS_DEP_TIME',
      'derive on-time flag from ARR_DELAY',
      'map BTS delay-cause columns to delayCause',
    ],
    limitations: [
      'historical monthly data is not live operations data',
      'some delay-cause fields are empty for non-delayed or cancelled flights',
      'BTS files must be downloaded manually and checked before processing',
    ],
  }

  await mkdir(dataDir, { recursive: true })
  await writeFile(resolve(dataDir, 'download-plan.json'), `${JSON.stringify(plan, null, 2)}\n`)
  await writeFile(
    resolve(dataDir, 'download-urls.txt'),
    `${files.map((file) => file.url).join('\n')}\n`,
  )

  console.log(`Generated ${files.length} BTS URL(s).`)
  console.log(`Manifest: ${resolve(dataDir, 'download-plan.json')}`)
  console.log(`URL list: ${resolve(dataDir, 'download-urls.txt')}`)
  console.log('Download each archive into examples/dashboard-vue/data/raw before processing it.')
}

main().catch((error) => {
  console.error(`Unable to generate data plan: ${error.message}`)
  process.exitCode = 1
})
