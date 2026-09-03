-- @param {String}   $1:userId   The ID of the user
-- @param {DateTime} $2:fromDate Inclusive start of the period
-- @param {DateTime} $3:toDate   Inclusive end of the period
SELECT DATE(createdAt) AS date, COUNT(*) AS total
FROM Rating
WHERE userId = ?
  AND value < 0
  AND createdAt >= ?
  AND createdAt <= ?
GROUP BY DATE(createdAt)
ORDER BY date ASC;
