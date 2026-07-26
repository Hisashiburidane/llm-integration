function sqlString(value) {
  return `'${String(value ?? '').replaceAll("'", "''")}'`;
}

async function addColumn(runSql, statement) {
  try {
    await runSql(statement, { readonly: false });
  } catch (error) {
    if (!String(error).includes('duplicate column name')) throw error;
  }
}

export async function ensureDashboardSchema(runSql) {
  await runSql([
    'CREATE TABLE IF NOT EXISTS dashboard_configs (id TEXT PRIMARY KEY, topic_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, source_manifest_json TEXT NOT NULL, dataset_json TEXT NOT NULL, base_dashboard_id TEXT)',
    'CREATE TABLE IF NOT EXISTS panel_definitions (id TEXT PRIMARY KEY, type TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, query_json TEXT NOT NULL, visualization_json TEXT, default_width INTEGER NOT NULL, default_min_height INTEGER NOT NULL)',
    'CREATE TABLE IF NOT EXISTS dashboard_panel_placements (dashboard_id TEXT NOT NULL, panel_id TEXT NOT NULL, sort_order INTEGER NOT NULL, width INTEGER NOT NULL, min_height INTEGER NOT NULL, PRIMARY KEY (dashboard_id, panel_id), FOREIGN KEY (dashboard_id) REFERENCES dashboard_configs(id), FOREIGN KEY (panel_id) REFERENCES panel_definitions(id))',
    'CREATE INDEX IF NOT EXISTS idx_dashboard_panel_placements_dashboard ON dashboard_panel_placements(dashboard_id, sort_order)',
    'CREATE INDEX IF NOT EXISTS idx_panel_definitions_title ON panel_definitions(title)'
  ].join(';'), { readonly: false });

  await addColumn(runSql, "ALTER TABLE dashboard_configs ADD COLUMN dataset_json TEXT NOT NULL DEFAULT '{}'");
  await addColumn(runSql, 'ALTER TABLE dashboard_configs ADD COLUMN base_dashboard_id TEXT');

  const legacyTables = await runSql("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = 'dashboard_panels'");
  if (legacyTables.length) {
    await runSql([
      'BEGIN',
      'INSERT OR IGNORE INTO panel_definitions (id, type, title, description, query_json, visualization_json, default_width, default_min_height) SELECT id, type, title, description, query_json, visualization_json, COALESCE(CAST(json_extract(layout_json, \'$.width\') AS INTEGER), 6), COALESCE(CAST(json_extract(layout_json, \'$.minHeight\') AS INTEGER), 300) FROM dashboard_panels',
      'INSERT OR IGNORE INTO dashboard_panel_placements (dashboard_id, panel_id, sort_order, width, min_height) SELECT dashboard_id, id, sort_order, COALESCE(CAST(json_extract(layout_json, \'$.width\') AS INTEGER), 6), COALESCE(CAST(json_extract(layout_json, \'$.minHeight\') AS INTEGER), 300) FROM dashboard_panels WHERE is_template = 0',
      'DROP TABLE dashboard_panels',
      'COMMIT'
    ].join(';'), { readonly: false });
  }
}

export async function resetDashboardConfiguration(runSql, dashboardDefinitions) {
  await ensureDashboardSchema(runSql);

  const panels = dashboardDefinitions.flatMap((dashboard) => [
    ...dashboard.panels,
    ...dashboard.panelTemplates
  ]);
  const configInserts = dashboardDefinitions.map((dashboard) =>
    `INSERT INTO dashboard_configs (id, topic_id, title, description, source_manifest_json, dataset_json, base_dashboard_id) VALUES (${sqlString(dashboard.id)}, ${sqlString(dashboard.topicId)}, ${sqlString(dashboard.title)}, ${sqlString(dashboard.description)}, ${sqlString(JSON.stringify(dashboard.sourceManifest))}, ${sqlString(JSON.stringify(dashboard.dataset))}, ${sqlString(dashboard.id)})`
  );
  const panelInserts = panels.map((panel) =>
    `INSERT INTO panel_definitions (id, type, title, description, query_json, visualization_json, default_width, default_min_height) VALUES (${sqlString(panel.id)}, ${sqlString(panel.type)}, ${sqlString(panel.title)}, ${sqlString(panel.description)}, ${sqlString(JSON.stringify(panel.query))}, ${panel.visualization ? sqlString(JSON.stringify(panel.visualization)) : 'NULL'}, ${panel.layout.width}, ${panel.layout.minHeight})`
  );
  const placementInserts = dashboardDefinitions.flatMap((dashboard) =>
    dashboard.panels.map((panel, index) =>
      `INSERT INTO dashboard_panel_placements (dashboard_id, panel_id, sort_order, width, min_height) VALUES (${sqlString(dashboard.id)}, ${sqlString(panel.id)}, ${index}, ${panel.layout.width}, ${panel.layout.minHeight})`
    )
  );

  await runSql([
    'BEGIN',
    'DELETE FROM dashboard_panel_placements',
    'DELETE FROM panel_definitions',
    'DELETE FROM dashboard_configs',
    ...configInserts,
    ...panelInserts,
    ...placementInserts,
    'COMMIT'
  ].join(';'), { readonly: false });

  return {
    dashboards: dashboardDefinitions.length,
    panels: panels.length,
    placements: placementInserts.length
  };
}
