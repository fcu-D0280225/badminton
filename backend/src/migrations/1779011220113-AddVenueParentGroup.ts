import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVenueParentGroup1779011220113 implements MigrationInterface {
  name = 'AddVenueParentGroup1779011220113';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`venues\` ADD \`parentVenueId\` int NULL DEFAULT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_venues_parentVenueId\` ON \`venues\` (\`parentVenueId\`)`,
    );
    await queryRunner.query(
      `ALTER TABLE \`venues\` ADD CONSTRAINT \`FK_venues_parentVenueId\` FOREIGN KEY (\`parentVenueId\`) REFERENCES \`venues\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`venues\` DROP FOREIGN KEY \`FK_venues_parentVenueId\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_venues_parentVenueId\` ON \`venues\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`venues\` DROP COLUMN \`parentVenueId\``,
    );
  }
}
