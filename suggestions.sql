CREATE TABLE IF NOT EXISTS suggestions (
  id INTEGER PRIMARY KEY,
  created_at TEXT NOT NULL,
  original TEXT NOT NULL,
  submission_key TEXT UNIQUE,
  approved INTEGER NOT NULL DEFAULT 0 CHECK (approved IN (0, 1)),
  public_question TEXT NOT NULL DEFAULT '',
  response TEXT NOT NULL DEFAULT '',
  reviewed_at TEXT,
  CHECK (approved = 0 OR (
    length(trim(public_question)) > 0 AND length(trim(response)) > 0 AND reviewed_at IS NOT NULL
  ))
);
CREATE INDEX IF NOT EXISTS suggestions_created ON suggestions (created_at);
CREATE INDEX IF NOT EXISTS suggestions_public ON suggestions (approved, id);
CREATE TABLE IF NOT EXISTS suggestion_moderator (
  id INTEGER PRIMARY KEY CHECK (id=1),
  access_key TEXT NOT NULL
);
INSERT OR IGNORE INTO suggestion_moderator (id, access_key) VALUES (1, lower(hex(randomblob(32))));
