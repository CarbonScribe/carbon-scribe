# Retirement Scheduling API

Base path: `GET|POST|PATCH|DELETE /api/v1/...`  
All endpoints require JWT authentication (`Authorization: Bearer <token>`).

---

## Retirement Schedules

### Create retirement schedule
**POST** `/api/v1/retirement-schedules`

**Body (JSON):**
- `name` (string, required) – e.g. "Monthly Scope 1 Offset"
- `description` (string, optional)
- `purpose` (string, required) – one of: `scope1`, `scope2`, `scope3`, `corporate`, `events`, `product`
- `amount` (integer, required, min 1) – credits to retire per execution
- `creditSelection` (string, required) – one of: `automatic`, `specific`, `portfolio-only`
- `creditIds` (string[], optional) – required when `creditSelection` is `specific`
- `frequency` (string, required) – one of: `monthly`, `quarterly`, `annual`, `one-time`
- `interval` (integer, optional, min 1) – multiplier for frequency (e.g. every 2 months)
- `startDate` (string, required) – ISO 8601 date
- `endDate` (string, optional) – ISO 8601 date
- `notifyBefore` (integer, optional, min 0) – days before execution to send reminder
- `notifyAfter` (boolean, optional, default true) – send notification after execution

**Response:** Created `RetirementSchedule` object.

---

### List schedules
**GET** `/api/v1/retirement-schedules`

**Response:** Array of retirement schedules for the current company, ordered by `nextRunDate`.

---

### Get schedule
**GET** `/api/v1/retirement-schedules/:id`

**Response:** Single schedule with recent executions (last 10).  
**404** if not found or not owned by company.

---

### Update schedule
**PATCH** `/api/v1/retirement-schedules/:id`

**Body (JSON):** Same fields as create; all optional. Only provided fields are updated.  
Updating `frequency`, `interval`, `startDate`, or `endDate` recalculates `nextRunDate`.

**Response:** Updated `RetirementSchedule` object.

---

### Delete schedule
**DELETE** `/api/v1/retirement-schedules/:id`

**Response:** `{ "deleted": true }`  
**404** if not found or not owned by company.

---

### Pause schedule
**POST** `/api/v1/retirement-schedules/:id/pause`

**Response:** Updated schedule with `isActive: false`.

---

### Resume schedule
**POST** `/api/v1/retirement-schedules/:id/resume`

**Response:** Updated schedule with `isActive: true`. If `nextRunDate` is in the past, it is set to now.

---

### Execute now (manual run)
**POST** `/api/v1/retirement-schedules/:id/execute-now`

Runs the schedule immediately regardless of `nextRunDate`.

**Response:** Execution result (e.g. `amountRetired`, `retirementIds`, `status`).

---

### List executions
**GET** `/api/v1/retirement-schedules/:id/executions`

**Response:** Array of `ScheduleExecution` records for this schedule, newest first.

---

## Batch Retirements

### Create batch retirement
**POST** `/api/v1/retirement-batches`

**Body (JSON):**
- `name` (string, required)
- `description` (string, optional)
- `items` (array, required) – each item: `{ "creditId": string, "amount": number, "purpose": string, "purposeDetails"?: string }`  
  `purpose` must be one of: `scope1`, `scope2`, `scope3`, `corporate`, `events`, `product`

**Response:** Created `BatchRetirement` object. The batch is processed immediately; check `status`, `completedItems`, `failedItems`, `retirementIds`, `errorLog`.

---

### Create batch from CSV
**POST** `/api/v1/retirement-batches/csv`  
**Content-Type:** `multipart/form-data`

**Form fields:**
- `file` (required) – CSV file with header row containing: `creditId`, `amount`, `purpose`. Optional: `purposeDetails`
- `name` (string, required)
- `description` (string, optional)

**CSV example:**
```csv
creditId,amount,purpose,purposeDetails
clxyz123,10,scope1,Monthly offset
clxyz456,20,scope2,
```

**Response:** Same as create batch.  
**400** if file is missing or CSV is invalid.

---

### List batch jobs
**GET** `/api/v1/retirement-batches`

**Response:** Array of batch jobs for the current company, newest first.

---

### Get batch
**GET** `/api/v1/retirement-batches/:id`

**Response:** Single batch with `items`, `status`, `totalItems`, `completedItems`, `failedItems`, `retirementIds`, `errorLog`.  
**404** if not found or not owned by company.
