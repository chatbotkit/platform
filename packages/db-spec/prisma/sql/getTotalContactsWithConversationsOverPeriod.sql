-- @param {String}   $1:userId   The ID of the user
-- @param {DateTime} $2:fromDate Start of the period (DateTime)
-- @param {DateTime} $3:toDate   End of the period (DateTime)
SELECT COUNT(*) AS total
FROM (
  SELECT c.contactId
  FROM Conversation c
  WHERE c.userId = ?
    AND c.contactId IS NOT NULL
    AND c.createdAt >= ?
    AND c.createdAt <= ?
  GROUP BY c.contactId
) AS distinct_contacts_with_conversations_in_period;
