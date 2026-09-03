-- @param {String}   $1:userId      The ID of the user
-- @param {String}   $2:messageType The type of the message
-- @param {DateTime} $3:fromDate    Start of the period (DateTime)
-- @param {DateTime} $4:toDate      End of the period (DateTime)
SELECT COUNT(*) AS total
FROM Message m
JOIN Conversation c ON c.id = m.conversationId
WHERE c.userId = ?
  AND m.type = ?
  AND m.createdAt >= ?
  AND m.createdAt <= ?;
