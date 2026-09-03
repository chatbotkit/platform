-- @param {String}   $1:userId   The ID of the user
-- @param {String}   $2:botId    The ID of the bot
-- @param {DateTime} $3:fromDate Start of the period (DateTime)
-- @param {DateTime} $4:toDate   End of the period (DateTime)
SELECT 
  COALESCE(SUM(CASE 
    WHEN type = 'CHATBOTKIT_BASE_TOKEN' THEN count 
    ELSE 0 
  END), 0) AS totalTokens,
  COALESCE(SUM(CASE 
    WHEN type = 'CHATBOTKIT_CONVERSATION' THEN count 
    ELSE 0 
  END), 0) AS totalConversations,
  COALESCE(SUM(CASE 
    WHEN type = 'CHATBOTKIT_MESSAGE' THEN count 
    ELSE 0 
  END), 0) AS totalMessages
FROM Usage
WHERE userId = ?
  AND botId = ?
  AND createdAt >= ?
  AND createdAt <= ?;
