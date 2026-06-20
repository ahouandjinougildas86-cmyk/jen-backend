-- Événements
CREATE TABLE IF NOT EXISTS events (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(255) NOT NULL,
  lieu        VARCHAR(255),
  event_date  DATE,
  event_heure VARCHAR(50),
  price       INTEGER NOT NULL,  -- en FCFA
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Commandes (avant paiement)
CREATE TABLE IF NOT EXISTS orders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     INTEGER REFERENCES events(id),
  fname        VARCHAR(100) NOT NULL,
  lname        VARCHAR(100) NOT NULL,
  email        VARCHAR(255) NOT NULL,
  phone        VARCHAR(30)  NOT NULL,
  pm           VARCHAR(10)  NOT NULL,  -- mtn | moov | cel
  amount       INTEGER      NOT NULL,
  status       VARCHAR(20)  DEFAULT 'pending', -- pending | paid | failed
  created_at   TIMESTAMP    DEFAULT NOW()
);

-- Tickets (générés après paiement confirmé)
CREATE TABLE IF NOT EXISTS tickets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID REFERENCES orders(id),
  code         VARCHAR(20) UNIQUE NOT NULL,  -- JEN-XXXXXX
  seat         VARCHAR(5)  NOT NULL,         -- A01, B12...
  qr_data      TEXT        NOT NULL,
  is_used      BOOLEAN     DEFAULT FALSE,
  used_at      TIMESTAMP,
  created_at   TIMESTAMP   DEFAULT NOW()
);

-- Transactions de paiement
CREATE TABLE IF NOT EXISTS transactions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       UUID REFERENCES orders(id),
  provider       VARCHAR(20) NOT NULL,  -- mtn | moov | cel
  provider_ref   VARCHAR(255),          -- référence retournée par l'API
  status         VARCHAR(20) DEFAULT 'pending',
  raw_response   JSONB,                 -- réponse brute du provider
  created_at     TIMESTAMP DEFAULT NOW(),
  updated_at     TIMESTAMP DEFAULT NOW()
);