-- @param {String}   $1:userId   The ID of the user
-- @param {DateTime} $2:fromDate Start of the period (DateTime)
-- @param {DateTime} $3:toDate   End of the period (DateTime)
SELECT 
  DATE(c.createdAt) AS date,
  COUNT(DISTINCT c.contactId) AS total
FROM Conversation c
WHERE c.userId = ?
  AND c.contactId IS NOT NULL
  AND c.createdAt >= ?
  AND c.createdAt <= ?
GROUP BY DATE(c.createdAt)
ORDER BY date ASC
