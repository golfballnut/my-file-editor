-- Add prompt column to prompts table
ALTER TABLE prompts
ADD COLUMN prompt text DEFAULT 'prompt';

-- Add check constraint for valid prompt values
ALTER TABLE prompts
ADD CONSTRAINT valid_prompt_types 
CHECK (prompt IN ('prompt', 'prd', 'instructions', 'example'));

-- Update existing rows to have default prompt type
UPDATE prompts 
SET prompt = 'prompt' 
WHERE prompt IS NULL; 