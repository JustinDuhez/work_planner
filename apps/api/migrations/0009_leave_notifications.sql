ALTER TABLE notification DROP CONSTRAINT notification_type_check;
ALTER TABLE notification ADD CONSTRAINT notification_type_check CHECK (type IN (
	'clock_correction_received',
	'clock_correction_answered',
	'leave_request_received',
	'leave_request_reviewed',
	'leave_request_cancelled'
));
