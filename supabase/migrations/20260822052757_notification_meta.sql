-- Navigation context for a notification (e.g. the date of the attendance row
-- it refers to) so the UI can deep-link straight to the record.
alter table notifications add column if not exists meta jsonb;
