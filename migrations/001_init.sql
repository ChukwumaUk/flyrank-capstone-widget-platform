-- 001_init.sql — widgets and submissions tables

create table if not exists widgets (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null,
  type            text not null,
  title           text not null,
  description     text,
  config          jsonb not null default '{}',
  allowed_origins text[],
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists submissions (
  id          bigserial primary key,
  widget_id   uuid not null references widgets(id) on delete cascade,
  data        jsonb not null,
  ip_address  inet,
  country     text,
  city        text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_widgets_owner on widgets(owner_id);
create index if not exists idx_submissions_widget on submissions(widget_id);
create index if not exists idx_submissions_created on submissions(created_at);