import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCoachClassEnrollments1779011329717
  implements MigrationInterface
{
  name = 'AddCoachClassEnrollments1779011329717';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`coach_class_enrollments\` (` +
        `\`id\` int NOT NULL AUTO_INCREMENT, ` +
        `\`coachClassId\` int NOT NULL, ` +
        `\`playerId\` int NOT NULL, ` +
        `\`status\` varchar(16) NOT NULL DEFAULT 'enrolled', ` +
        `\`checkedInAt\` datetime NULL, ` +
        `\`paymentStatus\` varchar(16) NOT NULL DEFAULT 'pending', ` +
        `\`amount\` decimal(10,2) NOT NULL DEFAULT '0.00', ` +
        `\`notes\` text NULL, ` +
        `\`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, ` +
        `INDEX \`IDX_cce_coachClassId\` (\`coachClassId\`), ` +
        `INDEX \`IDX_cce_playerId\` (\`playerId\`), ` +
        `UNIQUE INDEX \`UQ_cce_coachClassId_playerId\` (\`coachClassId\`, \`playerId\`), ` +
        `PRIMARY KEY (\`id\`)` +
        `) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`coach_class_enrollments\` ADD CONSTRAINT \`FK_cce_coachClassId\` ` +
        `FOREIGN KEY (\`coachClassId\`) REFERENCES \`coach_classes\`(\`id\`) ` +
        `ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`coach_class_enrollments\` ADD CONSTRAINT \`FK_cce_playerId\` ` +
        `FOREIGN KEY (\`playerId\`) REFERENCES \`players\`(\`id\`) ` +
        `ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`coach_class_enrollments\` DROP FOREIGN KEY \`FK_cce_playerId\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`coach_class_enrollments\` DROP FOREIGN KEY \`FK_cce_coachClassId\``,
    );
    await queryRunner.query(
      `DROP INDEX \`UQ_cce_coachClassId_playerId\` ON \`coach_class_enrollments\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_cce_playerId\` ON \`coach_class_enrollments\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_cce_coachClassId\` ON \`coach_class_enrollments\``,
    );
    await queryRunner.query(`DROP TABLE \`coach_class_enrollments\``);
  }
}
