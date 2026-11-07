CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE clock_day (
	id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	user_id INTEGER NOT NULL REFERENCES app_user (id),
	work_date DATE NOT NULL,
	work_mode TEXT NOT NULL DEFAULT 'on_site' CHECK (work_mode IN ('on_site', 'telework')),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE (user_id, work_date)
);

CREATE TRIGGER clock_day_set_updated_at
	BEFORE UPDATE ON clock_day
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE clock_period (
	id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	clock_day_id INTEGER NOT NULL REFERENCES clock_day (id) ON DELETE CASCADE,
	started_at TIMESTAMPTZ NOT NULL,
	ended_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CONSTRAINT clock_period_end_after_start CHECK (ended_at > started_at),
	CONSTRAINT clock_period_whole_minutes CHECK (
		date_trunc('minute', started_at) = started_at
		AND (ended_at IS NULL OR date_trunc('minute', ended_at) = ended_at)
	)
);

CREATE INDEX clock_period_clock_day_id_idx ON clock_period (clock_day_id);
CREATE UNIQUE INDEX clock_period_one_open_per_day ON clock_period (clock_day_id) WHERE ended_at IS NULL;

-- Added after the unique index above: Postgres checks indexes in creation order, so a second
-- open period reports the more specific clock_period_one_open_per_day.
ALTER TABLE clock_period ADD CONSTRAINT clock_period_no_overlap EXCLUDE USING gist (
	clock_day_id WITH =,
	tstzrange(started_at, COALESCE(ended_at, 'infinity'), '[)') WITH &&
);

CREATE TRIGGER clock_period_set_updated_at
	BEFORE UPDATE ON clock_period
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();
