import styles from './GullyWidgetSkeleton.module.css';

/** Placeholder blocks while widgets or the user's websites load, instead of a blank page. */
export function GullyWidgetSkeleton({ rows = 2, inline = false }: { rows?: number; inline?: boolean }) {
  if (inline) {
    return <div className={styles.block} data-test="gully-skeleton" aria-busy="true" aria-label="Loading" />;
  }

  return (
    <div className={styles.grid} data-test="gully-skeleton" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={styles.row}>
          <div className={styles.block} />
          <div className={styles.block} />
        </div>
      ))}
    </div>
  );
}
