import styles from './HomePage.module.css';

const foundations = [
  'React and TypeScript',
  'Routing and server-state providers',
  'Accessible, responsive styling',
  'Automated quality checks',
];

export function HomePage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="page-title">
        <div className={styles.brand} aria-label="CodeProgress">
          <span className={styles.brandMark} aria-hidden="true">
            CP
          </span>
          <span>CodeProgress</span>
        </div>

        <div className={styles.content}>
          <p className={styles.eyebrow}>Frontend foundation</p>
          <h1 id="page-title">Build your learning momentum.</h1>
          <p className={styles.lead}>
            A focused workspace for turning programming topics into steady, visible progress.
          </p>

          <ul className={styles.foundationList} aria-label="Configured foundations">
            {foundations.map((foundation) => (
              <li key={foundation}>{foundation}</li>
            ))}
          </ul>

          <p className={styles.status} role="status">
            <span aria-hidden="true" />
            Bootstrap complete. Product features are next.
          </p>
        </div>
      </section>

      <aside className={styles.preview} aria-label="Product preview">
        <div className={styles.previewHeader}>
          <span>Today</span>
          <span className={styles.previewDate}>Learning overview</span>
        </div>
        <div className={styles.metric}>
          <span>Study rhythm</span>
          <strong>Ready</strong>
        </div>
        <div className={styles.progressTrack} aria-hidden="true">
          <span />
        </div>
        <div className={styles.previewCards}>
          <div>
            <span>Topics</span>
            <strong>—</strong>
          </div>
          <div>
            <span>Focus time</span>
            <strong>—</strong>
          </div>
        </div>
        <p>Real learning data will appear here after authentication is implemented.</p>
      </aside>
    </main>
  );
}
