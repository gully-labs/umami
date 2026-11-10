-- Gully Analytics: repair personal dashboards whose widgets point at items the owner can no longer
-- read (a deleted website, pixel or link, or a website transferred to another account). Data only,
-- no schema change. Each widget is bound to the user's own first website, or cleared when the user
-- has none. The original rows are kept in parameters.gullyRepair.previousRows, so nothing is lost.
-- Admin users can read every item and are skipped.

WITH readable AS (
  SELECT b.board_id,
         b.user_id,
         (SELECT w.website_id::text FROM website w
           WHERE w.user_id = b.user_id AND w.deleted_at IS NULL
           ORDER BY w.created_at ASC LIMIT 1) AS fallback
    FROM board b
    JOIN "user" u ON u.user_id = b.user_id
   WHERE b.type = 'dashboard'
     AND u.role <> 'admin'
     AND jsonb_typeof(b.parameters -> 'rows') = 'array'
),
cols AS (
  SELECT r.board_id,
         r.fallback,
         rr.row_obj,
         rr.row_ord,
         cc.col_obj,
         cc.col_ord,
         COALESCE(cc.col_obj -> 'component' ->> 'entityType',
                  CASE WHEN cc.col_obj -> 'component' ? 'websiteId' THEN 'website' END) AS etype,
         COALESCE(cc.col_obj -> 'component' ->> 'entityId',
                  cc.col_obj -> 'component' ->> 'websiteId') AS eid,
         r.user_id
    FROM readable r
    JOIN board b ON b.board_id = r.board_id
    CROSS JOIN LATERAL jsonb_array_elements(b.parameters -> 'rows') WITH ORDINALITY AS rr(row_obj, row_ord)
    LEFT JOIN LATERAL jsonb_array_elements(COALESCE(rr.row_obj -> 'columns', '[]'::jsonb)) WITH ORDINALITY AS cc(col_obj, col_ord) ON true
),
judged AS (
  SELECT c.*,
         CASE
           WHEN c.eid IS NULL OR jsonb_typeof(c.col_obj -> 'component') <> 'object' THEN true
           WHEN c.eid !~ '^[0-9a-fA-F-]{36}$' THEN false
           WHEN c.etype = 'website' THEN EXISTS (
             SELECT 1 FROM website w
              WHERE w.website_id = c.eid::uuid AND w.deleted_at IS NULL
                AND (w.user_id = c.user_id OR w.team_id IN (
                      SELECT tu.team_id FROM team_user tu JOIN team t ON t.team_id = tu.team_id
                       WHERE tu.user_id = c.user_id AND t.deleted_at IS NULL)))
           WHEN c.etype = 'pixel' THEN EXISTS (
             SELECT 1 FROM pixel p
              WHERE p.pixel_id = c.eid::uuid AND p.deleted_at IS NULL
                AND (p.user_id = c.user_id OR p.team_id IN (
                      SELECT tu.team_id FROM team_user tu WHERE tu.user_id = c.user_id)))
           WHEN c.etype = 'link' THEN EXISTS (
             SELECT 1 FROM link l
              WHERE l.link_id = c.eid::uuid AND l.deleted_at IS NULL
                AND (l.user_id = c.user_id OR l.team_id IN (
                      SELECT tu.team_id FROM team_user tu WHERE tu.user_id = c.user_id)))
           ELSE true
         END AS ok
    FROM cols c
),
fixed AS (
  SELECT j.board_id,
         j.row_obj,
         j.row_ord,
         j.col_ord,
         j.ok,
         CASE
           WHEN j.ok THEN j.col_obj
           WHEN j.etype = 'website' AND j.fallback IS NOT NULL THEN
             jsonb_set(j.col_obj, '{component}',
               ((j.col_obj -> 'component') - 'websiteId' - 'props')
               || jsonb_build_object('entityType', 'website', 'entityId', j.fallback)
               || CASE WHEN ((j.col_obj -> 'component' -> 'props') - 'reportId') IS NOT NULL
                        AND ((j.col_obj -> 'component' -> 'props') - 'reportId') <> '{}'::jsonb
                       THEN jsonb_build_object('props', (j.col_obj -> 'component' -> 'props') - 'reportId')
                       ELSE '{}'::jsonb END)
           ELSE jsonb_set(j.col_obj, '{component}', 'null'::jsonb)
         END AS col_new
    FROM judged j
),
new_rows AS (
  SELECT board_id,
         row_ord,
         jsonb_set(row_obj, '{columns}', COALESCE(jsonb_agg(col_new ORDER BY col_ord) FILTER (WHERE col_new IS NOT NULL), '[]'::jsonb)) AS row_new,
         bool_and(ok) AS row_ok
    FROM fixed
   GROUP BY board_id, row_ord, row_obj
),
new_boards AS (
  SELECT board_id,
         jsonb_agg(row_new ORDER BY row_ord) AS rows_new
    FROM new_rows
   GROUP BY board_id
  HAVING NOT bool_and(row_ok)
)
UPDATE board b
   SET parameters = jsonb_set(b.parameters, '{rows}', nb.rows_new)
                    || jsonb_build_object('gullyRepair',
                         jsonb_build_object('at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                                            'previousRows', b.parameters -> 'rows')),
       updated_at = now()
  FROM new_boards nb
 WHERE b.board_id = nb.board_id;
