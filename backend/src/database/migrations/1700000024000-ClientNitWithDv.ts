import { MigrationInterface, QueryRunner } from 'typeorm';
import { calcNitDv, isValidFullNit } from '../../commons/utils/nit';

/**
 * Un NIT se digita y se guarda completo, con DV y sin '-' (9014902765). Los
 * clientes con documento NIT guardados solo con el cuerpo (como los del padrón
 * de 1700000019000-SharedClientPool: 901490276 + dv 5) pasan a guardar el
 * número completo. La columna `dv` queda con el último dígito.
 *
 * Un número ya está completo si su último dígito es el DV del resto (y coincide
 * con `dv`, si lo hay); si no, se le agrega el DV calculado.
 *
 * RLS: `clients` tiene FORCE ROW LEVEL SECURITY (1700000014500), que también
 * aplica al owner con el que corren las migraciones. Igual que en
 * 1700000019000, se recorre cada empresa con su GUC de tenant (los clientes
 * del padrón, company_id NULL, son visibles con cualquiera) y se limpia al final.
 */
export class ClientNitWithDv1700000024000 implements MigrationInterface {
  name = 'ClientNitWithDv1700000024000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const companies: { id: string }[] = await queryRunner.query(`SELECT id FROM companies`);
    const done = new Set<string>();
    try {
      for (const { id: companyId } of companies) {
        await queryRunner.query(`SELECT set_config('app.current_company_id', $1, false)`, [companyId]);
        const rows: { id: string; document_number: string; dv: string | null }[] = await queryRunner.query(
          `SELECT id, document_number, dv FROM clients WHERE document_type = 'nit' AND deleted_at IS NULL`,
        );
        for (const row of rows) {
          if (done.has(row.id)) continue;
          done.add(row.id);
          const doc = row.document_number;
          if (!/^\d+$/.test(doc)) continue;
          // Ya completo: su último dígito es su DV (y coincide con `dv`, si lo hay).
          const alreadyFull = isValidFullNit(doc) && (row.dv == null || row.dv === doc.slice(-1));
          const full = alreadyFull ? doc : doc + calcNitDv(doc);
          if (full === doc && row.dv === doc.slice(-1)) continue;
          await queryRunner.query(`UPDATE clients SET document_number = $1, dv = $2 WHERE id = $3`, [
            full,
            full.slice(-1),
            row.id,
          ]);
        }
      }
    } finally {
      await queryRunner.query(`RESET app.current_company_id`);
    }
  }

  public async down(): Promise<void> {
    // Sin reversa: quitar el último dígito no distingue los NIT que ya venían completos.
  }
}
