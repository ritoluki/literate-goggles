import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260925121436 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "order_access_grant" drop constraint if exists "order_access_grant_session_id_order_id_unique";`);
    this.addSql(`alter table if exists "operational_setting" drop constraint if exists "operational_setting_key_unique";`);
    this.addSql(`alter table if exists "notification_delivery" drop constraint if exists "notification_delivery_order_id_template_key_template_version_unique";`);
    this.addSql(`alter table if exists "idempotency_request" drop constraint if exists "idempotency_request_session_id_key_operation_unique";`);
    this.addSql(`alter table if exists "commerce_session" drop constraint if exists "commerce_session_cart_id_unique";`);
    this.addSql(`alter table if exists "commerce_session" drop constraint if exists "commerce_session_token_hash_unique";`);
    this.addSql(`alter table if exists "cart_completion" drop constraint if exists "cart_completion_cart_id_unique";`);
    this.addSql(`alter table if exists "advisor_preference" drop constraint if exists "advisor_preference_session_id_unique";`);
    this.addSql(`create table if not exists "advisor_preference" ("id" text not null, "session_id" text not null, "criteria" jsonb not null, "version" integer not null default 1, "expires_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "advisor_preference_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_advisor_preference_session_id_unique" ON "advisor_preference" ("session_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_advisor_preference_expires_at" ON "advisor_preference" ("expires_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_advisor_preference_deleted_at" ON "advisor_preference" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "cart_completion" ("id" text not null, "cart_id" text not null, "session_id" text not null, "status" text check ("status" in ('created', 'processing', 'succeeded', 'reconciling', 'failed')) not null default 'created', "workflow_transaction_id" text null, "order_id" text null, "cart_fingerprint" text not null, "last_error_code" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cart_completion_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cart_completion_cart_id_unique" ON "cart_completion" ("cart_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cart_completion_session_id" ON "cart_completion" ("session_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cart_completion_order_id" ON "cart_completion" ("order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cart_completion_deleted_at" ON "cart_completion" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "commerce_session" ("id" text not null, "token_hash" text not null, "cart_id" text null, "expires_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "commerce_session_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_commerce_session_token_hash_unique" ON "commerce_session" ("token_hash") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_commerce_session_cart_id_unique" ON "commerce_session" ("cart_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_commerce_session_expires_at" ON "commerce_session" ("expires_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_commerce_session_deleted_at" ON "commerce_session" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "idempotency_request" ("id" text not null, "session_id" text not null, "key" text not null, "operation" text not null, "request_hash" text not null, "result_pointer" text null, "status" text check ("status" in ('created', 'processing', 'succeeded', 'failed')) not null default 'created', "expires_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "idempotency_request_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_idempotency_request_session_id" ON "idempotency_request" ("session_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_idempotency_request_expires_at" ON "idempotency_request" ("expires_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_idempotency_request_deleted_at" ON "idempotency_request" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_idempotency_request_session_id_key_operation_unique" ON "idempotency_request" ("session_id", "key", "operation") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "notification_delivery" ("id" text not null, "order_id" text not null, "template_key" text not null, "template_version" text not null, "provider_message_id" text null, "attempt_count" integer not null default 0, "status" text check ("status" in ('pending', 'sending', 'sent', 'retry', 'failed')) not null default 'pending', "next_attempt_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "notification_delivery_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_notification_delivery_order_id" ON "notification_delivery" ("order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_notification_delivery_next_attempt_at" ON "notification_delivery" ("next_attempt_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_notification_delivery_deleted_at" ON "notification_delivery" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_notification_delivery_order_id_template_key_template_version_unique" ON "notification_delivery" ("order_id", "template_key", "template_version") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "operational_setting" ("id" text not null, "key" text not null, "value" jsonb not null, "version" integer not null default 1, "changed_by" text not null, "changed_at" timestamptz not null, "reason" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "operational_setting_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_operational_setting_key_unique" ON "operational_setting" ("key") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_operational_setting_deleted_at" ON "operational_setting" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "order_access_grant" ("id" text not null, "session_id" text not null, "order_id" text not null, "public_reference" text not null, "expires_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "order_access_grant_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_order_access_grant_session_id" ON "order_access_grant" ("session_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_order_access_grant_order_id" ON "order_access_grant" ("order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_order_access_grant_expires_at" ON "order_access_grant" ("expires_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_order_access_grant_deleted_at" ON "order_access_grant" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_order_access_grant_session_id_order_id_unique" ON "order_access_grant" ("session_id", "order_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "advisor_preference" cascade;`);

    this.addSql(`drop table if exists "cart_completion" cascade;`);

    this.addSql(`drop table if exists "commerce_session" cascade;`);

    this.addSql(`drop table if exists "idempotency_request" cascade;`);

    this.addSql(`drop table if exists "notification_delivery" cascade;`);

    this.addSql(`drop table if exists "operational_setting" cascade;`);

    this.addSql(`drop table if exists "order_access_grant" cascade;`);
  }

}
