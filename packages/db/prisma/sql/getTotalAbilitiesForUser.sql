-- @param {String} $1:userId The ID of the user
-- @param {String} $2:effectiveUserId The ID of the user
SELECT COUNT(*) as count
FROM Ability a
JOIN Skillset s ON a.skillsetId = s.id
JOIN User u ON s.userId = u.id
WHERE u.parentId = ? OR u.id = ?;
