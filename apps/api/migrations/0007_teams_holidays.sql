-- Full-day public holidays (D3, E2b-D4): empty by default, imported or added by an admin.
CREATE TABLE public_holiday (
	id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	holiday_date DATE NOT NULL UNIQUE,
	label TEXT NOT NULL CHECK (char_length(label) BETWEEN 1 AND 100),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER public_holiday_set_updated_at
	BEFORE UPDATE ON public_holiday
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();
