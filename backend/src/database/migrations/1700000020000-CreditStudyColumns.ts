import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reconciliación del esquema de `credits` tras integrar dos versiones de
 * `1700000017000-CreditStudyQuestions` que compartían nombre de clase:
 *
 *  - la de ensayos (63f3345) crea `study_answers` (jsonb), `decision_at`,
 *    `decision_run_id` y `vendor_id`;
 *  - la local creaba las preguntas de evaluación comercial como columnas
 *    tipadas (`person_type`, `years_experience`, `opportunity_value`,
 *    `reliability_score`).
 *
 * Cada BD puede tener registrada cualquiera de las dos bajo el mismo nombre, y
 * TypeORM no volverá a ejecutar la otra. Esta migración es idempotente y deja
 * cualquier BD con el esquema completo: crea lo que falte y traslada a las
 * columnas las respuestas que se hayan guardado solo en `study_answers`.
 *
 * Las preguntas viven en columnas (no en jsonb) para poder consultarlas,
 * indexarlas y validarlas con CHECK. `study_answers` se conserva solo para
 * leer los créditos creados mientras estuvo vigente.
 *
 * `opportunity_value` es bigint: monto entero en pesos. La entidad lo convierte
 * a number con un transformer porque el driver `pg` devuelve bigint como string.
 */
export class CreditStudyColumns1700000020000 implements MigrationInterface {
  name = 'CreditStudyColumns1700000020000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Columnas de la versión de ensayos (ya existen si corrió su 17000).
    await queryRunner.query(`ALTER TABLE "credits" ADD COLUMN IF NOT EXISTS "study_answers" jsonb`);
    await queryRunner.query(`ALTER TABLE "credits" ADD COLUMN IF NOT EXISTS "decision_at" timestamp`);
    await queryRunner.query(`ALTER TABLE "credits" ADD COLUMN IF NOT EXISTS "decision_run_id" character varying(100)`);
    await queryRunner.query(`ALTER TABLE "credits" ADD COLUMN IF NOT EXISTS "vendor_id" uuid`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_credits_decision_run_id" ON "credits" ("decision_run_id")`,
    );

    // Columnas de la versión local (ya existen si corrió su 17000). El tipo de
    // persona tiene su propio enum para no acoplar credits a clients.
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."credits_person_type_enum" AS ENUM('natural', 'juridica');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(
      `ALTER TABLE "credits" ADD COLUMN IF NOT EXISTS "person_type" "public"."credits_person_type_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "credits" ADD COLUMN IF NOT EXISTS "years_experience" integer`);
    await queryRunner.query(`ALTER TABLE "credits" ADD COLUMN IF NOT EXISTS "opportunity_value" bigint`);
    await queryRunner.query(`ALTER TABLE "credits" ADD COLUMN IF NOT EXISTS "reliability_score" integer`);

    // Respuestas guardadas solo en el jsonb (créditos creados con la versión de
    // ensayos). Solo se completa lo que esté vacío.
    await queryRunner.query(`
      UPDATE "credits" SET
        "person_type" = COALESCE("person_type", ("study_answers"->>'personType')::"public"."credits_person_type_enum"),
        "years_experience" = COALESCE("years_experience", ("study_answers"->>'yearsExperience')::numeric::integer),
        "opportunity_value" = COALESCE("opportunity_value", ("study_answers"->>'opportunityValue')::numeric::bigint),
        "reliability_score" = COALESCE("reliability_score", ("study_answers"->>'reliabilityScore')::numeric::integer)
      WHERE "study_answers" IS NOT NULL
    `);

    // Postgres no tiene ADD CONSTRAINT IF NOT EXISTS: se recrean.
    await queryRunner.query(`ALTER TABLE "credits" DROP CONSTRAINT IF EXISTS "CHK_credits_years_experience"`);
    await queryRunner.query(`ALTER TABLE "credits" DROP CONSTRAINT IF EXISTS "CHK_credits_opportunity_value"`);
    await queryRunner.query(`ALTER TABLE "credits" DROP CONSTRAINT IF EXISTS "CHK_credits_reliability_score"`);
    await queryRunner.query(
      `ALTER TABLE "credits" ADD CONSTRAINT "CHK_credits_years_experience" CHECK ("years_experience" IS NULL OR "years_experience" >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "credits" ADD CONSTRAINT "CHK_credits_opportunity_value" CHECK ("opportunity_value" IS NULL OR "opportunity_value" >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "credits" ADD CONSTRAINT "CHK_credits_reliability_score" CHECK ("reliability_score" IS NULL OR "reliability_score" BETWEEN 1 AND 5)`,
    );
  }

  public async down(): Promise<void> {
    // Sin reversa a propósito: esta migración no sabe cuáles de estas columnas
    // creó ella y cuáles venían de una de las dos 17000. Borrarlas aquí
    // destruiría datos que el `down` de la 17000 correspondiente sí gestiona.
  }
}
