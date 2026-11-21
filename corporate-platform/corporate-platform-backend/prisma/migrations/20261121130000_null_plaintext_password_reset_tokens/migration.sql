-- #810: existing passwordResetToken values were stored as plaintext, not a
-- hash. Null them out (and their expiry) so no plaintext token remains
-- usable; any user with a pending reset simply requests a new one, which
-- is now stored correctly as sha256(token).
UPDATE "User"
SET "passwordResetToken" = NULL,
    "passwordResetExpires" = NULL
WHERE "passwordResetToken" IS NOT NULL;
