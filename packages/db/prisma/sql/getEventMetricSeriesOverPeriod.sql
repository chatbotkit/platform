-- @param {String}   $1:userId   The ID of the user
-- @param {String}   $2:type     The event metric type
-- @param {DateTime} $3:fromDate Inclusive start of the period (DateTime)
SELECT
  DATE(createdAt) AS date,
  COALESCE(SUM(value), 0) AS total
FROM EventMetric
WHERE userId = ?
  AND type = ?
  AND createdAt >= ?
GROUP BY DATE(createdAt)
ORDER BY date ASC;
