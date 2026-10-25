CREATE TABLE private_files (
 key text PRIMARY KEY,
 content bytea NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE login_attempts (
 key text NOT NULL, window_start timestamptz NOT NULL, attempts integer NOT NULL DEFAULT 1,
 PRIMARY KEY(key,window_start)
);
