import { readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

function assertIdentifier(value, label) {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/.test(value)) {
    throw new Error(`${label} 必须使用小写字母、数字、下划线或连字符。`);
  }
}

function validateMetadata(metadata, domainId) {
  if (!metadata || typeof metadata !== 'object') throw new Error(`${domainId} 缺少 metadata。`);
  ['aliases', 'keywords', 'useCases', 'exampleRequests'].forEach((field) => {
    if (!Array.isArray(metadata[field]) || !metadata[field].length || metadata[field].some((item) => typeof item !== 'string' || !item.trim())) {
      throw new Error(`${domainId} metadata.${field} 必须是非空字符串数组。`);
    }
  });
}

function validateDomain(domain, directory) {
  if (!domain || typeof domain !== 'object') throw new Error(`${directory}/domain.mjs 未导出数据域。`);
  assertIdentifier(domain.id, `${directory} 数据域 ID`);
  if (typeof domain.title !== 'string' || !domain.title.trim()) throw new Error(`${domain.id} 缺少 title。`);
  validateMetadata(domain.metadata, domain.id);
  if (!domain.dataset || typeof domain.dataset !== 'object') throw new Error(`${domain.id} 缺少 dataset。`);
  if (!Array.isArray(domain.panels) || !Array.isArray(domain.panelTemplates)) {
    throw new Error(`${domain.id} 的 panels 和 panelTemplates 必须是数组。`);
  }
}

function validateQueryModel(model, domainId, file) {
  if (!model || typeof model !== 'object') throw new Error(`${domainId}/${file} 未导出查询模型。`);
  assertIdentifier(model.id, `${domainId}/${file} 查询模型 ID`);
  if (!Array.isArray(model.sources) || !model.sources.length) throw new Error(`${model.id} 至少需要一个 source。`);
  model.sources.forEach((source) => {
    assertIdentifier(source.id, `${model.id} source ID`);
    if (typeof source.table !== 'string' || typeof source.from !== 'string') throw new Error(`${model.id}/${source.id} 缺少 table 或 from。`);
    if (!source.dimensions || !source.metrics || typeof source.rowCountSql !== 'string') {
      throw new Error(`${model.id}/${source.id} 缺少 dimensions、metrics 或 rowCountSql。`);
    }
  });
}

async function loadQueryModels(schemaDirectory, directory, domain) {
  const queryDirectory = path.join(schemaDirectory, directory, 'queries');
  const entries = await readdir(queryDirectory, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.mjs'))
    .map((entry) => entry.name)
    .sort();
  const models = [];

  for (const file of files) {
    const module = await import(pathToFileURL(path.join(queryDirectory, file)).href);
    validateQueryModel(module.default, domain.id, file);
    models.push(module.default);
  }
  return models;
}

export async function loadSchemaRegistry(schemaDirectory) {
  const entries = await readdir(schemaDirectory, { withFileTypes: true });
  const domainDirectories = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort();
  const domains = [];

  for (const directory of domainDirectories) {
    const module = await import(pathToFileURL(path.join(schemaDirectory, directory, 'domain.mjs')).href);
    const domain = module.default;
    validateDomain(domain, directory);
    const queryModels = await loadQueryModels(schemaDirectory, directory, domain);
    const semanticMetrics = new Set(domain.dataset.metrics.map((metric) => metric.id));
    const semanticDimensions = new Set(domain.dataset.dimensions.map((dimension) => dimension.id));
    queryModels.forEach((model) => model.sources.forEach((source) => {
      Object.keys(source.metrics).forEach((metricId) => {
        if (!semanticMetrics.has(metricId)) throw new Error(`${model.id} 指标未在 ${domain.id} dataset 中声明：${metricId}。`);
      });
      Object.keys(source.dimensions).forEach((dimensionId) => {
        if (!semanticDimensions.has(dimensionId)) throw new Error(`${model.id} 维度未在 ${domain.id} dataset 中声明：${dimensionId}。`);
      });
    }));
    domains.push({
      ...domain,
      queryModels,
      querySources: queryModels.map((model) => ({
        datasetId: model.id,
        metricIds: [...new Set(model.sources.flatMap((source) => Object.keys(source.metrics)))]
      }))
    });
  }

  const duplicate = domains.find((domain, index) => domains.findIndex((item) => item.id === domain.id) !== index);
  if (duplicate) throw new Error(`数据域 ID 重复：${duplicate.id}。`);

  const queryModels = domains.flatMap((domain) => domain.queryModels);
  const duplicateModel = queryModels.find((model, index) => queryModels.findIndex((item) => item.id === model.id) !== index);
  if (duplicateModel) throw new Error(`查询模型 ID 重复：${duplicateModel.id}。`);

  return {
    domains,
    domainById: new Map(domains.map((domain) => [domain.id, domain])),
    queryModels,
    queryModelById: new Map(queryModels.map((model) => [model.id, model]))
  };
}
