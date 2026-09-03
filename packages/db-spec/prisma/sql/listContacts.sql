-- @param {String} $1:userId The ID of the user
-- @param {Int}    $2:limit  The maximum number of contacts to return (optional)
SELECT id, name, description, email, nick, meta, createdAt
FROM Contact
WHERE userId = ?
ORDER BY createdAt DESC
LIMIT ?;
