import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPricingRulesAndVenueDefault1778337765852 implements MigrationInterface {
  name = 'AddPricingRulesAndVenueDefault1778337765852';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`pricing_rules\` (\`id\` int NOT NULL AUTO_INCREMENT, \`venueId\` int NOT NULL, \`dayOfWeek\` tinyint NOT NULL, \`startTime\` varchar(5) NOT NULL, \`endTime\` varchar(5) NOT NULL, \`pricePerHour\` decimal(10,2) NOT NULL, \`priority\` int NOT NULL DEFAULT '0', \`active\` tinyint NOT NULL DEFAULT 1, \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX \`IDX_9c4a3ca3d85a50da28c0ca2709\` (\`venueId\`, \`active\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`venues\` ADD \`defaultPricePerHour\` decimal(10,2) NOT NULL DEFAULT '0.00'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`pricing_rules\` ADD CONSTRAINT \`FK_b87883c20c869706c7afecc78fd\` FOREIGN KEY (\`venueId\`) REFERENCES \`venues\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`pricing_rules\` DROP FOREIGN KEY \`FK_b87883c20c869706c7afecc78fd\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`venues\` DROP COLUMN \`defaultPricePerHour\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_9c4a3ca3d85a50da28c0ca2709\` ON \`pricing_rules\``,
    );
    await queryRunner.query(`DROP TABLE \`pricing_rules\``);
  }
}
