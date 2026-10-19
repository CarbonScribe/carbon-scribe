# Manual Testing Guide for Foreign Key Constraints

This guide provides manual testing steps to verify the foreign key constraints are working correctly after applying the migration.

## Prerequisites

1. Apply the SQL migration:
```bash
psql -U <username> -h <host> -d <database> -f migrations/add_foreign_key_constraints.sql
```

2. Set up a test database with sample data (projects, users, etc.)

## Test 1: Verify Constraints Exist

Run this SQL query to verify all 16 FK constraints were created:

```sql
SELECT conname, conrelid::regclass AS table_name, confrelid::regclass AS referenced_table 
FROM pg_constraint 
WHERE conrelid::regclass::text IN (
    'project_members', 'project_invitations', 'activity_logs', 
    'comments', 'tasks', 'task_dependencies', 'shared_resources', 'resource_bookings'
)
AND contype = 'f'
ORDER BY table_name, conname;
```

**Expected result**: 16 constraints across 8 tables

## Test 2: Reject Invalid Project ID

Try to insert a project_member with a non-existent project_id:

```sql
-- This should FAIL with FK constraint violation
INSERT INTO project_members (id, project_id, user_id, role, joined_at, updated_at)
VALUES (
    'test-member-id', 
    '00000000-0000-0000-0000-000000000000',  -- Invalid project ID
    (SELECT id FROM users LIMIT 1), 
    'Viewer', 
    NOW(), 
    NOW()
);
```

**Expected error**: `foreign key constraint violation`

## Test 3: Reject Invalid User ID

Try to insert a project_member with a non-existent user_id:

```sql
-- This should FAIL with FK constraint violation
INSERT INTO project_members (id, project_id, user_id, role, joined_at, updated_at)
VALUES (
    'test-member-id-2', 
    (SELECT id FROM projects LIMIT 1),
    '00000000-0000-0000-0000-000000000000',  -- Invalid user ID
    'Viewer', 
    NOW(), 
    NOW()
);
```

**Expected error**: `foreign key constraint violation`

## Test 4: Allow Valid References

Insert with valid project and user IDs:

```sql
-- Get valid IDs
DO $$
DECLARE
    v_project_id UUID;
    v_user_id UUID;
BEGIN
    SELECT id INTO v_project_id FROM projects LIMIT 1;
    SELECT id INTO v_user_id FROM users LIMIT 1;
    
    -- This should SUCCEED
    INSERT INTO project_members (id, project_id, user_id, role, joined_at, updated_at)
    VALUES (
        'test-member-valid', 
        v_project_id,
        v_user_id,
        'Viewer', 
        NOW(), 
        NOW()
    );
    
    RAISE NOTICE 'Insert succeeded with valid references';
END $$;

-- Clean up
DELETE FROM project_members WHERE id = 'test-member-valid';
```

**Expected result**: Insert succeeds, then cleanup succeeds

## Test 5: CASCADE DELETE

Test that deleting a project cascades to related records:

```sql
-- Create test data
DO $$
DECLARE
    v_project_id UUID := gen_random_uuid();
    v_user_id UUID := gen_random_uuid();
    v_member_id UUID := gen_random_uuid();
BEGIN
    -- Create test user
    INSERT INTO users (id, email, password_hash, full_name, role)
    VALUES (v_user_id, 'test-fk@example.com', 'hash', 'Test User', 'farmer');
    
    -- Create test project
    INSERT INTO projects (id, name, type, location, area)
    VALUES (v_project_id, 'Test Project', 'Reforestation', 'Test Location', 100.0);
    
    -- Create project_member
    INSERT INTO project_members (id, project_id, user_id, role, joined_at, updated_at)
    VALUES (v_member_id, v_project_id, v_user_id, 'Viewer', NOW(), NOW());
    
    RAISE NOTICE 'Test data created';
END $$;

-- Verify project_member exists
SELECT COUNT(*) FROM project_members WHERE project_id IN (
    SELECT id FROM projects WHERE name = 'Test Project'
);

-- Delete the project (should cascade delete project_member)
DELETE FROM projects WHERE name = 'Test Project';

-- Verify project_member was cascade deleted
SELECT COUNT(*) FROM project_members WHERE project_id IN (
    SELECT id FROM projects WHERE name = 'Test Project'
);

-- Clean up
DELETE FROM users WHERE email = 'test-fk@example.com';
```

**Expected result**: 
- First count: 1 (project_member exists)
- Second count: 0 (project_member was cascade deleted)

## Test 6: SET NULL Behavior

Test that deleting a user sets nullable FKs to NULL:

```sql
-- Create test data
DO $$
DECLARE
    v_project_id UUID := gen_random_uuid();
    v_user_id UUID := gen_random_uuid();
    v_task_id UUID := gen_random_uuid();
BEGIN
    -- Create test user
    INSERT INTO users (id, email, password_hash, full_name, role)
    VALUES (v_user_id, 'test-fk2@example.com', 'hash', 'Test User 2', 'farmer');
    
    -- Create test project
    INSERT INTO projects (id, name, type, location, area)
    VALUES (v_project_id, 'Test Project 2', 'Reforestation', 'Test Location', 100.0);
    
    -- Create task with assigned_to
    INSERT INTO tasks (id, project_id, assigned_to, created_by, title, status)
    VALUES (v_task_id, v_project_id, v_user_id, v_user_id, 'Test Task', 'todo');
    
    RAISE NOTICE 'Test data created';
END $$;

-- Verify task has assigned_to
SELECT assigned_to FROM tasks WHERE id IN (
    SELECT id FROM tasks WHERE title = 'Test Task'
);

-- Delete the user (should set task.assigned_to to NULL)
DELETE FROM users WHERE email = 'test-fk2@example.com';

-- Verify task.assigned_to is now NULL
SELECT assigned_to FROM tasks WHERE id IN (
    SELECT id FROM tasks WHERE title = 'Test Task'
);

-- Clean up
DELETE FROM tasks WHERE title = 'Test Task';
DELETE FROM projects WHERE name = 'Test Project 2';
```

**Expected result**:
- First select: Returns user UUID
- Second select: Returns NULL

## Test 7: Orphan Prevention

Verify no orphaned records can exist after migration:

```sql
-- Check for orphaned project_members
SELECT COUNT(*) FROM project_members pm 
LEFT JOIN projects p ON pm.project_id = p.id 
WHERE p.id IS NULL;

SELECT COUNT(*) FROM project_members pm 
LEFT JOIN users u ON pm.user_id = u.id 
WHERE u.id IS NULL;

-- All should return 0
```

**Expected result**: All counts return 0

## Cleanup Test Data

After testing, clean up any remaining test data:

```sql
DELETE FROM project_members WHERE id LIKE 'test-%';
DELETE FROM project_invitations WHERE email LIKE 'test-%';
DELETE FROM activity_logs WHERE action LIKE 'test-%';
DELETE FROM comments WHERE content LIKE 'Test%';
DELETE FROM tasks WHERE title LIKE 'Test%';
DELETE FROM task_dependencies WHERE type = 'test';
DELETE FROM shared_resources WHERE name LIKE 'Test%';
DELETE FROM resource_bookings WHERE status = 'test';
DELETE FROM users WHERE email LIKE 'test-%';
DELETE FROM projects WHERE name LIKE 'Test%';
```

## Summary

All tests should pass to confirm:
- ✅ FK constraints are properly created
- ✅ Invalid parent IDs are rejected
- ✅ Valid references are accepted
- ✅ CASCADE delete works correctly
- ✅ SET NULL works correctly
- ✅ No orphaned records can exist
