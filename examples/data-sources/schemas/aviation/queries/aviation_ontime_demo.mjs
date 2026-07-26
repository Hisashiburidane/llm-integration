const metrics = {
  flightCount: 'COUNT(*)',
  onTimeRate: 'AVG(source.on_time)',
  averageDepartureDelay: 'AVG(source.dep_delay)',
  p95DepartureDelay: { type: 'percentile', field: 'source.dep_delay', percentile: 95 },
  cancellationRate: 'AVG(source.cancelled)',
  severeDelayCount: 'SUM(source.severe_delay)',
  delayMinutes: 'SUM(source.delay_minutes)'
};

export default {
  id: 'aviation_ontime_demo',
  title: 'Flight operations',
  sources: [
    {
      id: 'daily-rollup',
      table: 'aviation_dashboard_rollup',
      from: `(SELECT rollup.*,
        COALESCE(airport.name_zh, '机场（' || rollup.origin || '）') AS airport_label,
        COALESCE(cause.label_zh, rollup.delay_cause) AS delay_cause_label
        FROM aviation_dashboard_rollup AS rollup
        LEFT JOIN aviation_airport_dictionary AS airport ON airport.code = rollup.origin
        LEFT JOIN aviation_delay_cause_dictionary AS cause ON cause.code = rollup.delay_cause) AS source`,
      dimensions: {
        hour: 'source.hour',
        airport: { sql: 'source.origin', labelSql: 'source.airport_label' },
        carrier: 'source.carrier',
        direction: 'source.direction',
        delayCause: { sql: 'source.delay_cause', labelSql: 'source.delay_cause_label' }
      },
      metrics: {
        flightCount: 'SUM(source.flight_count)',
        onTimeRate: 'SUM(source.on_time_count) * 1.0 / NULLIF(SUM(source.flight_count), 0)',
        averageDepartureDelay: 'SUM(source.dep_delay_sum) * 1.0 / NULLIF(SUM(source.flight_count), 0)',
        cancellationRate: 'SUM(source.cancelled_count) * 1.0 / NULLIF(SUM(source.flight_count), 0)',
        severeDelayCount: 'SUM(source.severe_delay_count)',
        delayMinutes: 'SUM(source.delay_minutes_sum)'
      },
      rowCountSql: 'SUM(source.flight_count)'
    },
    {
      id: 'flight-detail',
      table: 'aviation_flights',
      from: `(SELECT flight.*,
        COALESCE(airport.name_zh, '机场（' || flight.origin || '）') AS airport_label,
        COALESCE(destination.name_zh, '机场（' || flight.destination || '）') AS destination_label,
        COALESCE(cause.label_zh, flight.delay_cause) AS delay_cause_label
        FROM aviation_flights AS flight
        LEFT JOIN aviation_airport_dictionary AS airport ON airport.code = flight.origin
        LEFT JOIN aviation_airport_dictionary AS destination ON destination.code = flight.destination
        LEFT JOIN aviation_delay_cause_dictionary AS cause ON cause.code = flight.delay_cause) AS source`,
      dimensions: {
        date: 'source.flight_date',
        hour: 'source.hour',
        airport: { sql: 'source.origin', labelSql: 'source.airport_label' },
        destination: { sql: 'source.destination', labelSql: 'source.destination_label' },
        carrier: 'source.carrier',
        direction: 'source.direction',
        delayCause: { sql: 'source.delay_cause', labelSql: 'source.delay_cause_label' },
        flightId: 'source.flight_id'
      },
      metrics,
      rowCountSql: 'COUNT(*)'
    }
  ],
  facets: [
    { id: 'airports', dimensionId: 'airport' },
    { id: 'carriers', dimensionId: 'carrier' }
  ]
};
