-- @param {String}   $1:userId     The ID of the user
-- @param {String}   $2:type       The message type ('user', 'bot', 'activity')
-- @param {DateTime} $3:fromDate   Start of the period (DateTime)
-- @param {DateTime} $4:toDate     End of the period (DateTime)
SELECT 
  DATE(m.createdAt) AS date,
  COUNT(m.id) AS total
FROM Message m
JOIN Conversation c ON m.conversationId = c.id
WHERE c.userId = ?
  AND m.type = ?
  AND c.contactId IS NOT NULL
  AND m.createdAt >= ?
  AND m.createdAt <= ?
GROUP BY DATE(m.createdAt)
ORDER BY date ASC
