create table if not exists files (
  id uuid primary key default uuid_generate_v4(),
  path text unique not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add RLS policies
alter table files enable row level security;

create policy "Allow public read access"
  on files for select
  using (true);

create policy "Allow authenticated insert"
  on files for insert
  with check (auth.role() = 'authenticated'); 