-- @param {String}   $1:userId The ID of the user
-- @param {DateTime} $2:startDate The start date for the period
-- @param {DateTime} $3:endDate The end date for the period
-- @param {Int}      $4:limit The maximum number of contacts to return
SELECT 
  c.id,
  c.name,
  c.description,
  c.email,
  c.nick,
  c.meta,
  c.createdAt,
  COUNT(CASE WHEN r.value > 0 THEN 1 END) as _countValue,
  'upvote' as _countType
FROM Contact c
LEFT JOIN Rating r ON c.id = r.contactId 
  AND r.userId = ?
  AND r.createdAt >= ?
  AND r.createdAt <= ?
WHERE c.userId = r.userId
GROUP BY c.id, c.name, c.description, c.email, c.nick, c.meta, c.createdAt
HAVING _countValue > 0
ORDER BY _countValue DESC
LIMIT ?;
