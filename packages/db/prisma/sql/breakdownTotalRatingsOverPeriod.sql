-- @param {String}   $1:userId The ID of the user
-- @param {DateTime} $2:startDate The start date for the period
-- @param {DateTime} $3:endDate The end date for the period
SELECT 
  DATE(createdAt) as date,
  COUNT(*) as total,
  COUNT(CASE WHEN value > 0 THEN 1 END) as thumbsUp,
  COUNT(CASE WHEN value < 0 THEN 1 END) as thumbsDown
FROM Rating
WHERE userId = ?
  AND createdAt >= ?
  AND createdAt <= ?
GROUP BY DATE(createdAt)
ORDER BY date ASC;
