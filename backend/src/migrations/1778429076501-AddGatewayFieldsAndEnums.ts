import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGatewayFieldsAndEnums1778429076501 implements MigrationInterface {
  name = 'AddGatewayFieldsAndEnums1778429076501';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Quality-002: payments.status ENUM 擴充（含 processing / refunding / failed）
    await queryRunner.query(
      `ALTER TABLE \`payments\` MODIFY \`status\`
       ENUM('unpaid','processing','refunding','paid','refunded','failed')
       NOT NULL DEFAULT 'unpaid'`,
    );

    // Quality-002: bookings.status ENUM 明確化
    await queryRunner.query(
      `ALTER TABLE \`bookings\` MODIFY \`status\`
       ENUM('pending','confirmed','cancelled')
       NOT NULL DEFAULT 'pending'`,
    );

    // T06: 新增 gatewayOrderId 欄位
    await queryRunner.query(
      `ALTER TABLE \`payments\` ADD COLUMN \`gatewayOrderId\` VARCHAR(255) NULL`,
    );

    // T06: 新增 webhookPayload 欄位
    await queryRunner.query(
      `ALTER TABLE \`payments\` ADD COLUMN \`webhookPayload\` TEXT NULL`,
    );

    // T06: gatewayOrderId unique index
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`idx_payments_gatewayOrderId\`
       ON \`payments\`(\`gatewayOrderId\`)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`idx_payments_gatewayOrderId\` ON \`payments\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`payments\` DROP COLUMN \`webhookPayload\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`payments\` DROP COLUMN \`gatewayOrderId\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`bookings\` MODIFY \`status\`
       VARCHAR(255) NOT NULL DEFAULT 'pending'`,
    );

    await queryRunner.query(
      `ALTER TABLE \`payments\` MODIFY \`status\`
       VARCHAR(255) NOT NULL DEFAULT 'unpaid'`,
    );
  }
}
