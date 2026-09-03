-- @param {String}   $1:userId   The ID of the user
-- @param {DateTime} $2:fromDate Start of the period (DateTime)
-- @param {DateTime} $3:toDate   End of the period (DateTime)
-- @param {Int}      $4:limit    The maximum number of contacts to return (optional)
SELECT 
  co.id,
  co.name,
  co.description,
  co.email,
  co.nick,
  co.meta,
  co.createdAt,
  COUNT(c.id) AS _countValue,
  'conversation' AS _countType
FROM Conversation c
JOIN Contact co ON c.contactId = co.id
WHERE c.userId = ?
  AND c.contactId IS NOT NULL
  AND c.createdAt >= ?
  AND c.createdAt <= ?
GROUP BY co.id, co.name, co.description, co.email, co.nick
ORDER BY _countValue DESC
LIMIT ?;
