-- CreateEnum
CREATE TYPE "TestGenSessionStatus" AS ENUM ('ANALYZING', 'PROPOSING', 'AWAITING_APPROVAL', 'GENERATING', 'REVIEW', 'COMMITTING', 'COMMITTED', 'FAILED');

-- AlterEnum
ALTER TYPE "GenerationType" ADD VALUE 'PROJECT_ANALYSIS';
ALTER TYPE "GenerationType" ADD VALUE 'TEST_PROPOSAL';

-- CreateTable
CREATE TABLE "project_profiles" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "test_framework" TEXT NOT NULL,
    "package_manager" TEXT,
    "structure" JSONB NOT NULL,
    "test_patterns" JSONB,
    "dependencies" JSONB,
    "analyzed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_gen_sessions" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "status" "TestGenSessionStatus" NOT NULL,
    "profile_id" TEXT,
    "proposal" JSONB,
    "approved_items" JSONB,
    "generated_tests" JSONB,
    "branch_name" TEXT,
    "commit_sha" TEXT,
    "commit_url" TEXT,
    "pull_request_url" TEXT,
    "total_tokens_used" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_gen_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_profiles_project_id_key" ON "project_profiles"("project_id");

-- CreateIndex
CREATE INDEX "project_profiles_project_id_idx" ON "project_profiles"("project_id");

-- CreateIndex
CREATE INDEX "test_gen_sessions_project_id_idx" ON "test_gen_sessions"("project_id");

-- CreateIndex
CREATE INDEX "test_gen_sessions_status_idx" ON "test_gen_sessions"("status");
