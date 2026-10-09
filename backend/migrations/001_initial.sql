-- Datos científicos públicos; conversaciones privadas por propietario.
CREATE TABLE IF NOT EXISTS dataset_versions (sha256 text PRIMARY KEY, imported_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS countries (name text PRIMARY KEY, coffee_type text NOT NULL);
CREATE TABLE IF NOT EXISTS consumption (
 country text REFERENCES countries(name), year int NOT NULL, period text NOT NULL,
 consumption double precision NOT NULL CHECK(consumption>=0), PRIMARY KEY(country,year));
CREATE TABLE IF NOT EXISTS projections (
 country text REFERENCES countries(name), horizon int CHECK(horizon BETWEEN 1 AND 10),
 period text NOT NULL, predicted_consumption double precision NOT NULL CHECK(predicted_consumption>=0),
 payload jsonb NOT NULL, PRIMARY KEY(country,horizon));
CREATE TABLE IF NOT EXISTS model_metrics (
 country text REFERENCES countries(name), model_name text NOT NULL, stage text NOT NULL,
 horizon int NOT NULL, payload jsonb NOT NULL, PRIMARY KEY(country,model_name,stage,horizon));
CREATE TABLE IF NOT EXISTS conversations (
 id uuid PRIMARY KEY, owner text NOT NULL, role text CHECK(role IN ('internal','external')) NOT NULL,
 channel text NOT NULL, title text NOT NULL DEFAULT 'Nueva conversación', created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS conversations_owner ON conversations(owner,created_at DESC);
CREATE TABLE IF NOT EXISTS messages (
 id bigserial PRIMARY KEY, conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
 kind text CHECK(kind IN ('user','assistant')) NOT NULL, content text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS messages_conversation ON messages(conversation_id,id);
CREATE TABLE IF NOT EXISTS tool_events (
 id bigserial PRIMARY KEY, conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
 message_id bigint REFERENCES messages(id), event_type text NOT NULL, payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS telegram_updates (
 update_id bigint PRIMARY KEY, payload jsonb NOT NULL, status text NOT NULL DEFAULT 'queued',
 attempts int NOT NULL DEFAULT 0, response text, updated_at timestamptz NOT NULL DEFAULT now());
