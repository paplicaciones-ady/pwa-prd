import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Datos de contacto confirmados en el paso 3 (firma): correo, teléfono y
 * dirección a los que el servicio de firma envía los documentos.
 *
 * Se guardan en el crédito y no en el cliente: el cliente puede ser global y
 * compartido entre empresas, y la firma debe quedar con el contacto que se
 * usó en ese momento aunque el cliente cambie después.
 */
export class CreditSigningContact1700000026000 implements MigrationInterface {
  name = 'CreditSigningContact1700000026000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "credits" ADD COLUMN IF NOT EXISTS "signing_contact" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "credits" DROP COLUMN IF EXISTS "signing_contact"`);
  }
}
