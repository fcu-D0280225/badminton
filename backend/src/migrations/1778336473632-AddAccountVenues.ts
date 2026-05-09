import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAccountVenues1778336473632 implements MigrationInterface {
    name = 'AddAccountVenues1778336473632'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`account_venues\` (\`accountId\` int NOT NULL, \`venueId\` int NOT NULL, \`isPrimary\` tinyint NOT NULL DEFAULT 0, \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX \`IDX_763c88cca7b4cbbe5effd99b1d\` (\`venueId\`), INDEX \`IDX_105cc88d7c6c7dda6ac445ea03\` (\`accountId\`), PRIMARY KEY (\`accountId\`, \`venueId\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`account_venues\` ADD CONSTRAINT \`FK_105cc88d7c6c7dda6ac445ea03a\` FOREIGN KEY (\`accountId\`) REFERENCES \`accounts\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`account_venues\` ADD CONSTRAINT \`FK_763c88cca7b4cbbe5effd99b1df\` FOREIGN KEY (\`venueId\`) REFERENCES \`venues\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);

        // Backfill：既有 role='venue' 的帳號把 entityId 灌進 pivot 當 primary
        await queryRunner.query(`
            INSERT INTO \`account_venues\` (\`accountId\`, \`venueId\`, \`isPrimary\`)
            SELECT a.\`id\`, a.\`entityId\`, 1
            FROM \`accounts\` a
            INNER JOIN \`venues\` v ON v.\`id\` = a.\`entityId\`
            WHERE a.\`role\` = 'venue'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`account_venues\` DROP FOREIGN KEY \`FK_763c88cca7b4cbbe5effd99b1df\``);
        await queryRunner.query(`ALTER TABLE \`account_venues\` DROP FOREIGN KEY \`FK_105cc88d7c6c7dda6ac445ea03a\``);
        await queryRunner.query(`DROP INDEX \`IDX_105cc88d7c6c7dda6ac445ea03\` ON \`account_venues\``);
        await queryRunner.query(`DROP INDEX \`IDX_763c88cca7b4cbbe5effd99b1d\` ON \`account_venues\``);
        await queryRunner.query(`DROP TABLE \`account_venues\``);
    }

}
