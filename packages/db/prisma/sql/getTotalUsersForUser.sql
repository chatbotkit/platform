-- @param {String} $1:userId The ID of the user
SELECT COUNT(*) as count
FROM User u
WHERE u.parentId = ?;
