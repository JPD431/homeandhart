-- Una sola reseña por reserva (independiente del flujo bien/mal + token 24h).
CREATE UNIQUE INDEX IF NOT EXISTS reviews_booking_id_unique
  ON reviews (booking_id);
