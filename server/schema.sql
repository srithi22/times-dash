CREATE TABLE IF NOT EXISTS scores (
  day     TEXT    NOT NULL,          -- player's local date, YYYY-MM-DD
  pid     TEXT    NOT NULL,          -- public id: first 16 hex of sha256(player's secret key)
  name    TEXT    NOT NULL,          -- nickname the child typed
  emoji   TEXT    NOT NULL,
  best    INTEGER NOT NULL,          -- most correct answers in one 2-minute round that day
  updated INTEGER NOT NULL,          -- ms since epoch
  PRIMARY KEY (day, pid)
);
CREATE INDEX IF NOT EXISTS scores_day ON scores(day);
