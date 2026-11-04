import styles from './AppPage.module.css';

export function AppOverview() {
  return (
    <main className={styles.main}>
      <p className={styles.eyebrow}>Protected workspace</p>
      <h1>You’re signed in.</h1>
      <p>
        Your identity was verified by CodeProgress API. Open Dashboard to see your learning summary
        and daily study activity.
      </p>
      <div className={styles.readyCard}>
        <span aria-hidden="true" />
        <div>
          <strong>Authentication is ready</strong>
          <p>JWT is held in memory and is never written to browser storage.</p>
        </div>
      </div>
    </main>
  );
}
