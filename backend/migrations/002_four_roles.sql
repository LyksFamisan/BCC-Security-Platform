-- Preserve legacy operational administrators as SSD. New 'admin' accounts are technical only.
ALTER TABLE users DROP CONSTRAINT users_role_check;
UPDATE users SET role='operations' WHERE role='admin';
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK(role IN ('admin','operations','supervisor','guard'));
