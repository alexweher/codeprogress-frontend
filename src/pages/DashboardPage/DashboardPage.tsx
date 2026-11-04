import type { CSSProperties } from 'react';
import { HttpError, NetworkError, ResponseFormatError } from '../../shared/api/apiError';
import { useAuth } from '../../features/auth/model/useAuth';
import type {
  DashboardActivityResponse,
  DashboardSummaryResponse,
} from '../../features/dashboard/api/dashboardApi';
import { getRecentActivityRange } from '../../features/dashboard/lib/activityRange';
import {
  useDashboardActivity,
  useDashboardSummary,
} from '../../features/dashboard/model/dashboardQueries';
import styles from './DashboardPage.module.css';

function formatDate(date: string | null) {
  if (!date) {
    return 'No study sessions yet';
  }

  const [year, month, day] = date.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    return date;
  }

  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

function getErrorMessage(error: unknown) {
  if (error instanceof NetworkError) {
    return 'Dashboard is unavailable because CodeProgress API could not be reached.';
  }

  if (error instanceof ResponseFormatError) {
    return 'CodeProgress returned dashboard data in an unexpected format.';
  }

  if (error instanceof HttpError) {
    return error.apiError?.message ?? 'Dashboard data could not be loaded.';
  }

  return 'Dashboard data could not be loaded.';
}

function isEmptyDashboard(summary: DashboardSummaryResponse, activity: DashboardActivityResponse) {
  return (
    summary.totalTopics === 0 &&
    summary.plannedTasks === 0 &&
    summary.activeTasks === 0 &&
    summary.completedTasks === 0 &&
    summary.totalStudyMinutes === 0 &&
    summary.studyMinutesLast7Days === 0 &&
    summary.studySessionsCount === 0 &&
    summary.completionPercent === 0 &&
    summary.lastStudyDate === null &&
    activity.days.every((day) => day.studyMinutes === 0 && day.studySessionsCount === 0)
  );
}

function DashboardLoading() {
  return (
    <main className={styles.page} aria-busy="true">
      <div className={styles.headingSkeleton} aria-hidden="true" />
      <div className={styles.cardSkeletons} aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
      <p className={styles.loadingText} role="status">
        Loading dashboard…
      </p>
    </main>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const range = getRecentActivityRange();
  const summaryQuery = useDashboardSummary(user?.id ?? 0);
  const activityQuery = useDashboardActivity(user?.id ?? 0, range);

  if (summaryQuery.isPending || activityQuery.isPending) {
    return <DashboardLoading />;
  }

  const error = summaryQuery.error ?? activityQuery.error;
  if (error) {
    return (
      <main className={styles.page}>
        <section className={styles.errorState} role="alert" aria-labelledby="dashboard-error-title">
          <p className={styles.eyebrow}>Dashboard unavailable</p>
          <h1 id="dashboard-error-title">We couldn’t load your progress.</h1>
          <p>{getErrorMessage(error)}</p>
          <button
            type="button"
            onClick={() => {
              void summaryQuery.refetch();
              void activityQuery.refetch();
            }}
          >
            Try again
          </button>
        </section>
      </main>
    );
  }

  const summary = summaryQuery.data;
  const activity = activityQuery.data;

  if (!summary || !activity) {
    return (
      <main className={styles.page}>
        <section className={styles.errorState} role="alert">
          <p className={styles.eyebrow}>Dashboard unavailable</p>
          <h1>We couldn’t load your progress.</h1>
          <p>CodeProgress returned dashboard data in an unexpected format.</p>
          <button
            type="button"
            onClick={() => {
              void summaryQuery.refetch();
              void activityQuery.refetch();
            }}
          >
            Try again
          </button>
        </section>
      </main>
    );
  }

  const metrics = [
    ['Total topics', summary.totalTopics],
    ['Planned tasks', summary.plannedTasks],
    ['Active tasks', summary.activeTasks],
    ['Completed tasks', summary.completedTasks],
    ['Total study minutes', summary.totalStudyMinutes],
    ['Minutes in the last 7 days', summary.studyMinutesLast7Days],
    ['Study sessions', summary.studySessionsCount],
    ['Task completion', `${summary.completionPercent}%`],
    ['Last study date', formatDate(summary.lastStudyDate)],
  ] as const;
  const maxMinutes = Math.max(...activity.days.map((day) => day.studyMinutes), 1);
  const empty = isEmptyDashboard(summary, activity);

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Learning overview</p>
          <h1>Dashboard</h1>
          <p>Track your topics, tasks, and study rhythm from CodeProgress API.</p>
        </div>
        <span className={styles.period}>Last 30 calendar days</span>
      </header>

      {empty ? (
        <section className={styles.emptyState} aria-labelledby="empty-dashboard-title">
          <p className={styles.eyebrow}>Ready when you are</p>
          <h2 id="empty-dashboard-title">Your learning activity will appear here.</h2>
          <p>
            There are no topics, tasks, or study sessions yet. Zero values are valid and your
            dashboard is working normally.
          </p>
        </section>
      ) : null}

      <section aria-labelledby="summary-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Current totals</p>
            <h2 id="summary-title">Progress summary</h2>
          </div>
        </div>
        <dl className={styles.metrics}>
          {metrics.map(([label, value]) => (
            <div className={styles.metricCard} key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={styles.activitySection} aria-labelledby="activity-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Daily activity</p>
            <h2 id="activity-title">Study minutes by day</h2>
          </div>
          <p>
            <time dateTime={activity.from}>{formatDate(activity.from)}</time>
            {' – '}
            <time dateTime={activity.to}>{formatDate(activity.to)}</time>
            <span> · {activity.timeZone}</span>
          </p>
        </div>

        <div className={styles.chartScroller} tabIndex={0} aria-label="Scrollable daily activity">
          <ol className={styles.chart} aria-label="Daily study activity for the last 30 days">
            {activity.days.map((day) => {
              const height = `${Math.round((day.studyMinutes / maxMinutes) * 100)}%`;
              const barStyle = { '--bar-height': height } as CSSProperties;

              return (
                <li
                  key={day.date}
                  aria-label={`${day.date}: ${day.studyMinutes} study minutes, ${day.studySessionsCount} sessions`}
                >
                  <strong>{day.studyMinutes}</strong>
                  <span
                    className={day.studyMinutes === 0 ? styles.zeroBar : styles.bar}
                    style={barStyle}
                    aria-hidden="true"
                  />
                  <time dateTime={day.date}>{day.date.slice(5)}</time>
                  <small>{day.studySessionsCount} sessions</small>
                </li>
              );
            })}
          </ol>
        </div>
        <p className={styles.chartNote}>Each column shows minutes and session count for one day.</p>
      </section>
    </main>
  );
}
