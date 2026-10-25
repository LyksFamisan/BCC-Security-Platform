-- New camera punches support multiple in/out cycles; legacy/imported rows stay intact.
CREATE UNIQUE INDEX IF NOT EXISTS attendance_punch_cycle_event
ON operational_records(subject_id,(data->>'shift_id'),(data->>'cycle'),(data->>'event'))
WHERE kind='attendance_punch';
