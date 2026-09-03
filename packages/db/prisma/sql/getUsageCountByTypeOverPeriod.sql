-- @param {String}   $1:userId   The ID of the user
-- @param {String}   $2:type     The usage type
-- @param {DateTime} $3:fromDate Inclusive start of the period
-- @param {DateTime} $4:toDate   Inclusive end of the period
SELECT
  DATE(createdAt) AS date,
  COALESCE(SUM(count), 0) AS total
FROM Usage
WHERE userId = ?
  AND type = ?
  AND createdAt >= ?
  AND createdAt <= ?
GROUP BY DATE(createdAt)
ORDER BY date ASC;
