# Foreign Key Constraint Migration

This directory contains the migration files for adding foreign key constraints to the collaboration module tables, as specified in issue #694.

## Files

- **add_foreign_key_constraints.sql** - SQL migration script to add FK constraints to existing tables
- **MIGRATION_PLAN.md** - Detailed migration plan including pre-migration checks, cleanup steps, and rollback procedures
- **MODEL_CHANGES.md** - Documentation of required changes to Go model structs in `internal/collaboration/models.go`
- **fk_constraint_test.go** - Test file to verify FK constraint enforcement after migration
- **README.md** - This file

## Quick Start

### 1. Backup Database
```bash
pg_dump -U <username> -h <host> -d <database> > backup_before_fk_migration.sql
```

### 2. Check for Orphaned Records
See `MIGRATION_PLAN.md` for detailed queries to identify orphaned records before migration.

### 3. Apply Migration
```bash
psql -U <username> -h <host> -d <database> -f migrations/add_foreign_key_constraints.sql
```

### 4. Verify Constraints
```sql
SELECT conname, conrelid::regclass AS table_name, confrelid::regclass AS referenced_table 
FROM pg_constraint 
WHERE conrelid::regclass::text IN ('project_members', 'project_invitations', 'activity_logs', 'comments', 'tasks', 'task_dependencies', 'shared_resources', 'resource_bookings')
AND contype = 'f';
```

### 5. Update Go Models
After successful SQL migration, update the model structs as documented in `MODEL_CHANGES.md`.

### 6. Run Tests
```bash
# Set test database URL
export TEST_DATABASE_URL="postgres://user:pass@host:port/dbname"

# Run FK constraint tests
go test migrations/fk_constraint_test.go -v
```

## Tables Affected

The following collaboration tables will have FK constraints added:

1. **project_members** - Links to `projects` and `users`
2. **project_invitations** - Links to `projects`
3. **activity_logs** - Links to `projects` and `users`
4. **comments** - Links to `projects` and `users`
5. **tasks** - Links to `projects` and `users`
6. **task_dependencies** - Links to `tasks` (self-referencing)
7. **shared_resources** - Links to `projects` and `users`
8. **resource_bookings** - Links to `shared_resources` and `users`

Total: 14 foreign key constraints

## Constraint Types

- **CASCADE**: When parent is deleted, child records are automatically deleted
  - Used for: project_members, project_invitations, activity_logs (project_id), comments, tasks (project_id, created_by), task_dependencies, shared_resources (project_id), resource_bookings

- **SET NULL**: When parent is deleted, child's FK is set to NULL
  - Used for: activity_logs (user_id), tasks (assigned_to), shared_resources (uploaded_by)
  - Only applied to nullable foreign key fields

## Important Notes

1. **Circular Import Avoidance**: The migration uses SQL rather than GORM struct associations to avoid circular import issues between collaboration, project, and auth modules.

2. **Downtime**: This migration should be run during a maintenance window as it may briefly lock tables.

3. **Data Integrity**: The migration will fail if orphaned records exist. Always run the orphan detection queries first.

4. **Rollback**: See `MIGRATION_PLAN.md` for rollback procedures if issues arise.

5. **Testing**: Always test the migration in a staging environment before applying to production.

## Additional Resources

- Issue: #694
- PostgreSQL Foreign Key Documentation: https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK
- GORM Foreign Key Documentation: https://gorm.io/docs/constraints.html
