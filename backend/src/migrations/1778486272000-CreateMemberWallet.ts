import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMemberWallet1778486272000 implements MigrationInterface {
  name = 'CreateMemberWallet1778486272000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // member_wallets 表
    await queryRunner.query(`
      CREATE TABLE \`member_wallets\` (
        \`id\`         INT NOT NULL AUTO_INCREMENT,
        \`accountId\`  INT NOT NULL,
        \`balance\`    DECIMAL(10,2) NOT NULL DEFAULT '0.00',
        \`createdAt\`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`IDX_member_wallets_accountId\` (\`accountId\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // wallet_transactions 表
    await queryRunner.query(`
      CREATE TABLE \`wallet_transactions\` (
        \`id\`                  INT NOT NULL AUTO_INCREMENT,
        \`walletId\`            INT NOT NULL,
        \`type\`                ENUM('topup','deduct','refund','manual_topup') NOT NULL,
        \`amount\`              DECIMAL(10,2) NOT NULL,
        \`balanceAfter\`        DECIMAL(10,2) NOT NULL,
        \`bookingId\`           INT NULL,
        \`stripeSessionId\`     VARCHAR(255) NULL,
        \`note\`                TEXT NULL,
        \`createdByAccountId\`  INT NOT NULL,
        \`createdAt\`           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_wallet_transactions_walletId\` (\`walletId\`),
        INDEX \`IDX_wallet_transactions_bookingId\` (\`bookingId\`),
        CONSTRAINT \`FK_wallet_transactions_wallet\`
          FOREIGN KEY (\`walletId\`) REFERENCES \`member_wallets\`(\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // venues 表新增 cancellationPolicyHours 欄位
    await queryRunner.query(`
      ALTER TABLE \`venues\`
        ADD COLUMN \`cancellationPolicyHours\` INT NULL DEFAULT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`venues\` DROP COLUMN \`cancellationPolicyHours\``,
    );
    await queryRunner.query(`DROP TABLE \`wallet_transactions\``);
    await queryRunner.query(`DROP TABLE \`member_wallets\``);
  }
}
