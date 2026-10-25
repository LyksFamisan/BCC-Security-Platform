CREATE TABLE account_controls (
 user_id uuid PRIMARY KEY REFERENCES users(id), active boolean NOT NULL DEFAULT true,
 revision integer NOT NULL DEFAULT 0
);
CREATE TABLE revoked_sessions (id uuid PRIMARY KEY, expires_at timestamptz NOT NULL);
CREATE TABLE site_settings (
 site_id uuid PRIMARY KEY REFERENCES sites(id), client_name text NOT NULL DEFAULT '',
 required_guards integer NOT NULL DEFAULT 1 CHECK(required_guards BETWEEN 1 AND 10000),
 latitude double precision, longitude double precision, radius_m integer NOT NULL DEFAULT 300,
 CHECK(latitude BETWEEN -90 AND 90), CHECK(longitude BETWEEN -180 AND 180), CHECK(radius_m BETWEEN 20 AND 10000)
);
CREATE TABLE operational_records (
 id uuid PRIMARY KEY, kind text NOT NULL, site_id uuid NOT NULL REFERENCES sites(id),
 subject_id uuid REFERENCES users(id), created_by uuid NOT NULL REFERENCES users(id),
 data jsonb NOT NULL, version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX operational_scope ON operational_records(kind,site_id,subject_id);
CREATE TABLE operation_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id uuid NOT NULL REFERENCES users(id),
 record_id uuid, site_id uuid REFERENCES sites(id), action text NOT NULL,
 details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE user_preferences (
 user_id uuid PRIMARY KEY REFERENCES users(id), data jsonb NOT NULL DEFAULT '{}'
);
CREATE TABLE notification_reads (
 user_id uuid REFERENCES users(id), notification_key text NOT NULL, read_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,notification_key)
);
CREATE TABLE technical_settings (
 key text PRIMARY KEY, value jsonb NOT NULL, updated_by uuid NOT NULL REFERENCES users(id), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE incidents ADD COLUMN classification text NOT NULL DEFAULT 'Unclassified';
ALTER TABLE incidents ADD COLUMN severity text NOT NULL DEFAULT 'Medium' CHECK(severity IN ('Low','Medium','High','Critical'));
ALTER TABLE incidents ADD COLUMN approval text NOT NULL DEFAULT 'Pending' CHECK(approval IN ('Pending','Approved','Returned'));
ALTER TABLE incidents ADD COLUMN investigation text NOT NULL DEFAULT '';
ALTER TABLE incidents ADD COLUMN root_cause text NOT NULL DEFAULT '';
ALTER TABLE incidents ADD COLUMN due_at timestamptz;
ALTER TABLE incidents ADD COLUMN resolved_at timestamptz;
ALTER TABLE incidents ADD COLUMN version integer NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX attendance_unique_event ON operational_records(subject_id,(data->>'shift_id'),(data->>'event')) WHERE kind='attendance';
CREATE UNIQUE INDEX attendance_external_id ON operational_records((data->>'external_id')) WHERE kind='attendance' AND data ? 'external_id';
CREATE UNIQUE INDEX equipment_unique_serial ON operational_records((data->>'serial')) WHERE kind='equipment';
CREATE UNIQUE INDEX equipment_single_recipient ON operational_records((data->>'equipment_id')) WHERE kind='assignments' AND data->>'returned_at' IS NULL;
