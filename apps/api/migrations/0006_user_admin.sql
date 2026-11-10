-- Set when an admin chose the password (account creation, reset): the person must pick their own.
ALTER TABLE app_user ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
