-- @param {String}   $1:userId         The ID of the user
-- @param {String}   $2:conversationId The ID of the conversation
-- @param {DateTime} $3:fromDate       Start of the period (DateTime)
-- @param {DateTime} $4:toDate         End of the period (DateTime)
SELECT 
  COALESCE(SUM(CASE 
    WHEN type = 'CHATBOTKIT_BASE_TOKEN' THEN count 
    ELSE 0 
  END), 0) AS totalTokens,
  COALESCE(SUM(CASE 
    WHEN type = 'CHATBOTKIT_MESSAGE' THEN count 
    ELSE 0 
  END), 0) AS totalMessages
FROM Usage
WHERE userId = ?
  AND conversationId = ?
  AND createdAt >= ?
  AND createdAt <= ?;
