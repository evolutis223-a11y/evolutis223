-- Vue de lecture du stock par variante (CAHIER_DES_CHARGES.md §4.3, v2 corrigé 2026-07-27).
-- Chaque ligne de stock_mouvements porte déjà son pool (GROS/DETAIL) — plus de recomposition
-- par filtrage de type, plus de double comptage possible sur les transferts entre pools.
CREATE VIEW "v_stock_variante" AS
SELECT
  v.id AS variante_id,
  v.article_id,
  COALESCE(SUM(CASE WHEN m.pool = 'DETAIL' THEN m.quantite ELSE 0 END), 0) AS reserve_detail,
  COALESCE(SUM(CASE WHEN m.pool = 'DETAIL' THEN m.quantite ELSE 0 END), 0) AS stock_detail,
  COALESCE(SUM(CASE WHEN m.pool = 'GROS'   THEN m.quantite ELSE 0 END), 0) AS stock_gros,
  COALESCE(SUM(m.quantite), 0) AS stock_total
FROM "variantes" v
LEFT JOIN "stock_mouvements" m ON m.variante_id = v.id
GROUP BY v.id, v.article_id;
