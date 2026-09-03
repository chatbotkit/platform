-- @param {String}   $1:userId The ID of the user
-- @param {DateTime} $2:startDate The start date for the period  
-- @param {DateTime} $3:endDate The end date for the period
SELECT count(*) as total
FROM Rating
WHERE userId = ?
  AND value <= 0
  AND createdAt >= ?
  AND createdAt <= ?;
