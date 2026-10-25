CREATE TABLE sites (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE users (id uuid PRIMARY KEY, name text NOT NULL, email text UNIQUE NOT NULL, password_hash text NOT NULL, role text NOT NULL CHECK(role IN ('admin','supervisor','guard')));
CREATE TABLE user_sites (user_id uuid REFERENCES users(id), site_id uuid REFERENCES sites(id), PRIMARY KEY(user_id,site_id));
CREATE TABLE incidents (id uuid PRIMARY KEY, title text NOT NULL, description text NOT NULL, location text NOT NULL, site_id uuid NOT NULL REFERENCES sites(id), reporter_id uuid NOT NULL REFERENCES users(id), assignee_id uuid REFERENCES users(id), photo_key text, status text NOT NULL DEFAULT 'Submitted' CHECK(status IN ('Submitted','Under Review','In Progress','Resolved')), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX incidents_reporter ON incidents(reporter_id);
CREATE INDEX incidents_site ON incidents(site_id);
CREATE TABLE audit_events (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, incident_id uuid REFERENCES incidents(id), actor_id uuid NOT NULL REFERENCES users(id), action text NOT NULL, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
