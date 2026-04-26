-- This file will be executed after the default user creation
-- We use this to ensure 127.0.0.1 access is explicitly granted
-- Note: We use the environment variable names as placeholders is not possible in .sql,
-- but MariaDB entrypoint allows using .sh to do this.
-- However, since we're on Windows, let's stick to a more robust approach.

-- If we can't easily get the password here, we'll just use a shell script
-- that we know will work.
