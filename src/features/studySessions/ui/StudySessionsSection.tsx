import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLearningTasks } from '../../learningTasks/model/learningTaskQueries';
import { getStudySessionErrorMessage } from '../lib/studySessionErrors';
import { useCreateStudySession, useStudySessions } from '../model/studySessionQueries';
import { CreateStudySessionForm } from './CreateStudySessionForm';
import styles from './StudySessionsSection.module.css';
import { useI18n } from '../../../shared/i18n/useI18n';
import { formatLocalDateForLocale } from '../../../shared/i18n/format';

type StudySessionsSectionProps = {
  userId: number;
  topicId: number;
  onMetricsChange?: (metrics: { minutes: number; total: number }) => void;
};

export function StudySessionsSection({
  userId,
  topicId,
  onMetricsChange,
}: StudySessionsSectionProps) {
  const { locale, t } = useI18n();
  const sessionsQuery = useStudySessions(userId, topicId);
  const tasksQuery = useLearningTasks(userId, topicId);
  const createMutation = useCreateStudySession(userId, topicId);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const taskTitles = useMemo(
    () => new Map((tasksQuery.data ?? []).map((task) => [task.id, task.title])),
    [tasksQuery.data],
  );

  useEffect(() => {
    if (!sessionsQuery.isSuccess) return;
    onMetricsChange?.({
      minutes: sessionsQuery.data.reduce((total, session) => total + session.durationMinutes, 0),
      total: sessionsQuery.data.length,
    });
  }, [onMetricsChange, sessionsQuery.data, sessionsQuery.isSuccess]);

  return (
    <section id="study-sessions" className={styles.section} aria-labelledby="study-sessions-title">
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>{t('sessions.history')}</p>
          <h2 id="study-sessions-title">{t('sessions.title')}</h2>
        </div>
        <button
          type="button"
          onClick={() => {
            createMutation.reset();
            setSuccessMessage(null);
            setIsCreateOpen(true);
          }}
          disabled={createMutation.isPending || isCreateOpen}
        >
          {t('sessions.add')}
        </button>
      </div>

      {successMessage ? (
        <p className={styles.successMessage} role="status">
          {successMessage}
        </p>
      ) : null}

      {isCreateOpen ? (
        <div className={styles.formCard} aria-labelledby="create-study-session-title">
          <h3 id="create-study-session-title">{t('sessions.record')}</h3>
          <CreateStudySessionForm
            tasks={tasksQuery.data ?? []}
            areTasksLoading={tasksQuery.isPending}
            tasksUnavailable={tasksQuery.isError}
            isPending={createMutation.isPending}
            onCancel={() => {
              createMutation.reset();
              setIsCreateOpen(false);
            }}
            onSubmit={async (request) => {
              await createMutation.mutateAsync(request);
              setIsCreateOpen(false);
              setSuccessMessage(t('sessions.recorded'));
            }}
          />
        </div>
      ) : null}

      {sessionsQuery.isPending ? (
        <div className={styles.loadingState} role="status" aria-busy="true">
          <span />
          <span />
          <p>{t('sessions.loading')}</p>
        </div>
      ) : null}

      {sessionsQuery.isError ? (
        <div className={styles.errorState} role="alert">
          <h3>{t('sessions.unavailable')}</h3>
          <p>{getStudySessionErrorMessage(sessionsQuery.error, t('sessions.loadError'), t)}</p>
          <button type="button" onClick={() => void sessionsQuery.refetch()}>
            {t('sessions.retry')}
          </button>
        </div>
      ) : null}

      {sessionsQuery.isSuccess && sessionsQuery.data.length === 0 ? (
        <div className={styles.emptyState}>
          <h3>{t('sessions.empty')}</h3>
          <p>{t('sessions.emptyText')}</p>
        </div>
      ) : null}

      {sessionsQuery.isSuccess && sessionsQuery.data.length > 0 ? (
        <ul className={styles.list} aria-label={t('sessions.listLabel')}>
          {sessionsQuery.data.map((session) => (
            <li className={styles.sessionCard} key={session.id}>
              <div className={styles.sessionHeader}>
                <h3>
                  <Link
                    to={`/app/sessions/${session.id}`}
                    aria-label={t('sessions.viewAria', {
                      date: formatLocalDateForLocale(session.sessionDate, locale),
                    })}
                  >
                    <time dateTime={session.sessionDate}>
                      {formatLocalDateForLocale(session.sessionDate, locale)}
                    </time>
                  </Link>
                </h3>
                <span className={styles.duration}>
                  {t('sessions.min', { count: session.durationMinutes })}
                </span>
              </div>
              {session.note ? <p className={styles.note}>{session.note}</p> : null}
              <div className={styles.completedTasks}>
                <h4>{t('sessions.completedTasks')}</h4>
                {session.completedTaskIds.length === 0 ? (
                  <p>{t('sessions.noTasks')}</p>
                ) : (
                  <ul>
                    {session.completedTaskIds.map((taskId) => (
                      <li key={taskId}>
                        {taskTitles.get(taskId) ?? t('sessions.taskFallback', { id: taskId })}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
