import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seguimiento del estudio en Saman (ver credits/saman):
 *
 *   algorithm_result      resumen del veredicto (score, cupo, motivo, datos de la
 *                         persona jurídica/natural) o el error. Sin credit_data,
 *                         personal_data ni scores: son datos sensibles que no se usan.
 *   algorithm_attempts    consultas hechas; espacia los reintentos del sondeo.
 *   algorithm_checked_at  última consulta a Saman.
 *
 * Además `credits.nit` pasa a guardarse sin guion (solo dígitos, con el DV).
 */
export class CreditAlgorithmResult1700000023000 implements MigrationInterface {
  name = 'CreditAlgorithmResult1700000023000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "credits" ADD COLUMN IF NOT EXISTS "algorithm_result" jsonb`);
    await queryRunner.query(
      `ALTER TABLE "credits" ADD COLUMN IF NOT EXISTS "algorithm_attempts" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(`ALTER TABLE "credits" ADD COLUMN IF NOT EXISTS "algorithm_checked_at" timestamptz`);
    await queryRunner.query(`UPDATE "credits" SET "nit" = replace("nit", '-', '') WHERE "nit" LIKE '%-%'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // El guion quitado de credits.nit no se restaura: el formato sin guion es válido en ambas versiones.
    await queryRunner.query(`ALTER TABLE "credits" DROP COLUMN IF EXISTS "algorithm_checked_at"`);
    await queryRunner.query(`ALTER TABLE "credits" DROP COLUMN IF EXISTS "algorithm_attempts"`);
    await queryRunner.query(`ALTER TABLE "credits" DROP COLUMN IF EXISTS "algorithm_result"`);
  }
}
