-- Ejecutar en Supabase SQL Editor
-- Suscripciones de notificaciones push (formato estándar PushSubscription.toJSON()).

create table if not exists push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  endpoint   text unique not null,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  activo     boolean not null default true,
  created_at timestamptz default now()
);
