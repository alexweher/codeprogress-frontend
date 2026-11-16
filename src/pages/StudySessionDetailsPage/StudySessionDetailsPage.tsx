import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../features/auth/model/useAuth';
import { useLearningTasks } from '../../features/learningTasks/model/learningTaskQueries';
import { useTopic } from '../../features/topics/model/topicQueries';
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
import { useI18n } from '../../shared/i18n/useI18n';
import { formatLocalDateTimeForLocale } from '../../shared/i18n/format';
import {
  formatSessionDate,
  formatSessionDuration,
} from '../../features/studySessions/lib/sessionPresentation';

function InvalidSessionPage() {
  const { t } = useI18n();
  return (
    <main className={styles.page}>
      <Link className={styles.backLink} to="/app/topics">
        {t('common.backToTopics')}
      </Link>
      <section className={styles.messageState} role="alert">
        <p className={styles.eyebrow}>{t('sessions.invalid')}</p>
        <h1>{t('sessions.invalidTitle')}</h1>
        <p>{t('sessions.invalidText')}</p>
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
  const { locale, t } = useI18n();
  const navigate = useNavigate();
  const tasksQuery = useLearningTasks(userId, session.topicId);
  const topicQuery = useTopic(userId, session.topicId);
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
          message: t('sessions.deleteMissing'),
          recoveryAction: 'back',
        });
      } else if (error instanceof NetworkError) {
        setDeleteError({
          message: t('sessions.deleteNetwork'),
          recoveryAction: 'check',
        });
      } else {
        setDeleteError({
          message: getStudySessionErrorMessage(error, t('sessions.deleteError'), t),
          recoveryAction: error instanceof HttpError ? null : 'check',
        });
      }
    }
  }

  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumbs} aria-label={t('topics.breadcrumb')}>
        <Link to="/app/topics">{t('nav.topics')}</Link>
        <span aria-hidden="true">/</span>
        <Link to={`/app/topics/${session.topicId}`}>
          {topicQuery.data?.title ?? t('common.backToTopic')}
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{t('sessions.studySession')}</span>
      </nav>

      <header className={styles.pageHeader}>
        <div>
          <h1>{t('sessions.studySession')}</h1>
          <p className={styles.headerDate}>
            <time dateTime={session.sessionDate}>
              {formatSessionDate(session.sessionDate, locale)}
            </time>
          </p>
        </div>
        <span className={styles.duration}>
          {formatSessionDuration(session.durationMinutes, locale)}
        </span>
      </header>

      {successMessage ? (
        <p className={styles.successMessage} role="status">
          {successMessage}
        </p>
      ) : null}

      <section className={styles.detailsCard} aria-labelledby="session-overview-title">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="session-overview-title">{t('sessions.note')}</h2>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              disabled={
                updateMutation.isPending || deleteMutation.isPending || !tasksQuery.isSuccess
              }
              title={tasksQuery.isSuccess ? undefined : t('sessions.tasksRequired')}
              onClick={() => {
                updateMutation.reset();
                setSuccessMessage(null);
                setIsEditing(true);
              }}
            >
              {t('sessions.edit')}
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
              {t('sessions.delete')}
            </button>
          </div>
        </div>

        <p className={session.note ? styles.note : styles.emptyNote}>
          {session.note || t('sessions.noNotes')}
        </p>

        <dl className={styles.metadata}>
          <div>
            <dt>{t('common.created')}</dt>
            <dd>
              <time dateTime={session.createdAt}>
                {formatLocalDateTimeForLocale(session.createdAt, locale)}
              </time>
            </dd>
          </div>
          <div>
            <dt>{t('common.lastUpdated')}</dt>
            <dd>
              <time dateTime={session.updatedAt}>
                {formatLocalDateTimeForLocale(session.updatedAt, locale)}
              </time>
            </dd>
          </div>
        </dl>
      </section>

      {isEditing && tasksQuery.isSuccess ? (
        <section className={styles.actionCard} aria-labelledby="edit-study-session-title">
          <p className={styles.eyebrow}>{t('sessions.history')}</p>
          <h2 id="edit-study-session-title">{t('sessions.updateTitle')}</h2>
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
              setSuccessMessage(t('sessions.updated'));
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
  const { t } = useI18n();
  const { user } = useAuth();
  const userId = user?.id ?? 0;
  const sessionQuery = useStudySession(userId, sessionId);

  if (sessionQuery.isPending) {
    return (
      <main className={styles.page} aria-busy="true">
        <div className={styles.loadingState} role="status">
          <span />
          <span />
          <p>{t('sessions.loadingDetails')}</p>
        </div>
      </main>
    );
  }

  if (sessionQuery.isError) {
    const notFound = sessionQuery.error instanceof HttpError && sessionQuery.error.status === 404;
    return (
      <main className={styles.page}>
        <Link className={styles.backLink} to="/app/topics">
          {t('common.backToTopics')}
        </Link>
        <section className={styles.messageState} role="alert">
          <p className={styles.eyebrow}>
            {notFound ? t('sessions.notFound') : t('sessions.unableLoad')}
          </p>
          <h1>{notFound ? t('sessions.unavailableTitle') : t('sessions.detailsUnavailable')}</h1>
          <p>
            {notFound
              ? t('sessions.notFoundText')
              : getStudySessionErrorMessage(sessionQuery.error, t('sessions.loadDetailsError'), t)}
          </p>
          <button type="button" onClick={() => void sessionQuery.refetch()}>
            {t('common.retry')}
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
