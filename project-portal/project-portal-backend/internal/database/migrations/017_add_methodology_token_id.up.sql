-- 017_add_methodology_token_id.up.sql
ALTER TABLE projects ADD COLUMN methodology_token_id INTEGER;
ALTER TABLE carbon_credits ADD COLUMN methodology_token_id INTEGER;
