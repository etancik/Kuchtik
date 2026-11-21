CREATE TABLE IF NOT EXISTS recipes (
  filename TEXT NOT NULL PRIMARY KEY,
  revision TEXT NOT NULL CHECK (length(revision) = 40 AND revision NOT GLOB '*[^0-9a-f]*'),
  data TEXT NOT NULL CHECK (json_valid(data) AND json_type(data) = 'object')
);
