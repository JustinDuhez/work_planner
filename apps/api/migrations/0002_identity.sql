CREATE TABLE app_user (
	id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	email TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
	password_hash TEXT NOT NULL,
	first_name TEXT NOT NULL,
	last_name TEXT NOT NULL,
	is_admin BOOLEAN NOT NULL DEFAULT FALSE,
	is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
	archived_at TIMESTAMPTZ,
	daily_minutes INTEGER NOT NULL DEFAULT 420 CHECK (daily_minutes BETWEEN 1 AND 1440),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER app_user_set_updated_at
	BEFORE UPDATE ON app_user
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE session (
	id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	token_hash TEXT NOT NULL UNIQUE,
	user_id INTEGER NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
	csrf_token TEXT NOT NULL,
	last_seen_at TIMESTAMPTZ NOT NULL,
	expires_at TIMESTAMPTZ NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX session_user_id_idx ON session (user_id);

CREATE TRIGGER session_set_updated_at
	BEFORE UPDATE ON session
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE team (
	id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	name TEXT NOT NULL UNIQUE,
	parent_team_id INTEGER REFERENCES team (id),
	manager_id INTEGER REFERENCES app_user (id),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CHECK (parent_team_id <> id)
);

CREATE INDEX team_parent_team_id_idx ON team (parent_team_id);
CREATE INDEX team_manager_id_idx ON team (manager_id);

CREATE TRIGGER team_set_updated_at
	BEFORE UPDATE ON team
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE team_member (
	team_id INTEGER NOT NULL REFERENCES team (id) ON DELETE CASCADE,
	user_id INTEGER NOT NULL REFERENCES app_user (id),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	PRIMARY KEY (team_id, user_id)
);

CREATE INDEX team_member_user_id_idx ON team_member (user_id);

CREATE TRIGGER team_member_set_updated_at
	BEFORE UPDATE ON team_member
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();
