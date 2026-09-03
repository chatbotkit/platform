-- @param {String}   $1:userId      The ID of the user
-- @param {String}   $2:messageType The type of the message (e.g., 'bot')
-- @param {DateTime} $3:fromDate    Start of the period (DateTime)
-- @param {DateTime} $4:toDate      End of the period (DateTime)
SELECT COALESCE(AVG(msg_count), 0) AS average
FROM (
  SELECT m.conversationId, COUNT(*) AS msg_count
  FROM Message m
  JOIN Conversation c ON c.id = m.conversationId
  WHERE c.userId = ?
    AND m.type = ?
    AND m.createdAt >= ?
    AND m.createdAt <= ?
  GROUP BY m.conversationId
) AS messages_per_conversation_in_period;
