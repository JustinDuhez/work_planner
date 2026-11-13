-- E6b: a manager may declare an absence for someone; the author is whoever created the request.
ALTER TABLE leave_request ADD COLUMN author_id INTEGER REFERENCES app_user (id);

-- Who cancelled: the owner, or a manager / admin of their scope.
ALTER TABLE leave_request ADD COLUMN cancelled_by_id INTEGER REFERENCES app_user (id);

-- History: before E6b only owners created and cancelled requests (E6a).
UPDATE leave_request SET author_id = user_id, cancelled_by_id = CASE WHEN status = 'cancelled' THEN user_id END;
ALTER TABLE leave_request ALTER COLUMN author_id SET NOT NULL;

ALTER TABLE notification DROP CONSTRAINT notification_type_check;
ALTER TABLE notification ADD CONSTRAINT notification_type_check CHECK (type IN (
	'clock_correction_received',
	'clock_correction_answered',
	'leave_request_received',
	'leave_request_reviewed',
	'leave_request_cancelled',
	'leave_request_declared',
	'leave_request_withdrawn'
));
