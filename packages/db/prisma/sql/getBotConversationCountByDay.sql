-- @param {String}   $1:userId   The ID of the user
-- @param {String}   $2:botId    The ID of the bot
-- @param {DateTime} $3:fromDate Inclusive start of the period
-- @param {DateTime} $4:toDate   Inclusive end of the period
SELECT DATE(createdAt) AS date, COUNT(*) AS total
FROM Conversation
WHERE userId = ?
  AND botId = ?
  AND createdAt >= ?
  AND createdAt <= ?
GROUP BY DATE(createdAt)
ORDER BY date ASC;
