-- ALTER TABLE services ADD COLUMN IF NOT EXISTS amenities jsonb DEFAULT '[]';

ALTER TABLE services ADD COLUMN IF NOT EXISTS amenities jsonb DEFAULT '[]';
