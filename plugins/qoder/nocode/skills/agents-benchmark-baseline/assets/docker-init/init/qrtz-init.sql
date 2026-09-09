/*
 Navicat Premium Data Transfer

 Source Server         : 九数云pg
 Source Server Type    : PostgreSQL
 Source Server Version : 120002
 Source Host           : 124.70.154.253:5432
 Source Catalog        : prod_sync
 Source Schema         : public

 Target Server Type    : PostgreSQL
 Target Server Version : 120002
 File Encoding         : 65001

 Date: 21/07/2022 17:03:58
*/


-- ----------------------------
-- Table structure for qrtz_blob_triggers
-- ----------------------------
CREATE TABLE IF NOT EXISTS "public"."qrtz_blob_triggers"
(
    "sched_name"
    varchar
(
    120
) COLLATE "pg_catalog"."default" NOT NULL,
    "trigger_name" varchar
(
    200
) COLLATE "pg_catalog"."default" NOT NULL,
    "trigger_group" varchar
(
    200
) COLLATE "pg_catalog"."default" NOT NULL,
    "blob_data" bytea
    )
;

-- ----------------------------
-- Table structure for qrtz_calendars
-- ----------------------------
CREATE TABLE IF NOT EXISTS "public"."qrtz_calendars"
(
    "sched_name"
    varchar
(
    120
) COLLATE "pg_catalog"."default" NOT NULL,
    "calendar_name" varchar
(
    200
) COLLATE "pg_catalog"."default" NOT NULL,
    "calendar" bytea NOT NULL
    )
;

-- ----------------------------
-- Table structure for qrtz_cron_triggers
-- ----------------------------
CREATE TABLE IF NOT EXISTS "public"."qrtz_cron_triggers"
(
    "sched_name"
    varchar
(
    120
) COLLATE "pg_catalog"."default" NOT NULL,
    "trigger_name" varchar
(
    200
) COLLATE "pg_catalog"."default" NOT NULL,
    "trigger_group" varchar
(
    200
) COLLATE "pg_catalog"."default" NOT NULL,
    "cron_expression" varchar
(
    120
) COLLATE "pg_catalog"."default" NOT NULL,
    "time_zone_id" varchar
(
    80
) COLLATE "pg_catalog"."default"
    )
;

-- ----------------------------
-- Table structure for qrtz_fired_triggers
-- ----------------------------
CREATE TABLE IF NOT EXISTS "public"."qrtz_fired_triggers"
(
    "sched_name"
    varchar
(
    120
) COLLATE "pg_catalog"."default" NOT NULL,
    "entry_id" varchar
(
    95
) COLLATE "pg_catalog"."default" NOT NULL,
    "trigger_name" varchar
(
    200
) COLLATE "pg_catalog"."default" NOT NULL,
    "trigger_group" varchar
(
    200
) COLLATE "pg_catalog"."default" NOT NULL,
    "instance_name" varchar
(
    200
) COLLATE "pg_catalog"."default" NOT NULL,
    "fired_time" int8 NOT NULL,
    "sched_time" int8 NOT NULL,
    "priority" int4 NOT NULL,
    "state" varchar
(
    16
) COLLATE "pg_catalog"."default" NOT NULL,
    "job_name" varchar
(
    200
) COLLATE "pg_catalog"."default",
    "job_group" varchar
(
    200
) COLLATE "pg_catalog"."default",
    "is_nonconcurrent" bool,
    "requests_recovery" bool
    )
;

-- ----------------------------
-- Table structure for qrtz_job_details
-- ----------------------------
CREATE TABLE IF NOT EXISTS "public"."qrtz_job_details"
(
    "sched_name"
    varchar
(
    120
) COLLATE "pg_catalog"."default" NOT NULL,
    "job_name" varchar
(
    200
) COLLATE "pg_catalog"."default" NOT NULL,
    "job_group" varchar
(
    200
) COLLATE "pg_catalog"."default" NOT NULL,
    "description" varchar
(
    250
) COLLATE "pg_catalog"."default",
    "job_class_name" varchar
(
    250
) COLLATE "pg_catalog"."default" NOT NULL,
    "is_durable" bool NOT NULL,
    "is_nonconcurrent" bool NOT NULL,
    "is_update_data" bool NOT NULL,
    "requests_recovery" bool NOT NULL,
    "job_data" bytea
    )
;

-- ----------------------------
-- Table structure for qrtz_locks
-- ----------------------------
CREATE TABLE IF NOT EXISTS "public"."qrtz_locks"
(
    "sched_name"
    varchar
(
    120
) COLLATE "pg_catalog"."default" NOT NULL,
    "lock_name" varchar
(
    40
) COLLATE "pg_catalog"."default" NOT NULL
    )
;

-- ----------------------------
-- Table structure for qrtz_paused_trigger_grps
-- ----------------------------
CREATE TABLE IF NOT EXISTS "public"."qrtz_paused_trigger_grps"
(
    "sched_name"
    varchar
(
    120
) COLLATE "pg_catalog"."default" NOT NULL,
    "trigger_group" varchar
(
    200
) COLLATE "pg_catalog"."default" NOT NULL
    )
;

-- ----------------------------
-- Table structure for qrtz_scheduler_state
-- ----------------------------
CREATE TABLE IF NOT EXISTS "public"."qrtz_scheduler_state"
(
    "sched_name"
    varchar
(
    120
) COLLATE "pg_catalog"."default" NOT NULL,
    "instance_name" varchar
(
    200
) COLLATE "pg_catalog"."default" NOT NULL,
    "last_checkin_time" int8 NOT NULL,
    "checkin_interval" int8 NOT NULL
    )
;

-- ----------------------------
-- Table structure for qrtz_simple_triggers
-- ----------------------------
CREATE TABLE IF NOT EXISTS "public"."qrtz_simple_triggers"
(
    "sched_name"
    varchar
(
    120
) COLLATE "pg_catalog"."default" NOT NULL,
    "trigger_name" varchar
(
    200
) COLLATE "pg_catalog"."default" NOT NULL,
    "trigger_group" varchar
(
    200
) COLLATE "pg_catalog"."default" NOT NULL,
    "repeat_count" int8 NOT NULL,
    "repeat_interval" int8 NOT NULL,
    "times_triggered" int8 NOT NULL
    )
;

-- ----------------------------
-- Table structure for qrtz_simprop_triggers
-- ----------------------------
CREATE TABLE IF NOT EXISTS "public"."qrtz_simprop_triggers"
(
    "sched_name"
    varchar
(
    120
) COLLATE "pg_catalog"."default" NOT NULL,
    "trigger_name" varchar
(
    200
) COLLATE "pg_catalog"."default" NOT NULL,
    "trigger_group" varchar
(
    200
) COLLATE "pg_catalog"."default" NOT NULL,
    "str_prop_1" varchar
(
    512
) COLLATE "pg_catalog"."default",
    "str_prop_2" varchar
(
    512
) COLLATE "pg_catalog"."default",
    "str_prop_3" varchar
(
    512
) COLLATE "pg_catalog"."default",
    "int_prop_1" int4,
    "int_prop_2" int4,
    "long_prop_1" int8,
    "long_prop_2" int8,
    "dec_prop_1" numeric
(
    13,
    4
),
    "dec_prop_2" numeric
(
    13,
    4
),
    "bool_prop_1" bool,
    "bool_prop_2" bool
    )
;

-- ----------------------------
-- Table structure for qrtz_triggers
-- ----------------------------
CREATE TABLE IF NOT EXISTS "public"."qrtz_triggers"
(
    "sched_name"
    varchar
(
    120
) COLLATE "pg_catalog"."default" NOT NULL,
    "trigger_name" varchar
(
    200
) COLLATE "pg_catalog"."default" NOT NULL,
    "trigger_group" varchar
(
    200
) COLLATE "pg_catalog"."default" NOT NULL,
    "job_name" varchar
(
    200
) COLLATE "pg_catalog"."default" NOT NULL,
    "job_group" varchar
(
    200
) COLLATE "pg_catalog"."default" NOT NULL,
    "description" varchar
(
    250
) COLLATE "pg_catalog"."default",
    "next_fire_time" int8,
    "prev_fire_time" int8,
    "priority" int4,
    "trigger_state" varchar
(
    16
) COLLATE "pg_catalog"."default" NOT NULL,
    "trigger_type" varchar
(
    8
) COLLATE "pg_catalog"."default" NOT NULL,
    "start_time" int8 NOT NULL,
    "end_time" int8,
    "calendar_name" varchar
(
    200
) COLLATE "pg_catalog"."default",
    "misfire_instr" int2,
    "job_data" bytea
    )
;

-- ----------------------------
-- Primary Key structure for table qrtz_blob_triggers
-- ----------------------------
ALTER TABLE "public"."qrtz_blob_triggers"
    ADD CONSTRAINT "qrtz_blob_triggers_pkey" PRIMARY KEY ("sched_name", "trigger_name", "trigger_group");

-- ----------------------------
-- Primary Key structure for table qrtz_calendars
-- ----------------------------
ALTER TABLE "public"."qrtz_calendars"
    ADD CONSTRAINT "qrtz_calendars_pkey" PRIMARY KEY ("sched_name", "calendar_name");

-- ----------------------------
-- Primary Key structure for table qrtz_cron_triggers
-- ----------------------------
ALTER TABLE "public"."qrtz_cron_triggers"
    ADD CONSTRAINT "qrtz_cron_triggers_pkey" PRIMARY KEY ("sched_name", "trigger_name", "trigger_group");

-- ----------------------------
-- Indexes structure for table qrtz_fired_triggers
-- ----------------------------
CREATE INDEX "idx_qrtz_ft_inst_job_req_rcvry" ON "public"."qrtz_fired_triggers" USING btree (
    "sched_name" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST,
    "instance_name" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST,
    "requests_recovery" "pg_catalog"."bool_ops" ASC NULLS LAST
    );
CREATE INDEX "idx_qrtz_ft_j_g" ON "public"."qrtz_fired_triggers" USING btree (
    "sched_name" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST,
    "job_name" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST,
    "job_group" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
    );
CREATE INDEX "idx_qrtz_ft_jg" ON "public"."qrtz_fired_triggers" USING btree (
    "sched_name" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST,
    "job_group" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
    );
CREATE INDEX "idx_qrtz_ft_t_g" ON "public"."qrtz_fired_triggers" USING btree (
    "sched_name" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST,
    "trigger_name" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST,
    "trigger_group" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
    );
CREATE INDEX "idx_qrtz_ft_tg" ON "public"."qrtz_fired_triggers" USING btree (
    "sched_name" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST,
    "trigger_group" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
    );
CREATE INDEX "idx_qrtz_ft_trig_inst_name" ON "public"."qrtz_fired_triggers" USING btree (
    "sched_name" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST,
    "instance_name" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
    );

-- ----------------------------
-- Primary Key structure for table qrtz_fired_triggers
-- ----------------------------
ALTER TABLE "public"."qrtz_fired_triggers"
    ADD CONSTRAINT "qrtz_fired_triggers_pkey" PRIMARY KEY ("sched_name", "entry_id");

-- ----------------------------
-- Indexes structure for table qrtz_job_details
-- ----------------------------
CREATE INDEX "idx_qrtz_j_grp" ON "public"."qrtz_job_details" USING btree (
    "sched_name" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST,
    "job_group" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
    );
CREATE INDEX "idx_qrtz_j_req_recovery" ON "public"."qrtz_job_details" USING btree (
    "sched_name" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST,
    "requests_recovery" "pg_catalog"."bool_ops" ASC NULLS LAST
    );

-- ----------------------------
-- Primary Key structure for table qrtz_job_details
-- ----------------------------
ALTER TABLE "public"."qrtz_job_details"
    ADD CONSTRAINT "qrtz_job_details_pkey" PRIMARY KEY ("sched_name", "job_name", "job_group");

-- ----------------------------
-- Primary Key structure for table qrtz_locks
-- ----------------------------
ALTER TABLE "public"."qrtz_locks"
    ADD CONSTRAINT "qrtz_locks_pkey" PRIMARY KEY ("sched_name", "lock_name");

-- ----------------------------
-- Primary Key structure for table qrtz_paused_trigger_grps
-- ----------------------------
ALTER TABLE "public"."qrtz_paused_trigger_grps"
    ADD CONSTRAINT "qrtz_paused_trigger_grps_pkey" PRIMARY KEY ("sched_name", "trigger_group");

-- ----------------------------
-- Primary Key structure for table qrtz_scheduler_state
-- ----------------------------
ALTER TABLE "public"."qrtz_scheduler_state"
    ADD CONSTRAINT "qrtz_scheduler_state_pkey" PRIMARY KEY ("sched_name", "instance_name");

-- ----------------------------
-- Primary Key structure for table qrtz_simple_triggers
-- ----------------------------
ALTER TABLE "public"."qrtz_simple_triggers"
    ADD CONSTRAINT "qrtz_simple_triggers_pkey" PRIMARY KEY ("sched_name", "trigger_name", "trigger_group");

-- ----------------------------
-- Primary Key structure for table qrtz_simprop_triggers
-- ----------------------------
ALTER TABLE "public"."qrtz_simprop_triggers"
    ADD CONSTRAINT "qrtz_simprop_triggers_pkey" PRIMARY KEY ("sched_name", "trigger_name", "trigger_group");

-- ----------------------------
-- Indexes structure for table qrtz_triggers
-- ----------------------------
CREATE INDEX "idx_qrtz_t_c" ON "public"."qrtz_triggers" USING btree (
    "sched_name" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST,
    "calendar_name" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
    );
CREATE INDEX "idx_qrtz_t_g" ON "public"."qrtz_triggers" USING btree (
    "sched_name" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST,
    "trigger_group" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
    );
CREATE INDEX "idx_qrtz_t_j" ON "public"."qrtz_triggers" USING btree (
    "sched_name" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST,
    "job_name" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST,
    "job_group" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
    );
CREATE INDEX "idx_qrtz_t_jg" ON "public"."qrtz_triggers" USING btree (
    "sched_name" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST,
    "job_group" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
    );
CREATE INDEX "idx_qrtz_t_n_g_state" ON "public"."qrtz_triggers" USING btree (
    "sched_name" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST,
    "trigger_group" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST,
    "trigger_state" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
    );
CREATE INDEX "idx_qrtz_t_n_state" ON "public"."qrtz_triggers" USING btree (
    "sched_name" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST,
    "trigger_name" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST,
    "trigger_group" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST,
    "trigger_state" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
    );
CREATE INDEX "idx_qrtz_t_next_fire_time" ON "public"."qrtz_triggers" USING btree (
    "sched_name" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST,
    "next_fire_time" "pg_catalog"."int8_ops" ASC NULLS LAST
    );
CREATE INDEX "idx_qrtz_t_nft_misfire" ON "public"."qrtz_triggers" USING btree (
    "sched_name" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST,
    "misfire_instr" "pg_catalog"."int2_ops" ASC NULLS LAST,
    "next_fire_time" "pg_catalog"."int8_ops" ASC NULLS LAST
    );
CREATE INDEX "idx_qrtz_t_nft_st" ON "public"."qrtz_triggers" USING btree (
    "sched_name" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST,
    "trigger_state" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST,
    "next_fire_time" "pg_catalog"."int8_ops" ASC NULLS LAST
    );
CREATE INDEX "idx_qrtz_t_nft_st_misfire" ON "public"."qrtz_triggers" USING btree (
    "sched_name" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST,
    "misfire_instr" "pg_catalog"."int2_ops" ASC NULLS LAST,
    "next_fire_time" "pg_catalog"."int8_ops" ASC NULLS LAST,
    "trigger_state" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
    );
CREATE INDEX "idx_qrtz_t_nft_st_misfire_grp" ON "public"."qrtz_triggers" USING btree (
    "sched_name" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST,
    "misfire_instr" "pg_catalog"."int2_ops" ASC NULLS LAST,
    "next_fire_time" "pg_catalog"."int8_ops" ASC NULLS LAST,
    "trigger_group" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST,
    "trigger_state" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
    );
CREATE INDEX "idx_qrtz_t_state" ON "public"."qrtz_triggers" USING btree (
    "sched_name" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST,
    "trigger_state" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
    );

-- ----------------------------
-- Primary Key structure for table qrtz_triggers
-- ----------------------------
ALTER TABLE "public"."qrtz_triggers"
    ADD CONSTRAINT "qrtz_triggers_pkey" PRIMARY KEY ("sched_name", "trigger_name", "trigger_group");

-- ----------------------------
-- -- Foreign Keys structure for table qrtz_blob_triggers
-- -- ----------------------------
-- ALTER TABLE "public"."qrtz_blob_triggers" ADD CONSTRAINT "qrtz_blob_triggers_sched_name_trigger_name_trigger_group_fkey" FOREIGN KEY ("sched_name", "trigger_name", "trigger_group") REFERENCES "public"."qrtz_triggers" ("sched_name", "trigger_name", "trigger_group") ON DELETE NO ACTION ON UPDATE NO ACTION;
--
-- -- ----------------------------
-- -- Foreign Keys structure for table qrtz_cron_triggers
-- -- ----------------------------
-- ALTER TABLE "public"."qrtz_cron_triggers" ADD CONSTRAINT "qrtz_cron_triggers_sched_name_trigger_name_trigger_group_fkey" FOREIGN KEY ("sched_name", "trigger_name", "trigger_group") REFERENCES "public"."qrtz_triggers" ("sched_name", "trigger_name", "trigger_group") ON DELETE NO ACTION ON UPDATE NO ACTION;
--
-- -- ----------------------------
-- -- Foreign Keys structure for table qrtz_simple_triggers
-- -- ----------------------------
-- ALTER TABLE "public"."qrtz_simple_triggers" ADD CONSTRAINT "qrtz_simple_triggers_sched_name_trigger_name_trigger_group_fkey" FOREIGN KEY ("sched_name", "trigger_name", "trigger_group") REFERENCES "public"."qrtz_triggers" ("sched_name", "trigger_name", "trigger_group") ON DELETE NO ACTION ON UPDATE NO ACTION;
--
-- -- ----------------------------
-- -- Foreign Keys structure for table qrtz_simprop_triggers
-- -- ----------------------------
-- ALTER TABLE "public"."qrtz_simprop_triggers" ADD CONSTRAINT "qrtz_simprop_triggers_sched_name_trigger_name_trigger_grou_fkey" FOREIGN KEY ("sched_name", "trigger_name", "trigger_group") REFERENCES "public"."qrtz_triggers" ("sched_name", "trigger_name", "trigger_group") ON DELETE NO ACTION ON UPDATE NO ACTION;
--
-- -- ----------------------------
-- -- Foreign Keys structure for table qrtz_triggers
-- -- ----------------------------
-- ALTER TABLE "public"."qrtz_triggers" ADD CONSTRAINT "qrtz_triggers_sched_name_job_name_job_group_fkey" FOREIGN KEY ("sched_name", "job_name", "job_group") REFERENCES "public"."qrtz_job_details" ("sched_name", "job_name", "job_group") ON DELETE NO ACTION ON UPDATE NO ACTION;
