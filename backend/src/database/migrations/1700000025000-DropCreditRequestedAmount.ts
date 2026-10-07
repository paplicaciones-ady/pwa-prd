import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `credits.requested_amount` no aplica en el flujo de estudio: nadie pide un
 * monto; el estudio guardaba ahí una copia de `opportunity_value` y la lista
 * lo mostraba como "monto solicitado". El cupo es `approved_limit`.
 *
 * `0000000000001-CreateTables` ya no crea la columna (BD nuevas); esta
 * migración la quita de las BD existentes, de ahí el IF EXISTS.
 */
export class DropCreditRequestedAmount1700000025000 implements MigrationInterface {
  name = 'DropCreditRequestedAmount1700000025000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "credits" DROP COLUMN IF EXISTS "requested_amount"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Los valores eliminados no se recuperan: se repone la columna con la
    // oportunidad (lo que guardaba el flujo de estudio) o 0.
    await queryRunner.query(`ALTER TABLE "credits" ADD COLUMN IF NOT EXISTS "requested_amount" numeric(12,2)`);
    await queryRunner.query(`UPDATE "credits" SET "requested_amount" = COALESCE("opportunity_value", 0)`);
    await queryRunner.query(`ALTER TABLE "credits" ALTER COLUMN "requested_amount" SET NOT NULL`);
  }
}
