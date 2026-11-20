# Migration Plan: Adding Foreign Key Constraints

## Overview
This migration adds foreign key constraints to collaboration tables to enforce referential integrity and prevent orphaned records.

## Issue
#694 - Enable foreign key constraints in GORM auto-migrate

## Problem
Currently, GORM's `AutoMigrate` does not create FK constraints for collaboration models because:
1. Models use plain indexed string fields (e.g., `ProjectID`, `UserID`) without GORM association tags
2. This allows orphaned records to be created when parent records are deleted
3. No database-level enforcement of referential integrity

## Solution
1. Add SQL migration to create FK constraints on existing tables
2. Update Go model structs to include GORM foreign key tags
3. Clean up any existing orphaned records before applying constraints
4. Add tests to verify FK constraint enforcement

## Pre-Migration Steps

### 1. Backup Database
```bash
pg_dump -U <username> -h <host> -d <database> > backup_before_fk_migration.sql
```

### 2. Identify Orphaned Records
Run these queries to check for orphaned records:

```sql
-- Orphaned project_members
SELECT COUNT(*) FROM project_members pm 
LEFT JOIN projects p ON pm.project_id = p.id 
WHERE p.id IS NULL;

SELECT COUNT(*) FROM project_members pm 
LEFT JOIN users u ON pm.user_id = u.id 
WHERE u.id IS NULL;

-- Orphaned project_invitations
SELECT COUNT(*) FROM project_invitations pi 
LEFT JOIN projects p ON pi.project_id = p.id 
WHERE p.id IS NULL;

-- Orphaned activity_logs
SELECT COUNT(*) FROM activity_logs al 
LEFT JOIN projects p ON al.project_id = p.id 
WHERE p.id IS NULL;

SELECT COUNT(*) FROM activity_logs al 
LEFT JOIN users u ON al.user_id = u.id 
WHERE al.user_id IS NOT NULL AND u.id IS NULL;

-- Orphaned comments
SELECT COUNT(*) FROM comments c 
LEFT JOIN projects p ON c.project_id = p.id 
WHERE p.id IS NULL;

SELECT COUNT(*) FROM comments c 
LEFT JOIN users u ON c.user_id = u.id 
WHERE u.id IS NULL;

-- Orphaned tasks
SELECT COUNT(*) FROM tasks t 
LEFT JOIN projects p ON t.project_id = p.id 
WHERE p.id IS NULL;

SELECT COUNT(*) FROM tasks t 
LEFT JOIN users u ON t.created_by = u.id 
WHERE u.id IS NULL;

SELECT COUNT(*) FROM tasks t 
LEFT JOIN users u ON t.assigned_to = u.id 
WHERE t.assigned_to IS NOT NULL AND u.id IS NULL;

-- Orphaned task_dependencies
SELECT COUNT(*) FROM task_dependencies td 
LEFT JOIN tasks t ON td.task_id = t.id 
WHERE t.id IS NULL;

SELECT COUNT(*) FROM task_dependencies td 
LEFT JOIN tasks t ON td.depends_on_task_id = t.id 
WHERE t.id IS NULL;

-- Orphaned shared_resources
SELECT COUNT(*) FROM shared_resources sr 
LEFT JOIN projects p ON sr.project_id = p.id 
WHERE p.id IS NULL;

SELECT COUNT(*) FROM shared_resources sr 
LEFT JOIN users u ON sr.uploaded_by = u.id 
WHERE sr.uploaded_by IS NOT NULL AND u.id IS NULL;

-- Orphaned resource_bookings
SELECT COUNT(*) FROM resource_bookings rb 
LEFT JOIN shared_resources sr ON rb.resource_id = sr.id 
WHERE sr.id IS NULL;

SELECT COUNT(*) FROM resource_bookings rb 
LEFT JOIN users u ON rb.booked_by = u.id 
WHERE u.id IS NULL;
```

### 3. Clean Orphaned Records

If orphaned records are found, run these cleanup queries:

```sql
-- Clean orphaned project_members
DELETE FROM project_members 
WHERE project_id NOT IN (SELECT id FROM projects);

DELETE FROM project_members 
WHERE user_id NOT IN (SELECT id FROM users);

-- Clean orphaned project_invitations
DELETE FROM project_invitations 
WHERE project_id NOT IN (SELECT id FROM projects);

-- Clean orphaned activity_logs
DELETE FROM activity_logs 
WHERE project_id NOT IN (SELECT id FROM projects);

UPDATE activity_logs 
SET user_id = NULL 
WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users);

-- Clean orphaned comments
DELETE FROM comments 
WHERE project_id NOT IN (SELECT id FROM projects);

DELETE FROM comments 
WHERE user_id NOT IN (SELECT id FROM users);

-- Clean orphaned tasks
DELETE FROM tasks 
WHERE project_id NOT IN (SELECT id FROM projects);

DELETE FROM tasks 
WHERE created_by NOT IN (SELECT id FROM users);

UPDATE tasks 
SET assigned_to = NULL 
WHERE assigned_to IS NOT NULL AND assigned_to NOT IN (SELECT id FROM users);

-- Clean orphaned task_dependencies
DELETE FROM task_dependencies 
WHERE task_id NOT IN (SELECT id FROM tasks);

DELETE FROM task_dependencies 
WHERE depends_on_task_id NOT IN (SELECT id FROM tasks);

-- Clean orphaned shared_resources
DELETE FROM shared_resources 
WHERE project_id NOT IN (SELECT id FROM projects);

UPDATE shared_resources 
SET uploaded_by = NULL 
WHERE uploaded_by IS NOT NULL AND uploaded_by NOT IN (SELECT id FROM users);

-- Clean orphaned resource_bookings
DELETE FROM resource_bookings 
WHERE resource_id NOT IN (SELECT id FROM shared_resources);

DELETE FROM resource_bookings 
WHERE booked_by NOT IN (SELECT id FROM users);
```

## Migration Execution

### 1. Apply SQL Migration
```bash
psql -U <username> -h <host> -d <database> -f migrations/add_foreign_key_constraints.sql
```

### 2. Verify Constraints
```sql
SELECT conname, conrelid::regclass AS table_name, confrelid::regclass AS referenced_table 
FROM pg_constraint 
WHERE conrelid::regclass::text IN ('project_members', 'project_invitations', 'activity_logs', 'comments', 'tasks', 'task_dependencies', 'shared_resources', 'resource_bookings')
AND contype = 'f';
```

Expected output should show 14 foreign key constraints.

### 3. Update Go Models
After successful SQL migration, update the Go model structs in `internal/collaboration/models.go` to include GORM foreign key tags. See MODEL_CHANGES.md for details.

### 4. Test Constraint Enforcement
Run the test suite to verify constraints are working:
```bash
go test ./internal/collaboration/... -v
```

## Rollback Plan

If issues arise, rollback by dropping the constraints:

```sql
ALTER TABLE project_members DROP CONSTRAINT IF EXISTS fk_project_members_project_id;
ALTER TABLE project_members DROP CONSTRAINT IF EXISTS fk_project_members_user_id;
ALTER TABLE project_invitations DROP CONSTRAINT IF EXISTS fk_project_invitations_project_id;
ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS fk_activity_logs_project_id;
ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS fk_activity_logs_user_id;
ALTER TABLE comments DROP CONSTRAINT IF EXISTS fk_comments_project_id;
ALTER TABLE comments DROP CONSTRAINT IF EXISTS fk_comments_user_id;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS fk_tasks_project_id;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS fk_tasks_assigned_to;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS fk_tasks_created_by;
ALTER TABLE task_dependencies DROP CONSTRAINT IF EXISTS fk_task_dependencies_task_id;
ALTER TABLE task_dependencies DROP CONSTRAINT IF EXISTS fk_task_dependencies_depends_on_task_id;
ALTER TABLE shared_resources DROP CONSTRAINT IF EXISTS fk_shared_resources_project_id;
ALTER TABLE shared_resources DROP CONSTRAINT IF EXISTS fk_shared_resources_uploaded_by;
ALTER TABLE resource_bookings DROP CONSTRAINT IF EXISTS fk_resource_bookings_resource_id;
ALTER TABLE resource_bookings DROP CONSTRAINT IF EXISTS fk_resource_bookings_booked_by;
```

## Post-Migration Verification

1. Verify no orphaned records can be created:
   - Try inserting a project_member with non-existent project_id
   - Should fail with FK constraint violation

2. Verify cascade delete works:
   - Delete a project
   - Verify related project_members, comments, tasks are automatically deleted

3. Verify cascade delete with SET NULL works:
   - Delete a user
   - Verify tasks.assigned_to is set to NULL

## Notes

- The migration uses `SET session_replication_role = 'replica'` to bypass FK checks during constraint creation
- CASCADE delete ensures child records are removed when parent is deleted
- SET NULL ensures nullable foreign keys don't block parent deletion
- This migration should be run during a maintenance window as it may lock tables briefly
