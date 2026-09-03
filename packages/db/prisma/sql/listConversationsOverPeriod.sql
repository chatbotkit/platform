-- @param {String}   $1:userId         The ID of the user
-- @param {DateTime} $2:fromDate       Start of the period (DateTime)
-- @param {DateTime} $3:toDate         End of the period (DateTime)
-- @param {Int}      $4:limit          The maximum number of conversations to return (optional)
SELECT 
  c.id,
  co.id AS contactId,
  co.name,
  co.email,
  co.nick,
  co.description,
  co.meta,
  c.createdAt,
  COUNT(m.id) AS _countValue,
  'message' AS _countType
FROM Conversation c
JOIN Contact co ON c.contactId = co.id
LEFT JOIN Message m ON c.id = m.conversationId
WHERE c.userId = ?
  AND c.contactId IS NOT NULL
  AND c.createdAt >= ?
  AND c.createdAt <= ?
GROUP BY c.id, c.createdAt, co.id, co.name, co.email, co.nick, co.description
ORDER BY _countValue DESC, c.createdAt DESC
LIMIT ?;
