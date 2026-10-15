-- CreateEnum
CREATE TYPE "FamilyRole" AS ENUM ('owner', 'parent');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('android', 'ios');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('active', 'unlinked');

-- CreateEnum
CREATE TYPE "PairingMethod" AS ENUM ('code', 'phone');

-- CreateEnum
CREATE TYPE "PairingRequestStatus" AS ENUM ('pending', 'approved', 'rejected', 'expired');

-- CreateEnum
CREATE TYPE "CommandType" AS ENUM ('SYNC_NOW', 'REPORT_APPS', 'REFRESH_PERMISSIONS');

-- CreateEnum
CREATE TYPE "CommandStatus" AS ENUM ('pending', 'delivered', 'applied', 'failed', 'expired');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('PERMISSION_REVOKED', 'DEVICE_ADMIN_DISABLE_REQUESTED', 'DEVICE_ADMIN_DISABLED', 'ENFORCEMENT_STOPPED', 'TIME_CHANGED', 'HEARTBEAT_LOST', 'APP_REMOVED_SUSPECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "phone_e164" TEXT NOT NULL,
    "name" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'uz',
    "push_token" TEXT,
    "push_platform" "Platform",
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_challenges" (
    "id" UUID NOT NULL,
    "phone_e164" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "families" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_members" (
    "family_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "FamilyRole" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_members_pkey" PRIMARY KEY ("family_id","user_id")
);

-- CreateTable
CREATE TABLE "children" (
    "id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "birth_year" INTEGER,
    "current_policy_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "children_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "child_id" UUID NOT NULL,
    "platform" "Platform" NOT NULL,
    "model" TEXT NOT NULL,
    "os_version" TEXT NOT NULL,
    "app_version" TEXT NOT NULL,
    "device_name" TEXT,
    "push_token" TEXT,
    "permission_status" JSONB NOT NULL DEFAULT '{}',
    "applied_policy_version" INTEGER,
    "enforcement_active" BOOLEAN NOT NULL DEFAULT false,
    "battery_level" INTEGER,
    "status" "DeviceStatus" NOT NULL DEFAULT 'active',
    "last_heartbeat_at" TIMESTAMPTZ(3),
    "heartbeat_lost_alerted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pairing_codes" (
    "id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "child_id" UUID,
    "code_hash" TEXT NOT NULL,
    "created_by_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pairing_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pairing_requests" (
    "id" UUID NOT NULL,
    "family_id" UUID,
    "pairing_code_id" UUID,
    "child_id" UUID,
    "method" "PairingMethod" NOT NULL,
    "claim_secret_hash" TEXT NOT NULL,
    "device_info" JSONB NOT NULL,
    "status" "PairingRequestStatus" NOT NULL DEFAULT 'pending',
    "decided_by_id" UUID,
    "decided_at" TIMESTAMPTZ(3),
    "device_id" UUID,
    "claimed_at" TIMESTAMPTZ(3),
    "requester_ip" TEXT,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pairing_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policies" (
    "id" UUID NOT NULL,
    "child_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "document" JSONB NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commands" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "type" "CommandType" NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "CommandStatus" NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "created_by_id" UUID,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "delivered_at" TIMESTAMPTZ(3),
    "acked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installed_apps" (
    "device_id" UUID NOT NULL,
    "app_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "installed_apps_pkey" PRIMARY KEY ("device_id","app_id")
);

-- CreateTable
CREATE TABLE "usage_logs" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "app_id" TEXT NOT NULL,
    "foreground_seconds" INTEGER NOT NULL,

    CONSTRAINT "usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "child_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "type" "AlertType" NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "device_id" UUID,
    "token_hash" TEXT NOT NULL,
    "chain_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "rotated_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_type" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "family_id" UUID,
    "target_type" TEXT,
    "target_id" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_e164_key" ON "users"("phone_e164");

-- CreateIndex
CREATE INDEX "otp_challenges_phone_e164_created_at_idx" ON "otp_challenges"("phone_e164", "created_at");

-- CreateIndex
CREATE INDEX "family_members_user_id_idx" ON "family_members"("user_id");

-- CreateIndex
CREATE INDEX "children_family_id_idx" ON "children"("family_id");

-- CreateIndex
CREATE INDEX "devices_child_id_idx" ON "devices"("child_id");

-- CreateIndex
CREATE INDEX "devices_status_last_heartbeat_at_idx" ON "devices"("status", "last_heartbeat_at");

-- CreateIndex
CREATE INDEX "pairing_codes_code_hash_expires_at_idx" ON "pairing_codes"("code_hash", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "pairing_requests_device_id_key" ON "pairing_requests"("device_id");

-- CreateIndex
CREATE INDEX "pairing_requests_family_id_status_idx" ON "pairing_requests"("family_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "policies_child_id_version_key" ON "policies"("child_id", "version");

-- CreateIndex
CREATE INDEX "commands_device_id_status_idx" ON "commands"("device_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "usage_logs_device_id_day_app_id_key" ON "usage_logs"("device_id", "day", "app_id");

-- CreateIndex
CREATE INDEX "alerts_family_id_created_at_idx" ON "alerts"("family_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_chain_id_idx" ON "refresh_tokens"("chain_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_device_id_idx" ON "refresh_tokens"("device_id");

-- CreateIndex
CREATE INDEX "audit_logs_family_id_created_at_idx" ON "audit_logs"("family_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_type_actor_id_idx" ON "audit_logs"("actor_type", "actor_id");

-- AddForeignKey
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "children" ADD CONSTRAINT "children_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pairing_codes" ADD CONSTRAINT "pairing_codes_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pairing_codes" ADD CONSTRAINT "pairing_codes_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pairing_codes" ADD CONSTRAINT "pairing_codes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pairing_requests" ADD CONSTRAINT "pairing_requests_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pairing_requests" ADD CONSTRAINT "pairing_requests_pairing_code_id_fkey" FOREIGN KEY ("pairing_code_id") REFERENCES "pairing_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pairing_requests" ADD CONSTRAINT "pairing_requests_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pairing_requests" ADD CONSTRAINT "pairing_requests_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pairing_requests" ADD CONSTRAINT "pairing_requests_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commands" ADD CONSTRAINT "commands_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commands" ADD CONSTRAINT "commands_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installed_apps" ADD CONSTRAINT "installed_apps_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A refresh token belongs to exactly one principal: a user or a device.
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_single_owner"
  CHECK (num_nonnulls("user_id", "device_id") = 1);

-- Policy versions start at 1.
ALTER TABLE "policies" ADD CONSTRAINT "policies_version_positive" CHECK ("version" >= 1);
