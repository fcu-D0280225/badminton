import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 基礎 schema migration — 包含所有原始表的建立語句（IF NOT EXISTS）。
 *
 * 背景：原始 14 張表是用 synchronize: true 建立，此後改為 synchronize: false。
 * 補充此 migration 確保全新環境（含 CI、新開發機、disaster recovery）可以
 * 正確執行 `migrationsRun: true` 的啟動流程。
 *
 * 使用 CREATE TABLE IF NOT EXISTS，對現有 DB 為冪等操作。
 * 現有 DB 需將此 migration 標記為已執行：
 *   INSERT INTO migrations (timestamp, name) VALUES (0, 'InitialSchema0000000000000');
 */
export class InitialSchema0000000000000 implements MigrationInterface {
  name = 'InitialSchema0000000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── accounts ──────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`accounts\` (
        \`id\`             int NOT NULL AUTO_INCREMENT,
        \`username\`       varchar(255) NOT NULL,
        \`passwordHash\`   varchar(255) NOT NULL,
        \`role\`           varchar(255) NOT NULL,
        \`entityId\`       int NOT NULL,
        \`linkedEntityId\` int          NULL,
        \`createdAt\`      datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`IDX_accounts_username\` (\`username\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ── venues ────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`venues\` (
        \`id\`                   int NOT NULL AUTO_INCREMENT,
        \`name\`                 varchar(255) NOT NULL,
        \`contact\`              varchar(255) NOT NULL,
        \`address\`              varchar(255)     NULL,
        \`description\`          text             NULL,
        \`openingHours\`         text             NULL,
        \`feeInfo\`              text             NULL,
        \`defaultPricePerHour\`  decimal(10,2)    NOT NULL DEFAULT 0,
        \`createdAt\`            datetime         NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ── organizers ────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`organizers\` (
        \`id\`          int NOT NULL AUTO_INCREMENT,
        \`name\`        varchar(255) NOT NULL,
        \`contact\`     varchar(255) NOT NULL,
        \`description\` text             NULL,
        \`createdAt\`   datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ── players ───────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`players\` (
        \`id\`        int NOT NULL AUTO_INCREMENT,
        \`name\`      varchar(255) NOT NULL,
        \`contact\`   varchar(255) NOT NULL,
        \`createdAt\` datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ── bookers ───────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`bookers\` (
        \`id\`        int NOT NULL AUTO_INCREMENT,
        \`name\`      varchar(255) NOT NULL,
        \`contact\`   varchar(255) NOT NULL,
        \`createdAt\` datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ── bookings ──────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`bookings\` (
        \`id\`               int NOT NULL AUTO_INCREMENT,
        \`venueId\`          int NOT NULL,
        \`organizerId\`      int          NULL,
        \`playerId\`         int          NULL,
        \`bookerId\`         int          NULL,
        \`date\`             varchar(255) NOT NULL,
        \`timeSlot\`         varchar(255) NOT NULL,
        \`notes\`            text         NULL,
        \`status\`           varchar(255) NOT NULL DEFAULT 'pending',
        \`checkedIn\`        tinyint      NOT NULL DEFAULT 0,
        \`recurringGroupId\` varchar(255)     NULL,
        \`recurringType\`    varchar(255)     NULL,
        \`holdExpiresAt\`    datetime         NULL,
        \`paymentId\`        int              NULL,
        \`createdAt\`        datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_bookings_venueId\`     FOREIGN KEY (\`venueId\`)     REFERENCES \`venues\`(\`id\`),
        CONSTRAINT \`FK_bookings_organizerId\` FOREIGN KEY (\`organizerId\`) REFERENCES \`organizers\`(\`id\`),
        CONSTRAINT \`FK_bookings_playerId\`    FOREIGN KEY (\`playerId\`)    REFERENCES \`players\`(\`id\`),
        CONSTRAINT \`FK_bookings_bookerId\`    FOREIGN KEY (\`bookerId\`)    REFERENCES \`bookers\`(\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ── payments ──────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`payments\` (
        \`id\`            int NOT NULL AUTO_INCREMENT,
        \`bookingId\`     int          NOT NULL,
        \`amount\`        decimal(10,2) NOT NULL,
        \`status\`        varchar(255)  NOT NULL DEFAULT 'unpaid',
        \`paymentMethod\` text              NULL,
        \`transactionId\` text              NULL,
        \`paidAt\`        datetime          NULL,
        \`createdAt\`     datetime      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`REL_payments_bookingId\` (\`bookingId\`),
        CONSTRAINT \`FK_payments_bookingId\` FOREIGN KEY (\`bookingId\`) REFERENCES \`bookings\`(\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ── booking_participants ──────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`booking_participants\` (
        \`id\`            int NOT NULL AUTO_INCREMENT,
        \`bookingId\`     int          NOT NULL,
        \`name\`          varchar(255) NOT NULL,
        \`phone\`         varchar(255)     NULL,
        \`checkedIn\`     tinyint      NOT NULL DEFAULT 0,
        \`paymentStatus\` varchar(255) NOT NULL DEFAULT 'unpaid',
        \`amount\`        decimal(10,2) NOT NULL DEFAULT 0,
        \`addedAt\`       datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_booking_participants_bookingId\` (\`bookingId\`),
        CONSTRAINT \`FK_booking_participants_bookingId\`
          FOREIGN KEY (\`bookingId\`) REFERENCES \`bookings\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ── ratings ───────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`ratings\` (
        \`id\`           int NOT NULL AUTO_INCREMENT,
        \`playerId\`     int NOT NULL,
        \`venueId\`      int          NULL,
        \`organizerId\`  int          NULL,
        \`score\`        int          NOT NULL,
        \`comment\`      text         NULL,
        \`createdAt\`    datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_ratings_playerId\`    FOREIGN KEY (\`playerId\`)    REFERENCES \`players\`(\`id\`),
        CONSTRAINT \`FK_ratings_venueId\`     FOREIGN KEY (\`venueId\`)     REFERENCES \`venues\`(\`id\`),
        CONSTRAINT \`FK_ratings_organizerId\` FOREIGN KEY (\`organizerId\`) REFERENCES \`organizers\`(\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ── waitlists ─────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`waitlists\` (
        \`id\`          int NOT NULL AUTO_INCREMENT,
        \`venueId\`     int          NOT NULL,
        \`date\`        varchar(255) NOT NULL,
        \`timeSlot\`    varchar(255) NOT NULL,
        \`playerId\`    int              NULL,
        \`organizerId\` int              NULL,
        \`status\`      varchar(255) NOT NULL DEFAULT 'waiting',
        \`position\`    int          NOT NULL DEFAULT 0,
        \`createdAt\`   datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ── venue_notes ───────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`venue_notes\` (
        \`id\`         int NOT NULL AUTO_INCREMENT,
        \`venueId\`    int          NOT NULL,
        \`content\`    text         NOT NULL,
        \`visibility\` varchar(255) NOT NULL DEFAULT 'public',
        \`createdAt\`  datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_venue_notes_venueId\` FOREIGN KEY (\`venueId\`) REFERENCES \`venues\`(\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ── organizer_notes ───────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`organizer_notes\` (
        \`id\`           int NOT NULL AUTO_INCREMENT,
        \`organizerId\`  int          NOT NULL,
        \`content\`      text         NOT NULL,
        \`visibility\`   varchar(255) NOT NULL DEFAULT 'public',
        \`createdAt\`    datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_organizer_notes_organizerId\`
          FOREIGN KEY (\`organizerId\`) REFERENCES \`organizers\`(\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ── push_subscriptions ────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`push_subscriptions\` (
        \`id\`        int NOT NULL AUTO_INCREMENT,
        \`accountId\` int              NOT NULL,
        \`endpoint\`  varchar(500)     NOT NULL,
        \`p256dh\`    text             NOT NULL,
        \`auth\`      text             NOT NULL,
        \`createdAt\` datetime         NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`IDX_push_subscriptions_endpoint\` (\`endpoint\`),
        CONSTRAINT \`FK_push_subscriptions_accountId\`
          FOREIGN KEY (\`accountId\`) REFERENCES \`accounts\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ── payment_records ───────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`payment_records\` (
        \`id\`               int NOT NULL AUTO_INCREMENT,
        \`venueId\`          int          NOT NULL,
        \`teamName\`         varchar(255) NOT NULL,
        \`courtNumber\`      varchar(255)     NULL,
        \`date\`             varchar(255) NOT NULL,
        \`startTime\`        varchar(255) NOT NULL,
        \`endTime\`          varchar(255) NOT NULL,
        \`amount\`           decimal(10,2) NOT NULL,
        \`paymentStatus\`    varchar(255) NOT NULL DEFAULT 'unpaid',
        \`paidAt\`           datetime         NULL,
        \`paidByNote\`       text             NULL,
        \`recurringGroupId\` varchar(255)     NULL,
        \`createdAt\`        datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\`        datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_payment_records_venueId_date\`      (\`venueId\`, \`date\`),
        INDEX \`IDX_payment_records_recurringGroupId\`  (\`recurringGroupId\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 反向順序刪除（先刪有 FK 依賴的子表）
    await queryRunner.query(`DROP TABLE IF EXISTS \`payment_records\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`push_subscriptions\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`organizer_notes\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`venue_notes\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`waitlists\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`ratings\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`booking_participants\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`payments\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`bookings\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`bookers\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`players\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`organizers\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`venues\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`accounts\``);
  }
}
