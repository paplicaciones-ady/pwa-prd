import { MigrationInterface, QueryRunner } from 'typeorm';

const CREDITS_KEY = 'creditos';
const CREDITS_OWNER = '22222222-2222-2222-8222-222222222222'; // Adylog
/** Empresas en las que créditos queda habilitado además de la dueña. */
const CREDITS_ENABLED_IN = [
  '11111111-1111-1111-8111-111111111111', // Herragro
  '33333333-3333-3333-8333-333333333333', // Toptec
];

/**
 * Créditos pasa a tener una única empresa dueña (Adylog) y se habilita en
 * Herragro y Toptec mediante asignaciones.
 *
 * El backfill de 1700000012000-ModuleSystem creaba una copia del módulo por
 * empresa (ya corregido allí para BD nuevas). En las BD que ya lo ejecutaron
 * hay tres módulos `creditos`, cada uno con su empresa como dueña; por eso el
 * tema y la administración del módulo eran siempre los de la empresa actual.
 *
 * Por cada copia que no es de Adylog: su asignación (ubicación, posición,
 * habilitado) y su variante pasan al módulo de Adylog, y la copia se borra.
 * Es idempotente: en una BD nueva, o si se repite, no encuentra copias.
 */
export class CreditsSingleOwner1700000021000 implements MigrationInterface {
  name = 'CreditsSingleOwner1700000021000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [owner] = await queryRunner.query(
      `SELECT id FROM modules WHERE key = $1 AND company_id = $2 ORDER BY created_at LIMIT 1`,
      [CREDITS_KEY, CREDITS_OWNER],
    );
    // Sin el módulo de Adylog (BD sin el seed de empresas) no hay nada que consolidar.
    if (!owner) return;

    // 1. Asignaciones de las copias → módulo de la dueña, conservando la
    //    ubicación que cada empresa tenía.
    await queryRunner.query(
      `INSERT INTO module_assignments (module_id, company_id, placement, position, enabled)
       SELECT $1, a.company_id, a.placement, a.position, a.enabled
       FROM module_assignments a
       JOIN modules m ON m.id = a.module_id
       WHERE m.key = $2 AND m.id <> $1
       ON CONFLICT (module_id, company_id) DO NOTHING`,
      [owner.id, CREDITS_KEY],
    );

    // 2. Variantes de las copias → módulo de la dueña (si la empresa no tenía ya una).
    await queryRunner.query(
      `UPDATE module_variants v SET module_id = $1
       FROM modules m
       WHERE m.id = v.module_id AND m.key = $2 AND m.id <> $1
         AND NOT EXISTS (
           SELECT 1 FROM module_variants o WHERE o.module_id = $1 AND o.company_id = v.company_id
         )`,
      [owner.id, CREDITS_KEY],
    );

    // 3. Borrar las copias (lo que quede de sus asignaciones/variantes cae por CASCADE).
    await queryRunner.query(`DELETE FROM modules WHERE key = $1 AND id <> $2`, [CREDITS_KEY, owner.id]);

    // 4. Asignación de la dueña y habilitación en Herragro y Toptec. Si ya
    //    existían se respeta su ubicación y solo se asegura que estén habilitadas.
    for (const companyId of [CREDITS_OWNER, ...CREDITS_ENABLED_IN]) {
      await queryRunner.query(
        `INSERT INTO module_assignments (module_id, company_id, placement, position, enabled)
         SELECT $1, c.id, 'grid', 3, true FROM companies c WHERE c.id = $2
         ON CONFLICT (module_id, company_id) DO UPDATE SET enabled = true, updated_at = now()`,
        [owner.id, companyId],
      );
    }
  }

  public async down(): Promise<void> {
    // Sin reversa: volver a partir el módulo en copias por empresa reintroduciría
    // el problema que esta migración corrige.
  }
}
