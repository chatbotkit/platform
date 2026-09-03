-- @param {String}   $1:userMessageType The message type that marks a user turn
-- @param {String}   $2:userId          The ID of the user
-- @param {String}   $3:botId           The ID of the bot
-- @param {DateTime} $4:fromDate        Inclusive start of the period
-- @param {DateTime} $5:toDate          Inclusive end of the period
SELECT COUNT(*) AS total
FROM (
  SELECT c.id
  FROM Conversation c
  JOIN Message m ON m.conversationId = c.id AND m.type = ?
  WHERE c.userId = ?
    AND c.botId = ?
    AND c.createdAt >= ?
    AND c.createdAt <= ?
  GROUP BY c.id
) AS conversationsWithUserMessages;
