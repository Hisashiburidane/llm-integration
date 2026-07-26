import { readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

function assertIdentifier(value, label) {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/.test(value)) {
    throw new Error(`${label} 必须使用小写字母、数字、下划线或连字符。`);
  }
}

function validateDomain(domain, directory) {
  if (!domain || typeof domain !== 'object') throw new Error(`${directory}/domain.mjs 未导出数据域。`);
  assertIdentifier(domain.id, `${directory} 数据域 ID`);
  if (typeof domain.title !== 'string' || !domain.title.trim()) throw new Error(`${domain.id} 缺少 title。`);
  if (!domain.dataset || typeof domain.dataset !== 'object') throw new Error(`${domain.id} 缺少 dataset。`);
  if (!Array.isArray(domain.panels) || !Array.isArray(domain.panelTemplates)) {
    throw new Error(`${domain.id} 的 panels 和 panelTemplates 必须是数组。`);
  }
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
    domains.push(domain);
  }

  const duplicate = domains.find((domain, index) => domains.findIndex((item) => item.id === domain.id) !== index);
  if (duplicate) throw new Error(`数据域 ID 重复：${duplicate.id}。`);

  return {
    domains,
    domainById: new Map(domains.map((domain) => [domain.id, domain]))
  };
}
