import { Box, Row } from '@umami/react-zen';
import type { BoardColumn } from '@/lib/types';
import { BoardViewColumn } from './BoardViewColumn';
import styles from './BoardViewRow.module.css';
import { MIN_COLUMN_WIDTH } from './boardConstants';

export function BoardViewRow({
  columns,
  showEntityBadges = true,
}: {
  columns: BoardColumn[];
  showEntityBadges?: boolean;
}) {
  return (
    // Gully: the row stacks its widgets on phones (BoardViewRow.module.css) instead of scrolling.
    <Row gap="3" width="100%" overflowX="auto" className={styles.row}>
      {columns.map(column => (
        <Box
          key={column.id}
          flexGrow={column.size ?? 1}
          flexShrink={1}
          flexBasis="0%"
          minWidth={`${MIN_COLUMN_WIDTH}px`}
        >
          <BoardViewColumn component={column.component} showEntityBadge={showEntityBadges} />
        </Box>
      ))}
    </Row>
  );
}
