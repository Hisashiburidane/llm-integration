export default {
  id: 'beijing_air_quality_demo',
  title: 'Beijing air quality observations',
  sources: [
    {
      id: 'daily-rollup',
      table: 'air_quality_dashboard_rollup',
      from: 'air_quality_dashboard_rollup AS source',
      dimensions: {
        date: 'source.observed_date',
        station: 'source.station'
      },
      metrics: {
        observationCount: 'SUM(source.observation_count)',
        stationCount: 'COUNT(DISTINCT source.station)',
        pm25Average: 'SUM(source.pm25_avg * source.observation_count) * 1.0 / NULLIF(SUM(CASE WHEN source.pm25_avg IS NOT NULL THEN source.observation_count ELSE 0 END), 0)',
        pm25Peak: 'MAX(source.pm25_max)',
        pm10Average: 'SUM(source.pm10_avg * source.observation_count) * 1.0 / NULLIF(SUM(CASE WHEN source.pm10_avg IS NOT NULL THEN source.observation_count ELSE 0 END), 0)',
        no2Average: 'SUM(source.no2_avg * source.observation_count) * 1.0 / NULLIF(SUM(CASE WHEN source.no2_avg IS NOT NULL THEN source.observation_count ELSE 0 END), 0)',
        so2Average: 'SUM(source.so2_avg * source.observation_count) * 1.0 / NULLIF(SUM(CASE WHEN source.so2_avg IS NOT NULL THEN source.observation_count ELSE 0 END), 0)',
        o3Average: 'SUM(source.o3_avg * source.observation_count) * 1.0 / NULLIF(SUM(CASE WHEN source.o3_avg IS NOT NULL THEN source.observation_count ELSE 0 END), 0)',
        temperatureAverage: 'SUM(source.temperature_avg * source.observation_count) * 1.0 / NULLIF(SUM(CASE WHEN source.temperature_avg IS NOT NULL THEN source.observation_count ELSE 0 END), 0)',
        rainTotal: 'SUM(source.rain_total)'
      },
      rowCountSql: 'SUM(source.observation_count)'
    },
    {
      id: 'observation-detail',
      table: 'air_quality_observations',
      from: 'air_quality_observations AS source',
      dimensions: {
        date: "substr(source.observed_at, 1, 10)",
        station: 'source.station'
      },
      metrics: {
        observationCount: 'COUNT(*)',
        stationCount: 'COUNT(DISTINCT source.station)',
        pm25Average: 'AVG(source.pm25)',
        pm25Peak: 'MAX(source.pm25)',
        pm10Average: 'AVG(source.pm10)',
        no2Average: 'AVG(source.no2)',
        so2Average: 'AVG(source.so2)',
        o3Average: 'AVG(source.o3)',
        temperatureAverage: 'AVG(source.temperature)',
        rainTotal: 'SUM(COALESCE(source.rain, 0))'
      },
      rowCountSql: 'COUNT(*)'
    }
  ],
  facets: [
    { id: 'stations', dimensionId: 'station' }
  ]
};
