export default {
  id: 'nyc_taxi_demo',
  title: 'NYC yellow taxi trips',
  sources: [
    {
      id: 'daily-zone-rollup',
      table: 'nyc_taxi_dashboard_rollup',
      from: 'nyc_taxi_dashboard_rollup AS source',
      dimensions: {
        date: 'source.pickup_date',
        borough: { sql: 'source.pickup_borough', labelSql: "COALESCE(NULLIF(source.pickup_borough, ''), '未知行政区')" },
        pickupZone: { sql: 'source.pickup_zone', labelSql: "COALESCE(NULLIF(source.pickup_zone, ''), '未知区域')" },
        pickupLocation: 'source.pickup_location_id'
      },
      metrics: {
        tripCount: 'SUM(source.trip_count)',
        passengerCount: 'SUM(source.passenger_sum)',
        averageTripDistance: 'SUM(source.distance_sum) * 1.0 / NULLIF(SUM(source.trip_count), 0)',
        averageFare: 'SUM(source.fare_sum) * 1.0 / NULLIF(SUM(source.trip_count), 0)',
        averageTip: 'SUM(source.tip_sum) * 1.0 / NULLIF(SUM(source.trip_count), 0)',
        totalRevenue: 'SUM(source.total_amount_sum)',
        averageTripDuration: 'SUM(source.duration_sum) * 1.0 / NULLIF(SUM(source.trip_count), 0)'
      },
      rowCountSql: 'SUM(source.trip_count)'
    },
    {
      id: 'trip-detail',
      table: 'nyc_taxi_trips',
      from: `(SELECT trip.*,
        COALESCE(zone.borough, '未知行政区') AS pickup_borough,
        COALESCE(zone.zone, '区域 ' || trip.pickup_location_id) AS pickup_zone
        FROM nyc_taxi_trips AS trip
        LEFT JOIN nyc_taxi_zones AS zone ON zone.location_id = trip.pickup_location_id) AS source`,
      dimensions: {
        date: "substr(source.pickup_at, 1, 10)",
        borough: 'source.pickup_borough',
        pickupZone: 'source.pickup_zone',
        pickupLocation: 'source.pickup_location_id',
        paymentType: 'source.payment_type'
      },
      metrics: {
        tripCount: 'COUNT(*)',
        passengerCount: 'SUM(COALESCE(source.passenger_count, 0))',
        averageTripDistance: 'AVG(source.trip_distance)',
        averageFare: 'AVG(source.fare_amount)',
        averageTip: 'AVG(source.tip_amount)',
        totalRevenue: 'SUM(source.total_amount)',
        averageTripDuration: 'AVG(source.trip_duration_minutes)'
      },
      rowCountSql: 'COUNT(*)'
    }
  ],
  facets: [
    { id: 'taxiZones', dimensionId: 'pickupZone' }
  ]
};
