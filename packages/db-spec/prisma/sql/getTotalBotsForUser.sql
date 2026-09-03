-- @param {String} $1:userId The ID of the user
-- @param {String} $2:effectiveUserId The ID of the user
SELECT COUNT(*) as count
FROM Bot b
JOIN User u ON b.userId = u.id
WHERE u.parentId = ? OR u.id = ?;
