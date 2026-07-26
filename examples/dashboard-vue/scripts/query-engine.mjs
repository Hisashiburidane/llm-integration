function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  return sqlString(value);
}

function resultAlias(value, fallback) {
  const alias = value || fallback;
  if (typeof alias !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(alias)) {
    throw new Error(`查询结果别名无效：${alias}。`);
  }
  return alias;
}

function dimensionDefinition(source, dimensionId) {
  const definition = source.dimensions[dimensionId];
  return typeof definition === 'string' ? { sql: definition } : definition;
}

function scoped(expression, scope) {
  return expression.replaceAll('source.', `${scope}.`);
}

function whereClause(query, source) {
  const clauses = [];
  for (const filter of query.filters) {
    const dimension = dimensionDefinition(source, filter.dimensionId);
    if (!dimension) throw new Error(`未知过滤维度：${filter.dimensionId}。`);
    const field = dimension.sql;
    if (['eq', 'neq', 'gte', 'lte'].includes(filter.operator) && filter.value !== undefined) {
      const operator = { eq: '=', neq: '!=', gte: '>=', lte: '<=' }[filter.operator];
      clauses.push(`${field} ${operator} ${sqlValue(filter.value)}`);
    } else if (filter.operator === 'in' && Array.isArray(filter.value) && filter.value.length) {
      clauses.push(`${field} IN (${filter.value.map(sqlValue).join(', ')})`);
    } else if (filter.operator === 'between' && Array.isArray(filter.value) && filter.value.length === 2) {
      clauses.push(`${field} BETWEEN ${sqlValue(filter.value[0])} AND ${sqlValue(filter.value[1])}`);
    } else {
      throw new Error(`不支持的过滤条件：${filter.operator}。`);
    }
  }
  if (query.timeRange) {
    const hour = dimensionDefinition(source, 'hour');
    if (!hour) throw new Error('当前查询模型不支持小时范围。');
    clauses.push(`${hour.sql} BETWEEN ${query.timeRange.startHour} AND ${query.timeRange.endHour}`);
  }
  return clauses.length ? clauses.join(' AND ') : '1 = 1';
}

function validateQuery(query, model) {
  if (!query || typeof query !== 'object' || !model) throw new Error('不支持的数据集。');
  if (!Array.isArray(query.metrics) || !query.metrics.length) throw new Error('QuerySpec 至少需要一个指标。');
  if (!Array.isArray(query.dimensions) || !Array.isArray(query.filters)) throw new Error('QuerySpec 结构无效。');
  if (query.limit !== undefined && (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > 100)) {
    throw new Error('QuerySpec limit 必须是 1 到 100 的整数。');
  }
  if (query.orderBy && (typeof query.orderBy.fieldId !== 'string' || !['asc', 'desc'].includes(query.orderBy.direction))) {
    throw new Error('QuerySpec orderBy 无效。');
  }
  if (query.timeRange && (!Number.isInteger(query.timeRange.startHour) || !Number.isInteger(query.timeRange.endHour)
    || query.timeRange.startHour < 0 || query.timeRange.endHour > 23 || query.timeRange.startHour > query.timeRange.endHour)) {
    throw new Error('时间范围必须位于 0-23 小时之间。');
  }
}

function supports(source, query) {
  return query.metrics.every((item) => source.metrics[item.metricId])
    && query.dimensions.every((item) => source.dimensions[item.dimensionId])
    && query.filters.every((item) => source.dimensions[item.dimensionId])
    && (!query.timeRange || source.dimensions.hour);
}

function compileQuery(query, source) {
  const dimensionItems = query.dimensions.map((item) => ({
    ...item,
    alias: resultAlias(item.alias, item.dimensionId),
    definition: dimensionDefinition(source, item.dimensionId)
  }));
  const metricItems = query.metrics.map((item) => ({
    ...item,
    alias: resultAlias(item.alias, item.metricId),
    definition: source.metrics[item.metricId]
  }));
  const percentileMetrics = metricItems.filter((item) => typeof item.definition === 'object' && item.definition.type === 'percentile');
  if (new Set(percentileMetrics.map((item) => item.definition.field)).size > 1) {
    throw new Error('同一查询暂不支持多个不同字段的 percentile 指标。');
  }
  const scope = percentileMetrics.length ? 'ranked' : 'base';
  const dimensionSelections = dimensionItems.flatMap((item) => {
    const codeSql = scoped(item.definition.sql, scope);
    if (!item.definition.labelSql) return [`${codeSql} AS ${item.alias}`];
    return [
      `${scoped(item.definition.labelSql, scope)} AS ${item.alias}`,
      `${codeSql} AS ${item.alias}Code`
    ];
  });
  const metricSelections = metricItems.map((item) => {
    if (typeof item.definition === 'object') {
      const rank = `CAST((__group_count * ${item.definition.percentile} + 99) / 100 AS INTEGER)`;
      return `MAX(CASE WHEN __rank = ${rank} THEN ${scoped(item.definition.field, scope)} END) AS ${item.alias}`;
    }
    return `${scoped(item.definition, scope)} AS ${item.alias}`;
  });
  const groupExpressions = dimensionItems.flatMap((item) => [
    scoped(item.definition.sql, scope),
    ...(item.definition.labelSql ? [scoped(item.definition.labelSql, scope)] : [])
  ]);
  const availableOrderFields = new Map([
    ...dimensionItems.map((item) => [item.dimensionId, item.alias]),
    ...metricItems.map((item) => [item.metricId, item.alias])
  ]);
  const orderAlias = query.orderBy ? availableOrderFields.get(query.orderBy.fieldId) : undefined;
  if (query.orderBy && !orderAlias) throw new Error(`排序字段不在查询结果中：${query.orderBy.fieldId}。`);
  const orderSql = orderAlias
    ? ` ORDER BY ${orderAlias} ${query.orderBy.direction.toUpperCase()}`
    : dimensionItems.length ? ` ORDER BY ${dimensionItems[0].alias}` : '';
  const base = `base AS (SELECT source.*, ${source.rowCountSql} OVER() AS __row_count FROM ${source.from} WHERE ${whereClause(query, source)})`;
  const partition = dimensionItems.length
    ? dimensionItems.map((item) => scoped(item.definition.sql, 'base')).join(', ')
    : '1';
  const percentileField = percentileMetrics[0]?.definition.field;
  const ranked = percentileField
    ? `, ranked AS (SELECT base.*, ROW_NUMBER() OVER (PARTITION BY ${partition} ORDER BY ${scoped(percentileField, 'base')}) AS __rank, COUNT(*) OVER (PARTITION BY ${partition}) AS __group_count FROM base)`
    : '';
  const groupSql = groupExpressions.length ? ` GROUP BY ${groupExpressions.join(', ')}` : '';
  const selections = [...dimensionSelections, ...metricSelections, 'MAX(__row_count) AS __row_count'];
  return `WITH ${base}${ranked} SELECT ${selections.join(', ')} FROM ${scope}${groupSql}${orderSql} LIMIT ${query.limit || 100}`;
}

export function createQueryEngine({ runSql, queryModels }) {
  const modelById = new Map(queryModels.map((model) => [model.id, model]));
  const availableTables = new Set();

  async function initialize() {
    const tables = [...new Set(queryModels.flatMap((model) => model.sources.map((source) => source.table)))];
    for (const table of tables) {
      const rows = await runSql(`SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ${sqlString(table)}`);
      if (!rows.length) continue;
      const count = await runSql(`SELECT COUNT(*) AS row_count FROM ${table}`);
      if (Number(count[0]?.row_count ?? 0) > 0) availableTables.add(table);
    }
  }

  function selectSource(model, query) {
    const source = model.sources.find((candidate) => availableTables.has(candidate.table) && supports(candidate, query));
    if (!source) throw new Error(`查询模型 ${model.id} 没有可用且兼容的数据源。`);
    return source;
  }

  async function execute(query) {
    const model = modelById.get(query?.datasetId);
    validateQuery(query, model);
    const source = selectSource(model, query);
    query.metrics.forEach((item) => {
      if (!source.metrics[item.metricId]) throw new Error(`未知指标：${item.metricId}。`);
    });
    query.dimensions.forEach((item) => {
      if (!source.dimensions[item.dimensionId]) throw new Error(`未知维度：${item.dimensionId}。`);
    });
    const rows = await runSql(compileQuery(query, source));
    const rowCount = Number(rows[0]?.__row_count ?? 0);
    rows.forEach((row) => { delete row.__row_count; });
    return {
      columns: [...query.dimensions.map((item) => item.alias || item.dimensionId), ...query.metrics.map((item) => item.alias || item.metricId)],
      rows,
      summary: { rowCount, source: `SQLite ${source.table}`, query }
    };
  }

  async function readFacet(model, facet) {
    if (facet.options) return facet.options;
    const source = model.sources.find((candidate) => availableTables.has(candidate.table) && candidate.dimensions[facet.dimensionId]);
    if (!source) return [];
    const dimension = dimensionDefinition(source, facet.dimensionId);
    const labelSql = dimension.labelSql || dimension.sql;
    const order = facet.order === 'desc' ? 'DESC' : 'ASC';
    return runSql(`SELECT DISTINCT ${dimension.sql} AS code, ${labelSql} AS label FROM ${source.from} WHERE ${dimension.sql} IS NOT NULL AND ${dimension.sql} != '' ORDER BY code ${order} LIMIT 500`);
  }

  return { initialize, execute, readFacet, modelById };
}
