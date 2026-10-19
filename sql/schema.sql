-- Teachers on Duty — MySQL 8 / MariaDB 10.4+ schema.
-- Run once in phpMyAdmin (cPanel) on an empty database, then sql/seed.sql.
-- Re-running is safe: every table is CREATE TABLE IF NOT EXISTS; nothing is dropped.

SET NAMES utf8mb4;
SET time_zone = '+07:00';

CREATE TABLE IF NOT EXISTS teachers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title ENUM('Ms.', 'Mr.') NOT NULL,
  name VARCHAR(80) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY teachers_title_name (title, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- "All teachers", "All male teachers", … scope says who a group covers (for "my duties").
CREATE TABLE IF NOT EXISTS duty_groups (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  label_en VARCHAR(120) NOT NULL,
  label_id VARCHAR(120) NOT NULL,
  scope ENUM('all', 'male', 'female', 'none') NOT NULL DEFAULT 'none',
  sort INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Roster versions. The display uses the newest one whose effective_from has arrived.
CREATE TABLE IF NOT EXISTS rosters (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(160) NOT NULL,
  released_on DATE NOT NULL,
  effective_from DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY rosters_effective (effective_from)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sections (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  roster_id INT UNSIGNED NOT NULL,
  name_en VARCHAR(80) NOT NULL,
  name_id VARCHAR(80) NOT NULL,
  sort INT NOT NULL DEFAULT 0,
  CONSTRAINT sections_roster FOREIGN KEY (roster_id) REFERENCES rosters (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row of the roster (e.g. "Supervise indoor field").
-- timing: fixed = real times; approx = rough window shown with "±" (prayer); untimed = never "now".
CREATE TABLE IF NOT EXISTS duties (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  section_id INT UNSIGNED NOT NULL,
  label VARCHAR(200) NOT NULL,
  note VARCHAR(300) NOT NULL DEFAULT '',
  timing ENUM('fixed', 'approx', 'untimed') NOT NULL DEFAULT 'fixed',
  sort INT NOT NULL DEFAULT 0,
  CONSTRAINT duties_section FOREIGN KEY (section_id) REFERENCES sections (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Time windows. Several rows = several windows (break: 08.05–08.25 and 13.05–13.20).
-- weekday NULL = every school day, unless that weekday has rows of its own
-- (afternoon: Mon/Tue/Fri 14.20–15.30, Wed/Thu 14.30–15.45).
CREATE TABLE IF NOT EXISTS duty_times (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  duty_id INT UNSIGNED NOT NULL,
  weekday TINYINT UNSIGNED NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  CONSTRAINT duty_times_duty FOREIGN KEY (duty_id) REFERENCES duties (id) ON DELETE CASCADE,
  CONSTRAINT duty_times_weekday CHECK (weekday IS NULL OR weekday BETWEEN 1 AND 5),
  CONSTRAINT duty_times_order CHECK (end_time > start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One cell: a teacher OR a group. An empty cell has no row.
CREATE TABLE IF NOT EXISTS assignments (
  duty_id INT UNSIGNED NOT NULL,
  weekday TINYINT UNSIGNED NOT NULL,
  teacher_id INT UNSIGNED NULL,
  group_id INT UNSIGNED NULL,
  PRIMARY KEY (duty_id, weekday),
  CONSTRAINT assignments_duty FOREIGN KEY (duty_id) REFERENCES duties (id) ON DELETE CASCADE,
  CONSTRAINT assignments_teacher FOREIGN KEY (teacher_id) REFERENCES teachers (id),
  CONSTRAINT assignments_group FOREIGN KEY (group_id) REFERENCES duty_groups (id),
  CONSTRAINT assignments_weekday CHECK (weekday BETWEEN 1 AND 5),
  CONSTRAINT assignments_one CHECK ((teacher_id IS NULL) <> (group_id IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- "Swap for today only": on on_date, this duty is done by teacher_id instead.
CREATE TABLE IF NOT EXISTS overrides (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  on_date DATE NOT NULL,
  duty_id INT UNSIGNED NOT NULL,
  teacher_id INT UNSIGNED NOT NULL,
  note VARCHAR(200) NOT NULL DEFAULT '',
  UNIQUE KEY overrides_day_duty (on_date, duty_id),
  CONSTRAINT overrides_duty FOREIGN KEY (duty_id) REFERENCES duties (id) ON DELETE CASCADE,
  CONSTRAINT overrides_teacher FOREIGN KEY (teacher_id) REFERENCES teachers (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Key/value: 'version' (bumped by every write; the TV polls it),
-- 'admin_password_hash' (password_hash(), set with tools/set-password.php).
CREATE TABLE IF NOT EXISTS meta (
  k VARCHAR(40) PRIMARY KEY,
  v VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Wrong admin passwords, per IP address (rate limit).
CREATE TABLE IF NOT EXISTS login_attempts (
  ip VARCHAR(45) PRIMARY KEY,
  fails INT UNSIGNED NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  last_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO meta (k, v) VALUES ('version', '1');
