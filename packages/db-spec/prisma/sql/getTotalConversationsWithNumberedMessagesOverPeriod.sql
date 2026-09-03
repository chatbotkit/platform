-- @param {String}   $1:userId       The ID of the user
-- @param {DateTime} $2:fromDate     Start of the period (DateTime)
-- @param {DateTime} $3:toDate       End of the period (DateTime)
-- @param {Int}      $4:minMessages  Minimum number of messages per conversation in the period
SELECT COUNT(*) AS total
FROM (
  SELECT m.conversationId
  FROM Message m
  JOIN Conversation c ON c.id = m.conversationId
  WHERE c.userId = ?
    AND m.createdAt >= ?
    AND m.createdAt <= ?
  GROUP BY m.conversationId
  HAVING COUNT(*) >= ?
) AS conversations_with_min_messages_in_period;
