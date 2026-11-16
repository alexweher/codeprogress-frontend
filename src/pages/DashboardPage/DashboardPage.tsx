import type { CSSProperties } from 'react';
import { HttpError, NetworkError, ResponseFormatError } from '../../shared/api/apiError';
import { useAuth } from '../../features/auth/model/useAuth';
import { getRecentActivityRange } from '../../features/dashboard/lib/activityRange';
import { useDashboardLearningFocus } from '../../features/dashboard/model/dashboardLearningFocus';
import {
  useDashboardActivity,
  useDashboardSummary,
} from '../../features/dashboard/model/dashboardQueries';
import { useI18n } from '../../shared/i18n/useI18n';
import type { I18nContextValue } from '../../shared/i18n/I18nContext';
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  Progress,
  Skeleton,
} from '../../shared/ui/UiPrimitives';
import styles from './DashboardPage.module.css';

function getErrorMessage(error: unknown, t: I18nContextValue['t']) {
  if (error instanceof NetworkError) return t('dashboard.networkError');
  if (error instanceof ResponseFormatError) return t('dashboard.responseError');
  if (error instanceof HttpError) return error.apiError?.message ?? t('dashboard.loadError');
  return t('dashboard.loadError');
}

function DashboardLoading() {
  const { t } = useI18n();
  return (
    <main className={styles.page} aria-busy="true">
      <Skeleton className={styles.heroSkeleton} />
      <div className={styles.loadingGrid}>
        <Skeleton />
        <Skeleton />
      </div>
      <p className={styles.loadingText} role="status">
        {t('dashboard.loading')}
      </p>
    </main>
  );
}

function statusKey(status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED') {
  return status === 'IN_PROGRESS'
    ? 'enum.inProgress'
    : status === 'COMPLETED'
      ? 'enum.completed'
      : 'enum.planned';
}

export function DashboardPage() {
  const { locale, t } = useI18n();
  const { user } = useAuth();
  const userId = user?.id ?? 0;
  const range = getRecentActivityRange();
  const summaryQuery = useDashboardSummary(userId);
  const activityQuery = useDashboardActivity(userId, range);
  const focus = useDashboardLearningFocus(userId);

  if (summaryQuery.isPending || activityQuery.isPending || focus.isPending)
    return <DashboardLoading />;
  const error = summaryQuery.error ?? activityQuery.error ?? focus.error;
  if (error)
    return (
      <main className={styles.page}>
        <section className={styles.errorState} role="alert">
          <p className={styles.eyebrow}>{t('dashboard.unavailable')}</p>
          <h1>{t('dashboard.loadTitle')}</h1>
          <p>{getErrorMessage(error, t)}</p>
          <button
            type="button"
            onClick={() => {
              void summaryQuery.refetch();
              void activityQuery.refetch();
              void focus.refetch();
            }}
          >
            {t('common.tryAgain')}
          </button>
        </section>
      </main>
    );

  const summary = summaryQuery.data;
  const activity = activityQuery.data;
  if (!summary || !activity)
    return (
      <main className={styles.page}>
        <section className={styles.errorState} role="alert">
          <h1>{t('dashboard.loadTitle')}</h1>
          <p>{t('dashboard.responseError')}</p>
        </section>
      </main>
    );

  const totalTasks = summary.plannedTasks + summary.activeTasks + summary.completedTasks;
  const recentDays = activity.days.slice(-7);
  const maxMinutes = Math.max(...recentDays.map((day) => day.studyMinutes), 1);
  const nextTask = focus.nextTask;
  const hasTopics = focus.topics.length > 0;
  const hasTasks = focus.tasks.length > 0;
  const actionTo = nextTask
    ? `/app/tasks/${nextTask.id}`
    : focus.focusTopic
      ? `/app/topics/${focus.focusTopic.id}`
      : '/app/topics';
  const actionLabel = nextTask
    ? nextTask.status === 'IN_PROGRESS'
      ? t('dashboard.continueTask')
      : t('dashboard.startNextTask')
    : hasTasks
      ? t('dashboard.addNextTask')
      : hasTopics
        ? t('dashboard.addFirstTask')
        : t('dashboard.createFirstTopic');

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>{t('dashboard.eyebrow')}</p>
          <h1>{t('dashboard.heroTitle')}</h1>
          <p>{t('dashboard.heroText')}</p>
        </div>
        <div className={styles.heroMark} aria-hidden="true">
          <span>&lt;/&gt;</span>
        </div>
      </header>

      {!hasTopics ? (
        <EmptyState
          icon="+"
          title={t('dashboard.emptyTitle')}
          description={t('dashboard.emptyText')}
          action={<ButtonLink to="/app/topics">{t('dashboard.createFirstTopic')}</ButtonLink>}
        />
      ) : null}

      {hasTopics ? (
        <section className={styles.focusGrid} aria-label={t('dashboard.learningFocus')}>
          <Card className={styles.questCard} id="next-step">
            <div className={styles.cardHeading}>
              <div>
                <p className={styles.eyebrow}>{t('dashboard.nextStepEyebrow')}</p>
                <h2>
                  {nextTask?.title ??
                    (hasTasks ? t('dashboard.allDoneTitle') : t('dashboard.noTasksTitle'))}
                </h2>
              </div>
              <Badge tone={nextTask?.status === 'IN_PROGRESS' ? 'success' : 'primary'}>
                {nextTask
                  ? t(statusKey(nextTask.status))
                  : hasTasks
                    ? t('dashboard.allDoneBadge')
                    : t('dashboard.getStarted')}
              </Badge>
            </div>
            <p className={styles.questTopic}>
              {nextTask
                ? nextTask.topic.title
                : (focus.focusTopic?.title ?? t('dashboard.noTopic'))}
            </p>
            <p className={styles.questDescription}>
              {nextTask?.description ??
                (hasTasks
                  ? t('dashboard.allDoneText')
                  : hasTopics
                    ? t('dashboard.noTasksText')
                    : t('dashboard.emptyText'))}
            </p>
            <ButtonLink to={actionTo}>
              {actionLabel}
              <span aria-hidden="true">→</span>
            </ButtonLink>
          </Card>

          <Card className={styles.pathCard}>
            <div className={styles.cardHeading}>
              <div>
                <p className={styles.eyebrow}>{t('dashboard.learningPath')}</p>
                <h2>{focus.focusTopic?.title ?? t('dashboard.yourPath')}</h2>
              </div>
            </div>
            {focus.pathTasks.length ? (
              <ol className={styles.pathList}>
                {focus.pathTasks.map((task) => (
                  <li
                    key={task.id}
                    className={task.id === nextTask?.id ? styles.currentPathItem : undefined}
                  >
                    <span className={styles.pathNode} aria-hidden="true">
                      {task.status === 'COMPLETED' ? '✓' : '•'}
                    </span>
                    <div>
                      <strong>{task.title}</strong>
                      <small>{t(statusKey(task.status))}</small>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.pathEmpty}>
                {hasTopics ? t('dashboard.pathEmpty') : t('dashboard.pathStartsWithTopic')}
              </p>
            )}
          </Card>
        </section>
      ) : null}

      <section className={styles.metrics} aria-label={t('dashboard.summary')}>
        <Card className={styles.metric}>
          <span className={styles.metricIcon}>✓</span>
          <div>
            <strong>
              {summary.completedTasks} / {totalTasks}
            </strong>
            <span>{t('dashboard.completedTasks')}</span>
          </div>
          <Progress
            value={summary.completionPercent}
            label={t('dashboard.progressAria', { percent: summary.completionPercent })}
          />
        </Card>
        <Card className={styles.metric}>
          <span className={styles.metricIcon}>◷</span>
          <div>
            <strong>
              {new Intl.NumberFormat(locale === 'ru' ? 'ru-RU' : 'en-US').format(
                summary.totalStudyMinutes,
              )}
            </strong>
            <span>{t('dashboard.totalMinutes')}</span>
          </div>
        </Card>
        <Card className={styles.metric}>
          <span className={styles.metricIcon}>◎</span>
          <div>
            <strong>{summary.studySessionsCount}</strong>
            <span>{t('dashboard.sessions')}</span>
          </div>
        </Card>
      </section>

      <Card className={styles.activitySection}>
        <div className={styles.cardHeading}>
          <div>
            <p className={styles.eyebrow}>{t('dashboard.dailyActivity')}</p>
            <h2>{t('dashboard.lastSevenDays')}</h2>
          </div>
          <Badge tone="info">{t('dashboard.minutesUnit')}</Badge>
        </div>
        <ol className={styles.chart} aria-label={t('dashboard.chartLabelSeven')}>
          {recentDays.map((day) => (
            <li
              key={day.date}
              aria-label={t('dashboard.dayAria', {
                date: day.date,
                minutes: day.studyMinutes,
                sessions: day.studySessionsCount,
              })}
            >
              <strong>{day.studyMinutes}</strong>
              <span
                className={day.studyMinutes ? styles.bar : styles.zeroBar}
                style={
                  {
                    '--bar-height': `${Math.round((day.studyMinutes / maxMinutes) * 100)}%`,
                  } as CSSProperties
                }
                aria-hidden="true"
              />
              <time dateTime={day.date}>
                {new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
                  weekday: 'short',
                  timeZone: 'UTC',
                }).format(new Date(`${day.date}T00:00:00Z`))}
              </time>
            </li>
          ))}
        </ol>
      </Card>
    </main>
  );
}
