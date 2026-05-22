INSERT INTO roles (name, is_system)
VALUES ('auditor', TRUE)
ON CONFLICT (name) DO UPDATE SET is_system = EXCLUDED.is_system;