# Model Changes for Foreign Key Constraints

## Overview
This document describes the changes needed in `internal/collaboration/models.go` to enable GORM to create foreign key constraints via AutoMigrate.

## Important Note
Due to circular import concerns (collaboration models cannot import project/auth models directly), we are using GORM tag syntax instead of struct field associations. This approach:
- Avoids circular import dependencies
- Allows GORM to generate proper FK constraints
- Maintains the existing string-based ID references

## Required Changes

### 1. ProjectMember
**Current:**
```go
type ProjectMember struct {
    ID          string         `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
    ProjectID   string         `gorm:"index;not null" json:"project_id"`
    UserID      string         `gorm:"index;not null" json:"user_id"`
    // ... other fields
}
```

**After:**
```go
type ProjectMember struct {
    ID          string         `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
    ProjectID   string         `gorm:"index;not null;constraint:OnDelete:CASCADE,OnUpdate:CASCADE" json:"project_id"`
    UserID      string         `gorm:"index;not null;constraint:OnDelete:CASCADE,OnUpdate:CASCADE" json:"user_id"`
    // ... other fields
}
```

### 2. ProjectInvitation
**Current:**
```go
type ProjectInvitation struct {
    ID         string         `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
    ProjectID  string         `gorm:"index;not null" json:"project_id"`
    // ... other fields
}
```

**After:**
```go
type ProjectInvitation struct {
    ID         string         `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
    ProjectID  string         `gorm:"index;not null;constraint:OnDelete:CASCADE,OnUpdate:CASCADE" json:"project_id"`
    // ... other fields
}
```

### 3. ActivityLog
**Current:**
```go
type ActivityLog struct {
    ID        string         `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
    ProjectID string         `gorm:"index;not null" json:"project_id"`
    UserID    string         `gorm:"index" json:"user_id,omitempty"` // Nullable for system events
    // ... other fields
}
```

**After:**
```go
type ActivityLog struct {
    ID        string         `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
    ProjectID string         `gorm:"index;not null;constraint:OnDelete:CASCADE,OnUpdate:CASCADE" json:"project_id"`
    UserID    string         `gorm:"index;constraint:OnDelete:SET NULL,OnUpdate:CASCADE" json:"user_id,omitempty"` // Nullable for system events
    // ... other fields
}
```

### 4. Comment
**Current:**
```go
type Comment struct {
    ID          string         `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
    ProjectID   string         `gorm:"index;not null" json:"project_id"`
    UserID      string         `gorm:"index;not null" json:"user_id"`
    // ... other fields
}
```

**After:**
```go
type Comment struct {
    ID          string         `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
    ProjectID   string         `gorm:"index;not null;constraint:OnDelete:CASCADE,OnUpdate:CASCADE" json:"project_id"`
    UserID      string         `gorm:"index;not null;constraint:OnDelete:CASCADE,OnUpdate:CASCADE" json:"user_id"`
    // ... other fields
}
```

### 5. Task
**Current:**
```go
type Task struct {
    ID          string         `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
    ProjectID   string         `gorm:"index;not null" json:"project_id"`
    AssignedTo  *string        `gorm:"index" json:"assigned_to,omitempty"`
    CreatedBy   string         `gorm:"not null" json:"created_by"`
    // ... other fields
}
```

**After:**
```go
type Task struct {
    ID          string         `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
    ProjectID   string         `gorm:"index;not null;constraint:OnDelete:CASCADE,OnUpdate:CASCADE" json:"project_id"`
    AssignedTo  *string        `gorm:"index;constraint:OnDelete:SET NULL,OnUpdate:CASCADE" json:"assigned_to,omitempty"`
    CreatedBy   string         `gorm:"not null;constraint:OnDelete:CASCADE,OnUpdate:CASCADE" json:"created_by"`
    // ... other fields
}
```

### 6. TaskDependency
**Current:**
```go
type TaskDependency struct {
    ID              string `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
    TaskID          string `gorm:"index;not null" json:"task_id"`
    DependsOnTaskID string `gorm:"index;not null" json:"depends_on_task_id"`
    Type            string `gorm:"default:'blocking'" json:"type"`
}
```

**After:**
```go
type TaskDependency struct {
    ID              string `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
    TaskID          string `gorm:"index;not null;constraint:OnDelete:CASCADE,OnUpdate:CASCADE" json:"task_id"`
    DependsOnTaskID string `gorm:"index;not null;constraint:OnDelete:CASCADE,OnUpdate:CASCADE" json:"depends_on_task_id"`
    Type            string `gorm:"default:'blocking'" json:"type"`
}
```

### 7. SharedResource
**Current:**
```go
type SharedResource struct {
    ID         string         `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
    ProjectID  string         `gorm:"index;not null" json:"project_id"`
    // ... other fields
    UploadedBy string         `json:"uploaded_by"`
    // ... other fields
}
```

**After:**
```go
type SharedResource struct {
    ID         string         `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
    ProjectID  string         `gorm:"index;not null;constraint:OnDelete:CASCADE,OnUpdate:CASCADE" json:"project_id"`
    // ... other fields
    UploadedBy string         `gorm:"constraint:OnDelete:SET NULL,OnUpdate:CASCADE" json:"uploaded_by"`
    // ... other fields
}
```

### 8. ResourceBooking
**Current:**
```go
type ResourceBooking struct {
    ID         string    `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
    ResourceID string    `gorm:"index;not null" json:"resource_id"`
    BookedBy   string    `gorm:"index;not null" json:"booked_by"`
    // ... other fields
}
```

**After:**
```go
type ResourceBooking struct {
    ID         string    `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
    ResourceID string    `gorm:"index;not null;constraint:OnDelete:CASCADE,OnUpdate:CASCADE" json:"resource_id"`
    BookedBy   string    `gorm:"index;not null;constraint:OnDelete:CASCADE,OnUpdate:CASCADE" json:"booked_by"`
    // ... other fields
}
```

## GORM Tag Explanation

- `constraint:OnDelete:CASCADE` - When parent is deleted, automatically delete child records
- `constraint:OnDelete:SET NULL` - When parent is deleted, set child's FK to NULL (only for nullable fields)
- `constraint:OnUpdate:CASCADE` - When parent's ID is updated, update child's FK to match
- The table references are implicit based on the migration script; GORM will use the constraint tags to generate appropriate FKs in future AutoMigrate runs

## Why This Approach?

### Alternative: Struct Field Associations
Could use struct fields like:
```go
Project *project.Project `gorm:"foreignKey:ProjectID"`
User    *auth.User       `gorm:"foreignKey:UserID"`
```

**Problems:**
- Creates circular import: collaboration → project, collaboration → auth
- project may already import collaboration (if at all)
- auth definitely doesn't import collaboration
- Would require significant refactoring of import graph

### Chosen Approach: Constraint Tags
Using GORM constraint tags:
- No struct field associations needed
- No import changes required
- Migration script handles actual FK creation
- GORM tags ensure future AutoMigrate runs maintain constraints
- Clean separation of concerns

## Migration Order

1. **Phase 1**: Apply SQL migration (`add_foreign_key_constraints.sql`)
   - Creates FK constraints on existing tables
   - Ensures referential integrity immediately

2. **Phase 2**: Update Go models
   - Add constraint tags to m
