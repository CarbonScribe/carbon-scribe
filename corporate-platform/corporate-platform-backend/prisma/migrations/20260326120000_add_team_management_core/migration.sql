-- Team management core models

CREATE TABLE IF NOT EXISTS "Role" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "permissions" JSONB NOT NULL DEFAULT '[]',
  "memberCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TeamMember" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "firstName" TEXT,
  "lastName" TEXT,
  "roleId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "invitedBy" TEXT,
  "invitedAt" TIMESTAMP(3),
  "lastActiveAt" TIMESTAMP(3),
  "metadata" JSONB,
  "department" TEXT,
  "title" TEXT,

  CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Invitation" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "invitedBy" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Role_companyId_name_key" ON "Role"("companyId", "name");
CREATE INDEX IF NOT EXISTS "Role_companyId_idx" ON "Role"("companyId");

CREATE UNIQUE INDEX IF NOT EXISTS "TeamMember_userId_key" ON "TeamMember"("userId");
CREATE INDEX IF NOT EXISTS "TeamMember_companyId_status_idx" ON "TeamMember"("companyId", "status");
CREATE INDEX IF NOT EXISTS "TeamMember_roleId_idx" ON "TeamMember"("roleId");

CREATE UNIQUE INDEX IF NOT EXISTS "Invitation_token_key" ON "Invitation"("token");
CREATE INDEX IF NOT EXISTS "Invitation_companyId_status_idx" ON "Invitation"("companyId", "status");
CREATE INDEX IF NOT EXISTS "Invitation_email_idx" ON "Invitation"("email");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Role_companyId_fkey'
  ) THEN
    ALTER TABLE "Role"
      ADD CONSTRAINT "Role_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TeamMember_companyId_fkey'
  ) THEN
    ALTER TABLE "TeamMember"
      ADD CONSTRAINT "TeamMember_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TeamMember_userId_fkey'
  ) THEN
    ALTER TABLE "TeamMember"
      ADD CONSTRAINT "TeamMember_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TeamMember_roleId_fkey'
  ) THEN
    ALTER TABLE "TeamMember"
      ADD CONSTRAINT "TeamMember_roleId_fkey"
      FOREIGN KEY ("roleId") REFERENCES "Role"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Invitation_companyId_fkey'
  ) THEN
    ALTER TABLE "Invitation"
      ADD CONSTRAINT "Invitation_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Invitation_roleId_fkey'
  ) THEN
    ALTER TABLE "Invitation"
      ADD CONSTRAINT "Invitation_roleId_fkey"
      FOREIGN KEY ("roleId") REFERENCES "Role"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;
