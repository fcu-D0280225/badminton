import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BADM-T15 開放 API：建立 api_keys 表
 */
export class CreateApiKeys1778817600000 implements MigrationInterface {
  name = 'CreateApiKeys1778817600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`api_keys\` (
        \`id\`                   VARCHAR(36) NOT NULL,
        \`name\`                 VARCHAR(255) NOT NULL,
        \`keyHash\`              VARCHAR(255) NOT NULL,
        \`keyPrefix\`            VARCHAR(32) NOT NULL,
        \`scopes\`               TEXT NOT NULL,
        \`venueIds\`             TEXT NOT NULL,
        \`createdByAccountId\`   INT NOT NULL,
        \`expiresAt\`            DATETIME NULL DEFAULT NULL,
        \`lastUsedAt\`           DATETIME NULL DEFAULT NULL,
        \`revokedAt\`            DATETIME NULL DEFAULT NULL,
        \`createdAt\`            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_api_keys_keyPrefix\` (\`keyPrefix\`),
        INDEX \`IDX_api_keys_revokedAt\` (\`revokedAt\`),
        CONSTRAINT \`FK_api_keys_createdBy\`
          FOREIGN KEY (\`createdByAccountId\`) REFERENCES \`accounts\`(\`id\`)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`api_keys\``);
  }
}
