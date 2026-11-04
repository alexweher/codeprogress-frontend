import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../features/auth/model/useAuth';
import { formatLocalDate } from '../../features/learningTasks/lib/localDate';
import { useLearningTasks } from '../../features/learningTasks/model/learningTaskQueries';
import type { StudySessionResponse } from '../../features/studySessions/api/studySessionsApi';
import { getStudySessionErrorMessage } from '../../features/studySessions/lib/studySessionErrors';
import { parseStudySessionId } from '../../features/studySessions/lib/studySessionId';
import {
  useDeleteStudySession,
  useStudySession,
  useUpdateStudySession,
} from '../../features/studySessions/model/studySessionQueries';
import { DeleteStudySessionDialog } from '../../features/studySessions/ui/DeleteStudySessionDialog';
import { EditStudySessionForm } from '../../features/studySessions/ui/EditStudySessionForm';
import { HttpError, NetworkError, RequestAbortedError } from '../../shared/api/apiError';
import styles from './StudySessionDetailsPage.module.css';

function formatLocalDateTime(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  return match ? `${match[3]}.${match[2]}.${match[1]}, ${match[4]}:${match[5]}` : value;
}

function InvalidSessionPage() {
  return (
    <main className={styles.page}>
      <Link className={styles.backLink} to="/app/topics">
        ← Back to Topics
      </Link>
      <section className={styles.messageState} role="alert">
        <p className={styles.eyebrow}>Invalid session</p>
        <h1>This study session address is not valid</h1>
        <p>Open a study session from its Topic and try again.</p>
      </section>
    </main>
  );
}

function LoadedStudySession({
  userId,
  session,
  onRefetch,
}: {
  userId: number;
  session: StudySessionResponse;
  onRefetch: () => void;
}) {
  const navigate = useNavigate();
  const tasksQuery = useLearningTasks(userId, session.topicId);
  const updateMutation = useUpdateStudySession(userId, session.id, session.completedTaskIds);
  const deleteMutation = useDeleteStudySession(
    userId,
    session.id,
    session.topicId,
    session.completedTaskIds,
  );
  const [isEditing, setIsEditing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<{
    message: string;
    recoveryAction: 'back' | 'check' | null;
  } | null>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const deleteDialogWasOpenRef = useRef(false);
  const taskTitles = new Map((tasksQuery.data ?? []).map((task) => [task.id, task.title]));

  useEffect(() => {
    if (isDeleteDialogOpen) {
      deleteDialogWasOpenRef.current = true;
    } else if (deleteDialogWasOpenRef.current) {
      deleteDialogWasOpenRef.current = false;
      deleteButtonRef.current?.focus();
    }
  }, [isDeleteDialogOpen]);

  function closeDeleteDialog() {
    setIsDeleteDialogOpen(false);
    setDeleteError(null);
  }

  async function handleDelete() {
    if (deleteMutation.isPending) return;
    setDeleteError(null);

    try {
      await deleteMutation.mutateAsync();
      setIsDeleteDialogOpen(false);
      await navigate(`/app/topics/${session.topicId}`, {
        replace: true,
        state: { studySessionDeleted: true, deletedSessionId: session.id },
      });
    } catch (error) {
      if (error instanceof RequestAbortedError) return;

      if (error instanceof HttpError && error.status === 404) {
        setDeleteError({
          message:
            'This study session is already absent or is no longer available to your account.',
          recoveryAction: 'back',
        });
      } else if (error instanceof NetworkError) {
        setDeleteError({
          message:
            'The server could not be reached, so CodeProgress cannot confirm whether the study session was deleted. Check its current state before trying again.',
          recoveryAction: 'check',
        });
      } else {
        setDeleteError({
          message: getStudySessionErrorMessage(error, 'The study session could not be deleted.'),
          recoveryAction: error instanceof HttpError ? null : 'check',
        });
      }
    }
  }

  return (
    <main className={styles.page}>
      <Link className={styles.backLink} to={`/app/topics/${session.topicId}`}>
        ← Back to Topic
      </Link>

      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Study session</p>
          <h1>{formatLocalDate(session.sessionDate)}</h1>
        </div>
        <span className={styles.duration}>{session.durationMinutes} min</span>
      </header>

      {successMessage ? (
        <p className={styles.successMessage} role="status">
          {successMessage}
        </p>
      ) : null}

      <section className={styles.detailsCard} aria-labelledby="session-overview-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Learning history</p>
            <h2 id="session-overview-title">Session details</h2>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              disabled={
                updateMutation.isPending || deleteMutation.isPending || !tasksQuery.isSuccess
              }
              title={tasksQuery.isSuccess ? undefined : 'Learning tasks must load before editing'}
              onClick={() => {
                updateMutation.reset();
                setSuccessMessage(null);
                setIsEditing(true);
              }}
            >
              Edit session
            </button>
            <button
              ref={deleteButtonRef}
              className={styles.deleteButton}
              type="button"
              disabled={updateMutation.isPending || deleteMutation.isPending}
              onClick={() => {
                deleteMutation.reset();
                setDeleteError(null);
                setIsEditing(false);
                setSuccessMessage(null);
                setIsDeleteDialogOpen(true);
              }}
            >
              Delete study session
            </button>
          </div>
        </div>

        <p className={session.note ? styles.note : styles.emptyNote}>
          {session.note || 'No notes recorded.'}
        </p>

        <dl className={styles.metadata}>
          <div>
            <dt>Session date</dt>
            <dd>
              <time dateTime={session.sessionDate}>{formatLocalDate(session.sessionDate)}</time>
            </dd>
          </div>
          <div>
            <dt>Duration</dt>
            <dd>{session.durationMinutes} minutes</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>
              <time dateTime={session.createdAt}>{formatLocalDateTime(session.createdAt)}</time>
            </dd>
          </div>
          <div>
            <dt>Last updated</dt>
            <dd>
              <time dateTime={session.updatedAt}>{formatLocalDateTime(session.updatedAt)}</time>
            </dd>
          </div>
        </dl>

        <div className={styles.completedTasks}>
          <h3>Completed tasks</h3>
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

        {tasksQuery.isPending ? (
          <p className={styles.taskNotice} role="status">
            Loading task names…
          </p>
        ) : null}
        {tasksQuery.isError ? (
          <div className={styles.taskError} role="alert">
            <p>Learning tasks could not be loaded. Session data remains available.</p>
            <button type="button" onClick={() => void tasksQuery.refetch()}>
              Retry tasks
            </button>
          </div>
        ) : null}
      </section>

      {isEditing && tasksQuery.isSuccess ? (
        <section className={styles.actionCard} aria-labelledby="edit-study-session-title">
          <p className={styles.eyebrow}>Edit history</p>
          <h2 id="edit-study-session-title">Update study session</h2>
          <EditStudySessionForm
            session={session}
            tasks={tasksQuery.data}
            isPending={updateMutation.isPending}
            onCancel={() => {
              updateMutation.reset();
              setIsEditing(false);
            }}
            onSubmit={async (request) => {
              await updateMutation.mutateAsync(request);
              setIsEditing(false);
              setSuccessMessage('Study session updated.');
            }}
          />
        </section>
      ) : null}

      {isDeleteDialogOpen ? (
        <DeleteStudySessionDialog
          sessionDate={session.sessionDate}
          durationMinutes={session.durationMinutes}
          isPending={deleteMutation.isPending}
          errorMessage={deleteError?.message ?? null}
          recoveryAction={deleteError?.recoveryAction ?? null}
          onCancel={closeDeleteDialog}
          onConfirm={() => void handleDelete()}
          onRecovery={() => {
            setIsDeleteDialogOpen(false);
            setDeleteError(null);
            if (deleteError?.recoveryAction === 'back') {
              void navigate(`/app/topics/${session.topicId}`, { replace: true });
            } else {
              onRefetch();
            }
          }}
        />
      ) : null}
    </main>
  );
}

function StudySessionDetails({ sessionId }: { sessionId: number }) {
  const { user } = useAuth();
  const userId = user?.id ?? 0;
  const sessionQuery = useStudySession(userId, sessionId);

  if (sessionQuery.isPending) {
    return (
      <main className={styles.page} aria-busy="true">
        <div className={styles.loadingState} role="status">
          <span />
          <span />
          <p>Loading study session…</p>
        </div>
      </main>
    );
  }

  if (sessionQuery.isError) {
    const notFound = sessionQuery.error instanceof HttpError && sessionQuery.error.status === 404;
    return (
      <main className={styles.page}>
        <Link className={styles.backLink} to="/app/topics">
          ← Back to Topics
        </Link>
        <section className={styles.messageState} role="alert">
          <p className={styles.eyebrow}>
            {notFound ? 'Session not found' : 'Unable to load session'}
          </p>
          <h1>
            {notFound
              ? 'This study session is unavailable'
              : 'Study session details are unavailable'}
          </h1>
          <p>
            {notFound
              ? 'The study session does not exist or does not belong to your account.'
              : getStudySessionErrorMessage(
                  sessionQuery.error,
                  'The study session could not be loaded.',
                )}
          </p>
          <button type="button" onClick={() => void sessionQuery.refetch()}>
            Retry
          </button>
        </section>
      </main>
    );
  }

  return (
    <LoadedStudySession
      userId={userId}
      session={sessionQuery.data}
      onRefetch={() => void sessionQuery.refetch()}
    />
  );
}

export function StudySessionDetailsPage() {
  const { sessionId: value } = useParams();
  const sessionId = parseStudySessionId(value);
  return sessionId === null ? (
    <InvalidSessionPage />
  ) : (
    <StudySessionDetails sessionId={sessionId} />
  );
}
