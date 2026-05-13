import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailToAccount1778572800000 implements MigrationInterface {
  name = 'AddEmailToAccount1778572800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`accounts\`
        ADD COLUMN \`email\` VARCHAR(255) NULL DEFAULT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`accounts\` DROP COLUMN \`email\`
    `);
  }
}
