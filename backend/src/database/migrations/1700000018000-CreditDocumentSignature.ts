import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreditDocumentSignature1700000018000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // La firma de autorización se guarda como documento del crédito, no como
    // archivo en disco: el contenedor de producción no declara volumen para
    // uploads/, así que un PNG en el filesystem se perdería en cada redeploy.
    await queryRunner.query(`ALTER TABLE "credit_documents" ADD "content_base64" text;`);
    await queryRunner.query(`ALTER TABLE "credit_documents" ADD "content_mime" character varying(50);`);

    // Hash de los bytes decodificados: permite demostrar después que la imagen
    // no fue alterada, que es lo que hace falta para sostener el consent.
    await queryRunner.query(`ALTER TABLE "credit_documents" ADD "content_sha256" character varying(64);`);

    // Contexto de la solicitud, calculado en el servidor: el cliente no envía
    // ni la IP ni el user agent.
    await queryRunner.query(`ALTER TABLE "credit_documents" ADD "ip" character varying(45);`);
    await queryRunner.query(`ALTER TABLE "credit_documents" ADD "user_agent" text;`);

    await queryRunner.query(
      `CREATE INDEX "IDX_credit_documents_code" ON "credit_documents" ("credit_id", "code");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_credit_documents_code";`);
    await queryRunner.query(`ALTER TABLE "credit_documents" DROP COLUMN "user_agent";`);
    await queryRunner.query(`ALTER TABLE "credit_documents" DROP COLUMN "ip";`);
    await queryRunner.query(`ALTER TABLE "credit_documents" DROP COLUMN "content_sha256";`);
    await queryRunner.query(`ALTER TABLE "credit_documents" DROP COLUMN "content_mime";`);
    await queryRunner.query(`ALTER TABLE "credit_documents" DROP COLUMN "content_base64";`);
  }
}
