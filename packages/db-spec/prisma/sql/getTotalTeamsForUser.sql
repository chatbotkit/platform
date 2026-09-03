-- @param {String} $1:userId The ID of the user
-- @param {String} $2:effectiveUserId The ID of the user
SELECT COUNT(*) as count
FROM Team t
JOIN User u ON t.userId = u.id
WHERE u.parentId = ? OR u.id = ?;
