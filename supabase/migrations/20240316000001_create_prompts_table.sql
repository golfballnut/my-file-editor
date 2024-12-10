create table if not exists prompts (
  id uuid primary key default gen_random_uuid(),
  filename text unique not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add RLS policies
alter table prompts enable row level security;

create policy "Allow public read access"
  on prompts for select
  using (true);

create policy "Allow authenticated insert"
  on prompts for insert
  with check (auth.role() = 'authenticated'); 