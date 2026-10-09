-- Cursor separado del inbox: los IDs de pruebas no alteran el offset real.
CREATE TABLE telegram_poll_state (
    singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
    next_offset bigint NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO telegram_poll_state(singleton) VALUES(true);
