CREATE TABLE clock_correction (
	id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	user_id INTEGER NOT NULL REFERENCES app_user (id),
	work_date DATE NOT NULL,
	author_id INTEGER NOT NULL REFERENCES app_user (id),
	-- NULL when the day had no record before the correction.
	before_work_mode TEXT CHECK (before_work_mode IN ('on_site', 'telework')),
	after_work_mode TEXT NOT NULL CHECK (after_work_mode IN ('on_site', 'telework')),
	before_periods JSONB NOT NULL,
	after_periods JSONB NOT NULL,
	comment TEXT CHECK (char_length(comment) <= 500),
	status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'refused', 'superseded')),
	response_comment TEXT CHECK (char_length(response_comment) <= 500),
	responded_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CONSTRAINT clock_correction_answer_time CHECK ((status IN ('accepted', 'refused')) = (responded_at IS NOT NULL))
);

-- At most one correction of a day waits for an answer; a new one supersedes it first.
CREATE UNIQUE INDEX clock_correction_one_pending_per_day ON clock_correction (user_id, work_date) WHERE status = 'pending';
CREATE INDEX clock_correction_user_id_work_date_idx ON clock_correction (user_id, work_date, created_at DESC, id DESC);

CREATE TRIGGER clock_correction_set_updated_at
	BEFORE UPDATE ON clock_correction
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE notification (
	id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	user_id INTEGER NOT NULL REFERENCES app_user (id),
	type TEXT NOT NULL CHECK (type IN ('clock_correction_received', 'clock_correction_answered')),
	payload JSONB NOT NULL,
	read_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX notification_user_id_created_at_idx ON notification (user_id, created_at DESC, id DESC);
CREATE INDEX notification_unread_idx ON notification (user_id) WHERE read_at IS NULL;

CREATE TRIGGER notification_set_updated_at
	BEFORE UPDATE ON notification
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();
