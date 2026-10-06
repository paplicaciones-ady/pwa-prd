import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Estados del crédito alineados con el flujo de estudio:
 *
 *   draft ──(algoritmo)──► pre_approved ──(paso 3)──► pending_signatures ──(confirmación)──► signed
 *     │                         │                             │
 *     └──► rejected             └──────────► cancelled ◄──────┘   (draft también puede cancelarse)
 *
 *   draft              borrador: solicitud enviada, el algoritmo (Saman) la está evaluando.
 *   pre_approved       pre-aprobado por el algoritmo.
 *   rejected           rechazado por el algoritmo.
 *   cancelled          cancelado por el asesor.
 *   pending_signatures los documentos se enviaron a firmar al servicio externo.
 *   signed             firmado/validado: llegó la confirmación de las firmas.
 *
 * Postgres no permite quitar valores de un enum, así que se crea el tipo nuevo,
 * se convierte la columna con un mapeo explícito y se reemplaza el anterior:
 *
 *   pending, in_study → draft        (solicitudes sin decisión)
 *   approved          → pre_approved
 *   rejected          → rejected
 *   signed, disbursed → signed       (el desembolso deja de ser un estado)
 */
export class CreditStatusFlow1700000022000 implements MigrationInterface {
  name = 'CreditStatusFlow1700000022000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."credits_status_enum_new" AS ENUM('draft', 'pre_approved', 'rejected', 'cancelled', 'pending_signatures', 'signed')`,
    );
    await queryRunner.query(`ALTER TABLE "credits" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(`
      ALTER TABLE "credits" ALTER COLUMN "status" TYPE "public"."credits_status_enum_new" USING (
        CASE "status"::text
          WHEN 'pending' THEN 'draft'
          WHEN 'in_study' THEN 'draft'
          WHEN 'approved' THEN 'pre_approved'
          WHEN 'rejected' THEN 'rejected'
          WHEN 'signed' THEN 'signed'
          WHEN 'disbursed' THEN 'signed'
        END
      )::"public"."credits_status_enum_new"
    `);
    await queryRunner.query(`DROP TYPE "public"."credits_status_enum"`);
    await queryRunner.query(`ALTER TYPE "public"."credits_status_enum_new" RENAME TO "credits_status_enum"`);
    await queryRunner.query(`ALTER TABLE "credits" ALTER COLUMN "status" SET DEFAULT 'draft'`);

    // El sondeo en segundo plano busca borradores pendientes de resolver.
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_credits_status" ON "credits" ("status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_credits_status"`);
    await queryRunner.query(
      `CREATE TYPE "public"."credits_status_enum_old" AS ENUM('pending', 'in_study', 'approved', 'rejected', 'signed', 'disbursed')`,
    );
    await queryRunner.query(`ALTER TABLE "credits" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(`
      ALTER TABLE "credits" ALTER COLUMN "status" TYPE "public"."credits_status_enum_old" USING (
        CASE "status"::text
          WHEN 'draft' THEN 'in_study'
          WHEN 'pre_approved' THEN 'approved'
          WHEN 'rejected' THEN 'rejected'
          WHEN 'cancelled' THEN 'rejected'
          WHEN 'pending_signatures' THEN 'approved'
          WHEN 'signed' THEN 'signed'
        END
      )::"public"."credits_status_enum_old"
    `);
    await queryRunner.query(`DROP TYPE "public"."credits_status_enum"`);
    await queryRunner.query(`ALTER TYPE "public"."credits_status_enum_old" RENAME TO "credits_status_enum"`);
    await queryRunner.query(`ALTER TABLE "credits" ALTER COLUMN "status" SET DEFAULT 'pending'`);
  }
}
