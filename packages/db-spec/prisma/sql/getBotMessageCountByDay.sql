-- @param {String}   $1:userId   The ID of the user
-- @param {String}   $2:botId    The ID of the bot
-- @param {DateTime} $3:fromDate Inclusive start of the period
-- @param {DateTime} $4:toDate   Inclusive end of the period
SELECT DATE(m.createdAt) AS date, COUNT(*) AS total
FROM Message m
JOIN Conversation c ON c.id = m.conversationId
WHERE c.userId = ?
  AND c.botId = ?
  AND m.createdAt >= ?
  AND m.createdAt <= ?
GROUP BY DATE(m.createdAt)
ORDER BY date ASC;
