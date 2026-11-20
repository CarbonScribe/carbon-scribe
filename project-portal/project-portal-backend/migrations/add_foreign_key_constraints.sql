-- Migration: Add Foreign Key Constraints to Collaboration Tables
-- Purpose: Enable referential integrity by adding FK constraints to prevent orphaned records
-- Date: 2026-10-19
-- Issue: #694

-- IMPORTANT: Run this migration after ensuring no orphaned records exist
-- See MIGRATION_PLAN.md for steps to clean orphaned data before running this

BEGIN;

-- Enable foreign key constraint checks
SET session_replication_role = 'replica';

-- Add FK constraint to project_members table
ALTER TABLE project_members 
ADD CONSTRAINT fk_project_members_project_id 
FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE project_members 
ADD CONSTRAINT fk_project_members_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- Add FK constraint to project_invitations table
ALTER TABLE project_invitations 
ADD CONSTRAINT fk_project_invitations_project_id 
FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- Add FK constraint to activity_logs table
ALTER TABLE activity_logs 
ADD CONSTRAINT fk_activity_logs_project_id 
FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE activity_logs 
ADD CONSTRAINT fk_activity_logs_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- Add FK constraint to comments table
ALTER TABLE comments 
ADD CONSTRAINT fk_comments_project_id 
FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE comments 
ADD CONSTRAINT fk_comments_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- Add FK constraint to tasks table
ALTER TABLE tasks 
ADD CONSTRAINT fk_tasks_project_id 
FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE tasks 
ADD CONSTRAINT fk_tasks_assigned_to 
FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE tasks 
ADD CONSTRAINT fk_tasks_created_by 
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- Add FK constraint to task_dependencies table
ALTER TABLE task_dependencies 
ADD CONSTRAINT fk_task_dependencies_task_id 
FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE task_dependencies 
ADD CONSTRAINT fk_task_dependencies_depends_on_task_id 
FOREIGN KEY (depends_on_task_id) REFERENCES tasks(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- Add FK constraint to shared_resources table
ALTER TABLE shared_resources 
ADD CONSTRAINT fk_shared_resources_project_id 
FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE shared_resources 
ADD CONSTRAINT fk_shared_resources_uploaded_by 
FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- Add FK constraint to resource_bookings table
ALTER TABLE resource_bookings 
ADD CONSTRAINT fk_resource_bookings_resource_id 
FOREIGN KEY (resource_id) REFERENCES shared_resources(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE resource_bookings 
ADD CONSTRAINT fk_resource_bookings_booked_by 
FOREIGN KEY (booked_by) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- Reset session replication role
SET session_replication_role = 'origin';

COMMIT;

-- Verification queries to check constraints were added
-- SELECT conname, conrelid::regclass AS table_name, confrelid::regclass AS referenced_table 
-- FROM pg_constraint 
-- WHERE conrelid::regclass::text IN ('project_members', 'project_invitations', 'activity_logs', 'comments', 'tasks', 'task_dependencies', 'shared_resources', 'resource_bookings')
-- AND contype = 'f';
