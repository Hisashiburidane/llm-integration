#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = resolve(projectDir, 'data')

const catalog = [
  {
    id: 'online-retail-ii',
    name: 'Online Retail II',
    topic: 'ecommerce',
    status: 'ready',
    provider: 'UCI Machine Learning Repository',
    sourcePage: 'https://archive.ics.uci.edu/dataset/502/online%2Bretail%2Bii',
    license: 'CC BY 4.0',
    files: [{
      name: 'online_retail_ii.zip',
      url: 'https://archive.ics.uci.edu/static/public/502/online%2Bretail%2Bii.zip',
    }],
    transformations: ['read online_retail_II.xlsx', 'derive lineAmount = Quantity * UnitPrice', 'flag cancellations from InvoiceNo'],
    limitations: ['transaction history covers 2009-12-01 through 2011-12-09', 'does not contain browsing, advertising, inventory, or logistics events'],
  },
  {
    id: 'beijing-air-quality',
    name: 'Beijing Multi-Site Air Quality',
    topic: 'air-quality',
    status: 'ready',
    provider: 'UCI Machine Learning Repository',
    sourcePage: 'https://archive.ics.uci.edu/dataset/501/beijingmultisiteairqualitydata',
    license: 'CC BY 4.0',
    files: [{
      name: 'beijing_multi_site_air_quality.zip',
      url: 'https://archive.ics.uci.edu/static/public/501/beijing%2Bmulti%2Bsite%2Bair%2Bquality%2Bdata.zip',
    }],
    transformations: ['unpack station CSV files', 'parse year/month/day/hour into timestamp', 'preserve NA as missing values'],
    limitations: ['hourly historical observations cover 2013-03-01 through 2017-02-28', 'missing values are present in the source data'],
  },
  {
    id: 'nyc-taxi',
    name: 'NYC TLC Yellow Taxi Trips',
    topic: 'urban-mobility',
    status: 'ready',
    provider: 'New York City Taxi and Limousine Commission',
    sourcePage: 'https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page',
    license: 'Provider terms; verify before redistribution',
    files: [
      {
        name: 'yellow_tripdata_2025-01.parquet',
        url: 'https://d37ci6vzurychx.cloudfront.net/trip-data/yellow_tripdata_2025-01.parquet',
      },
      {
        name: 'taxi_zone_lookup.csv',
        url: 'https://d37ci6vzurychx.cloudfront.net/misc/taxi_zone_lookup.csv',
      },
    ],
    transformations: ['join pickup/drop-off location IDs with taxi_zone_lookup.csv', 'derive trip duration and pickup hour', 'validate fare and distance ranges'],
    limitations: ['TLC notes that trip records are supplied by technology providers and may not be complete or fully accurate', 'Parquet schema can change across periods'],
  },
  {
    id: 'otel-demo',
    name: 'OpenTelemetry Demo Observability',
    topic: 'cloud-observability',
    status: 'collect',
    provider: 'OpenTelemetry project',
    sourcePage: 'https://opentelemetry.io/docs/demo/',
    license: 'See the OpenTelemetry Demo repository license',
    files: [],
    commands: [
      'git clone https://github.com/open-telemetry/opentelemetry-demo.git',
      'cd opentelemetry-demo && make start',
      'capture metrics, logs, and traces from the running demo before creating a fixture',
    ],
    transformations: ['export telemetry from the running demo', 'record fault injection and recovery windows', 'preserve service, instance, node, and trace relationships'],
    limitations: ['this is a reproducible collection workflow, not a static download', 'do not present synthetic demo telemetry as production data'],
  },
  {
    id: 'cicids2017',
    name: 'CIC-IDS2017',
    topic: 'cybersecurity',
    status: 'manual',
    provider: 'Canadian Institute for Cybersecurity, University of New Brunswick',
    sourcePage: 'https://www.unb.ca/cic/datasets/ids-2017.html',
    license: 'See the provider page and related paper before redistribution',
    files: [],
    commands: ['open the source page and download the labelled flow files manually', 'record the selected archive URL and SHA-256 in the local manifest'],
    transformations: ['keep attack labels and capture dates', 'normalize flow feature names', 'separate benign and attack records without inventing Kubernetes semantics'],
    limitations: ['the provider page does not expose a stable direct archive URL in this plan', 'the dataset represents a 2017 controlled capture, not current traffic'],
  },
  {
    id: 'cmapps',
    name: 'NASA C-MAPSS Engine Health',
    topic: 'predictive-maintenance',
    status: 'unavailable',
    provider: 'NASA Open Data Portal',
    sourcePage: 'https://data.nasa.gov/dataset/c-mapss-aircraft-engine-simulator-data',
    license: 'Not specified by the provider',
    files: [],
    transformations: [],
    limitations: ['NASA currently marks C-MAPSS and C-MAPSS40K as unavailable for download', 'do not substitute an unverified mirror and call it NASA data'],
  },
]

function parseArgs(argv) {
  const options = { dataset: '' }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--') continue
    if (argument === '--help') {
      console.log('Usage: pnpm data:plan [-- --dataset <id>]')
      console.log(`Available datasets: ${catalog.map((dataset) => dataset.id).join(', ')}`)
      process.exit(0)
    }
    if (argument === '--dataset') {
      options.dataset = argv[index + 1] ?? ''
      index += 1
      continue
    }
    throw new Error(`Unknown option: ${argument}`)
  }
  return options
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const selected = options.dataset ? catalog.filter((dataset) => dataset.id === options.dataset) : catalog
  if (selected.length === 0) throw new Error(`Unknown dataset: ${options.dataset}`)

  for (const dataset of selected) {
    const datasetDir = resolve(dataDir, dataset.id)
    const files = dataset.files.map((file) => ({
      ...file,
      downloadTo: `data/${dataset.id}/raw/${file.name}`,
      checksum: 'pending: calculate SHA-256 after download',
    }))
    const plan = {
      datasetId: dataset.id,
      name: dataset.name,
      topic: dataset.topic,
      status: dataset.status,
      provider: dataset.provider,
      sourcePage: dataset.sourcePage,
      license: dataset.license,
      files,
      commands: dataset.commands ?? [],
      transformations: dataset.transformations,
      limitations: dataset.limitations,
    }
    await mkdir(datasetDir, { recursive: true })
    await writeFile(resolve(datasetDir, 'download-plan.json'), `${JSON.stringify(plan, null, 2)}\n`)
    await writeFile(resolve(datasetDir, 'download-urls.txt'), `${files.map((file) => file.url).join('\n')}${files.length ? '\n' : ''}`)
    console.log(`${dataset.id}: ${files.length} direct URL(s), status=${dataset.status}`)
  }
}

main().catch((error) => {
  console.error(`Unable to generate data plans: ${error.message}`)
  process.exitCode = 1
})
