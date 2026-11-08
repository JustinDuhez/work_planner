-- Counting starts at the employment start date, not at the account's audit timestamp (E4-D8).
ALTER TABLE app_user ADD COLUMN start_date DATE;
-- One-off backfill of existing rows; APP_TIMEZONE is Europe/Paris. New rows set it explicitly.
UPDATE app_user SET start_date = (created_at AT TIME ZONE 'Europe/Paris')::date;
ALTER TABLE app_user ALTER COLUMN start_date SET NOT NULL;

CREATE TABLE counter_reset (
	id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	user_id INTEGER NOT NULL REFERENCES app_user (id),
	reset_date DATE NOT NULL,
	author_id INTEGER NOT NULL REFERENCES app_user (id),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The reset that applies is the most recently created one.
CREATE INDEX counter_reset_user_id_created_at_idx ON counter_reset (user_id, created_at DESC, id DESC);

CREATE TRIGGER counter_reset_set_updated_at
	BEFORE UPDATE ON counter_reset
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE daily_minutes_change (
	id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	user_id INTEGER NOT NULL REFERENCES app_user (id),
	effective_date DATE NOT NULL,
	previous_daily_minutes INTEGER NOT NULL CHECK (previous_daily_minutes BETWEEN 1 AND 1440),
	author_id INTEGER NOT NULL REFERENCES app_user (id),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE (user_id, effective_date)
);

CREATE TRIGGER daily_minutes_change_set_updated_at
	BEFORE UPDATE ON daily_minutes_change
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();
