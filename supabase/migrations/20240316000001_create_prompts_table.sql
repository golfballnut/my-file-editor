create table if not exists prompts (
  id uuid primary key default gen_random_uuid(),
  filename text unique not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table prompts enable row level security;

-- Add RLS policies for development
create policy "Allow all operations on prompts"
  on prompts for all
  using (true)
  with check (true); 