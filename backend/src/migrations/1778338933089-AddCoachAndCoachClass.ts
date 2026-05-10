import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCoachAndCoachClass1778338933089 implements MigrationInterface {
  name = 'AddCoachAndCoachClass1778338933089';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`coaches\` (\`id\` int NOT NULL AUTO_INCREMENT, \`venueId\` int NOT NULL, \`name\` varchar(255) NOT NULL, \`contact\` varchar(255) NULL, \`hourlyRate\` decimal(10,2) NOT NULL DEFAULT '0.00', \`bio\` text NULL, \`active\` tinyint NOT NULL DEFAULT 1, \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX \`IDX_e14e07e87e51b0cfa2aed5f9ad\` (\`venueId\`, \`active\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`coach_classes\` (\`id\` int NOT NULL AUTO_INCREMENT, \`venueId\` int NOT NULL, \`coachId\` int NOT NULL, \`date\` varchar(255) NOT NULL, \`timeSlot\` varchar(255) NOT NULL, \`capacity\` int NULL, \`feePerStudent\` decimal(10,2) NOT NULL DEFAULT '0.00', \`status\` varchar(16) NOT NULL DEFAULT 'open', \`notes\` text NULL, \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX \`IDX_c56699ea9a622b162e95807c04\` (\`coachId\`), INDEX \`IDX_41e4e7ffacc0e4969dfb0c4ad7\` (\`venueId\`, \`date\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`coaches\` ADD CONSTRAINT \`FK_69425856d6f6f0d1edaf64b625c\` FOREIGN KEY (\`venueId\`) REFERENCES \`venues\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`coach_classes\` ADD CONSTRAINT \`FK_c45f47189410e540f5f189e316d\` FOREIGN KEY (\`venueId\`) REFERENCES \`venues\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`coach_classes\` ADD CONSTRAINT \`FK_c56699ea9a622b162e95807c041\` FOREIGN KEY (\`coachId\`) REFERENCES \`coaches\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`coach_classes\` DROP FOREIGN KEY \`FK_c56699ea9a622b162e95807c041\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`coach_classes\` DROP FOREIGN KEY \`FK_c45f47189410e540f5f189e316d\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`coaches\` DROP FOREIGN KEY \`FK_69425856d6f6f0d1edaf64b625c\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_41e4e7ffacc0e4969dfb0c4ad7\` ON \`coach_classes\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_c56699ea9a622b162e95807c04\` ON \`coach_classes\``,
    );
    await queryRunner.query(`DROP TABLE \`coach_classes\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_e14e07e87e51b0cfa2aed5f9ad\` ON \`coaches\``,
    );
    await queryRunner.query(`DROP TABLE \`coaches\``);
  }
}
