import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatLocalDate } from '../../learningTasks/lib/localDate';
import { useLearningTasks } from '../../learningTasks/model/learningTaskQueries';
import { getStudySessionErrorMessage } from '../lib/studySessionErrors';
import { useCreateStudySession, useStudySessions } from '../model/studySessionQueries';
import { CreateStudySessionForm } from './CreateStudySessionForm';
import styles from './StudySessionsSection.module.css';

type StudySessionsSectionProps = {
  userId: number;
  topicId: number;
};

export function StudySessionsSection({ userId, topicId }: StudySessionsSectionProps) {
  const sessionsQuery = useStudySessions(userId, topicId);
  const tasksQuery = useLearningTasks(userId, topicId);
  const createMutation = useCreateStudySession(userId, topicId);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const taskTitles = useMemo(
    () => new Map((tasksQuery.data ?? []).map((task) => [task.id, task.title])),
    [tasksQuery.data],
  );

  return (
    <section className={styles.section} aria-labelledby="study-sessions-title">
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Learning history</p>
          <h2 id="study-sessions-title">Study sessions</h2>
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
          Add session
        </button>
      </div>

      {successMessage ? (
        <p className={styles.successMessage} role="status">
          {successMessage}
        </p>
      ) : null}

      {isCreateOpen ? (
        <div className={styles.formCard} aria-labelledby="create-study-session-title">
          <h3 id="create-study-session-title">Record study session</h3>
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
              setSuccessMessage('Study session recorded.');
            }}
          />
        </div>
      ) : null}

      {sessionsQuery.isPending ? (
        <div className={styles.loadingState} role="status" aria-busy="true">
          <span />
          <span />
          <p>Loading study sessions…</p>
        </div>
      ) : null}

      {sessionsQuery.isError ? (
        <div className={styles.errorState} role="alert">
          <h3>Study sessions are unavailable</h3>
          <p>
            {getStudySessionErrorMessage(
              sessionsQuery.error,
              'The study sessions could not be loaded. Try again.',
            )}
          </p>
          <button type="button" onClick={() => void sessionsQuery.refetch()}>
            Retry sessions
          </button>
        </div>
      ) : null}

      {sessionsQuery.isSuccess && sessionsQuery.data.length === 0 ? (
        <div className={styles.emptyState}>
          <h3>No study sessions yet</h3>
          <p>Record focused study time for this topic when you finish a session.</p>
        </div>
      ) : null}

      {sessionsQuery.isSuccess && sessionsQuery.data.length > 0 ? (
        <ul className={styles.list} aria-label="Study sessions">
          {sessionsQuery.data.map((session) => (
            <li className={styles.sessionCard} key={session.id}>
              <div className={styles.sessionHeader}>
                <h3>
                  <Link
                    to={`/app/sessions/${session.id}`}
                    aria-label={`View study session on ${formatLocalDate(session.sessionDate)}`}
                  >
                    <time dateTime={session.sessionDate}>
                      {formatLocalDate(session.sessionDate)}
                    </time>
                  </Link>
                </h3>
                <span className={styles.duration}>{session.durationMinutes} min</span>
              </div>
              {session.note ? <p className={styles.note}>{session.note}</p> : null}
              <div className={styles.completedTasks}>
                <h4>Completed tasks</h4>
                {session.completedTaskIds.length === 0 ? (
                  <p>No tasks recorded.</p>
                ) : (
                  <ul>
                    {session.completedTaskIds.map((taskId) => (
                      <li key={taskId}>{taskTitles.get(taskId) ?? `Task #${taskId}`}</li>
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
