-- @param {String}   $1:userId   The ID of the user
-- @param {DateTime} $2:fromDate Start of the period (DateTime)
-- @param {DateTime} $3:toDate   End of the period (DateTime)
-- @param {Int}      $4:limit    The maximum number of results to return
SELECT 
  u.contactId AS id,
  c.name AS name,
  c.description AS description,
  COALESCE(SUM(u.count), 0) AS total
FROM Usage u
LEFT JOIN Contact c ON u.contactId = c.id
WHERE u.userId = ?
  AND u.contactId IS NOT NULL
  AND u.type LIKE '%_TOKEN'
  AND u.createdAt >= ?
  AND u.createdAt <= ?
GROUP BY u.contactId, c.name, c.description
ORDER BY total DESC
LIMIT ?;
