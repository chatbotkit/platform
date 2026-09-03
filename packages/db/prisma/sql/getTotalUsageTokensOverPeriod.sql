-- @param {String}   $1:userId   The ID of the user
-- @param {DateTime} $2:fromDate Start of the period (DateTime)
-- @param {DateTime} $3:toDate   End of the period (DateTime)
SELECT 
  COALESCE(SUM(u.count), 0) AS total
FROM Usage u
WHERE u.userId = ?
  AND u.type LIKE '%_TOKEN'
  AND u.createdAt >= ?
  AND u.createdAt <= ?;
