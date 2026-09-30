import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreditStudyQuestions1700000017000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Las respuestas de la evaluación comercial viven en un único jsonb: agregar
    // una pregunta nueva al cuestionario NO debe requerir otra ALTER TABLE.
    await queryRunner.query(`ALTER TABLE "credits" ADD "study_answers" jsonb;`);

    await queryRunner.query(`ALTER TABLE "credits" ADD "decision_at" timestamp;`);

    // Identificador de la corrida del algoritmo que emitió el veredicto. Sin
    // FK a propósito: la entidad que lo produce (el scoring externo) está fuera
    // de este alcance, así que la columna queda declarada pero sin referencia.
    await queryRunner.query(`ALTER TABLE "credits" ADD "decision_run_id" character varying(100);`);

    // Proveedor del algoritmo que generó la decisión (semántica idéntica a la
    // que tenía decision_source, pero con clave foránea en lugar de un
    // literal 'asesor'/'algoritmo'). Sin FK por la misma razón que arriba.
    await queryRunner.query(`ALTER TABLE "credits" ADD "vendor_id" uuid;`);

    await queryRunner.query(
      `CREATE INDEX "IDX_credits_decision_run_id" ON "credits" ("decision_run_id");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_credits_decision_run_id";`);
    await queryRunner.query(`ALTER TABLE "credits" DROP COLUMN "vendor_id";`);
    await queryRunner.query(`ALTER TABLE "credits" DROP COLUMN "decision_run_id";`);
    await queryRunner.query(`ALTER TABLE "credits" DROP COLUMN "decision_at";`);
    await queryRunner.query(`ALTER TABLE "credits" DROP COLUMN "study_answers";`);
  }
}
