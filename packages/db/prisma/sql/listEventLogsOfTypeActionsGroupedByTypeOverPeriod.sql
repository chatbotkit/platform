-- @param {String}   $1:userId   The ID of the user
-- @param {DateTime} $2:fromDate Start of the period (DateTime)
-- @param {DateTime} $3:toDate   End of the period (DateTime)
-- @param {Int}      $4:limit    The maximum number of action types to return (optional)
SELECT 
  el.type,
  el.name,
  el.description,
  COUNT(el.id) AS _countValue,
  'action' AS _countType
FROM EventLog el
WHERE el.userId = ?
  AND el.type LIKE 'action.%'
  AND el.createdAt >= ?
  AND el.createdAt <= ?
GROUP BY el.type, el.name, el.description
ORDER BY _countValue DESC, el.type ASC
LIMIT ?;
