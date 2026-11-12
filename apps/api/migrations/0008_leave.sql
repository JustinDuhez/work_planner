-- Day types are reference data, not demo data: the app cannot work without them.
CREATE TABLE day_type (
	id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	code TEXT NOT NULL UNIQUE,
	label TEXT NOT NULL,
	color TEXT NOT NULL CHECK (color ~ '^#[0-9a-f]{6}$'),
	requires_approval BOOLEAN NOT NULL,
	is_badgeable BOOLEAN NOT NULL,
	is_requestable BOOLEAN NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER day_type_set_updated_at
	BEFORE UPDATE ON day_type
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Telework's approval depends on the 3-day rule; requires_approval states the default.
INSERT INTO day_type (code, label, color, requires_approval, is_badgeable, is_requestable) VALUES
	('on_site', 'Sur site', '#94a3b8', FALSE, TRUE, FALSE),
	('telework', 'Télétravail', '#0ea5e9', FALSE, TRUE, TRUE),
	('telework_week', 'Semaine de télétravail', '#0284c7', TRUE, TRUE, FALSE),
	('recovery', 'Récupération', '#8b5cf6', TRUE, FALSE, TRUE),
	('sick', 'Maladie', '#ef4444', TRUE, FALSE, TRUE),
	('leave', 'Congé', '#10b981', TRUE, FALSE, TRUE),
	('training_travel', 'Formation / déplacement', '#f59e0b', TRUE, FALSE, TRUE),
	('early_departure', 'Départ anticipé', '#ec4899', TRUE, FALSE, TRUE);

CREATE TABLE leave_request (
	id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	user_id INTEGER NOT NULL REFERENCES app_user (id),
	day_type_id INTEGER NOT NULL REFERENCES day_type (id),
	start_date DATE NOT NULL,
	start_half TEXT NOT NULL CHECK (start_half IN ('am', 'pm')),
	end_date DATE NOT NULL,
	end_half TEXT NOT NULL CHECK (end_half IN ('am', 'pm')),
	half_day_count INTEGER NOT NULL CHECK (half_day_count > 0),
	status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'refused', 'cancelled')),
	reason TEXT CHECK (char_length(reason) <= 500),
	rule_note TEXT,
	is_auto_approved BOOLEAN NOT NULL DEFAULT FALSE,
	reviewer_id INTEGER REFERENCES app_user (id),
	review_comment TEXT CHECK (char_length(review_comment) <= 500),
	reviewed_at TIMESTAMPTZ,
	cancelled_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CHECK (start_date < end_date OR (start_date = end_date AND NOT (start_half = 'pm' AND end_half = 'am')))
);

CREATE INDEX leave_request_user_id_start_date_idx ON leave_request (user_id, start_date);
CREATE INDEX leave_request_status_idx ON leave_request (status);

CREATE TRIGGER leave_request_set_updated_at
	BEFORE UPDATE ON leave_request
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- The materialized truth read by the week, the counters and the telework rule (parent spec §4).
CREATE TABLE half_day (
	id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	user_id INTEGER NOT NULL REFERENCES app_user (id),
	work_date DATE NOT NULL,
	half TEXT NOT NULL CHECK (half IN ('am', 'pm')),
	day_type_id INTEGER NOT NULL REFERENCES day_type (id),
	leave_request_id INTEGER NOT NULL REFERENCES leave_request (id) ON DELETE CASCADE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE (user_id, work_date, half)
);

CREATE INDEX half_day_leave_request_id_idx ON half_day (leave_request_id);

CREATE TRIGGER half_day_set_updated_at
	BEFORE UPDATE ON half_day
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();
