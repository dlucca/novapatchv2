CREATE TABLE IF NOT EXISTS "subscription_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"cycle_number" integer NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"order_id" uuid,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid,
	"subscription_run_id" uuid,
	"provider" text NOT NULL,
	"provider_charge_id" text,
	"provider_customer_id" text,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"status" text NOT NULL,
	"failure_code" text,
	"provider_response" jsonb,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_attempts_parent_xor" CHECK (("payment_attempts"."order_id" IS NULL) <> ("payment_attempts"."subscription_run_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
DROP TABLE "subscription_billings" CASCADE;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "country" text DEFAULT 'mx' NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "gateway_customer_ids" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "default_shipping_address" jsonb;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "fulfillment_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "picked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipped_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivered_at" timestamp with time zone;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscription_runs" ADD CONSTRAINT "subscription_runs_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscription_runs" ADD CONSTRAINT "subscription_runs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_subscription_run_id_subscription_runs_id_fk" FOREIGN KEY ("subscription_run_id") REFERENCES "public"."subscription_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_runs_sub_scheduled_unique" ON "subscription_runs" USING btree ("subscription_id","scheduled_for");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_runs_status_scheduled_for_idx" ON "subscription_runs" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_runs_subscription_id_idx" ON "subscription_runs" USING btree ("subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_attempts_provider_charge_unique" ON "payment_attempts" USING btree ("provider","provider_charge_id") WHERE "payment_attempts"."provider_charge_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_attempts_order_id_idx" ON "payment_attempts" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_attempts_subscription_run_id_idx" ON "payment_attempts" USING btree ("subscription_run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_attempts_status_attempted_at_idx" ON "payment_attempts" USING btree ("status","attempted_at" desc);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "webhook_events_provider_event_unique" ON "webhook_events" USING btree ("provider","event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_events_unprocessed_idx" ON "webhook_events" USING btree ("received_at") WHERE "webhook_events"."processed_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_events_provider_type_idx" ON "webhook_events" USING btree ("provider","event_type","received_at");--> statement-breakpoint
ALTER TABLE "customers" DROP COLUMN IF EXISTS "openpay_customer_id";--> statement-breakpoint
ALTER TABLE "customers" DROP COLUMN IF EXISTS "mercadopago_customer_id";