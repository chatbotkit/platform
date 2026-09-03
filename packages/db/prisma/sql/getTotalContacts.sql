-- @param {String} $1:userId The ID of the user
SELECT count(*) as total
FROM Contact
WHERE userId = ?;
