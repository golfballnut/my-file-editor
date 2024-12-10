-- Allow public access during development
create policy "Allow public access to prompts"
  on prompts for all
  using (true)
  with check (true); 