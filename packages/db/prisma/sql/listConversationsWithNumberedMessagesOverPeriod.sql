-- @param {String}   $1:userId         The ID of the user
-- @param {DateTime} $2:fromDate       Start of the period (DateTime)
-- @param {DateTime} $3:toDate         End of the period (DateTime)
-- @param {Int}      $4:messageCount   Minimum number of messages for follow-ups
-- @param {Int}      $5:limit          The maximum number of conversations to return (optional)
SELECT 
  c.id,
  c.createdAt,
  co.name,
  co.email,
  co.nick,
  co.description,
  COUNT(m.id) AS messageCount
FROM Conversation c
JOIN Contact co ON c.contactId = co.id
LEFT JOIN Message m ON c.id = m.conversationId
WHERE c.userId = ?
  AND c.contactId IS NOT NULL
  AND c.createdAt >= ?
  AND c.createdAt <= ?
GROUP BY c.id, c.createdAt, co.name, co.email, co.nick, co.description
HAVING COUNT(m.id) >= ?
ORDER BY messageCount DESC, c.createdAt DESC
LIMIT ?;
