import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../features/auth/model/useAuth';
import { LearningTasksSection } from '../../features/learningTasks/ui/LearningTasksSection';
import { StudySessionsSection } from '../../features/studySessions/ui/StudySessionsSection';
import { studySessionQueryKeys } from '../../features/studySessions/model/studySessionQueries';
import { getTopicErrorMessage } from '../../features/topics/lib/topicErrors';
import { parseTopicId } from '../../features/topics/lib/topicId';
import {
  useTopic,
  useDeleteTopic,
  useUpdateTopic,
  useUpdateTopicStatus,
} from '../../features/topics/model/topicQueries';
import { EditTopicForm } from '../../features/topics/ui/EditTopicForm';
import { DeleteTopicDialog } from '../../features/topics/ui/DeleteTopicDialog';
import { TopicStatusForm } from '../../features/topics/ui/TopicStatusForm';
import { HttpError, NetworkError, RequestAbortedError } from '../../shared/api/apiError';
import styles from './TopicDetailsPage.module.css';
import { useI18n } from '../../shared/i18n/useI18n';
import { localizeTopicStatus } from '../../shared/i18n/domainLabels';
import { formatLocalDateTimeForLocale } from '../../shared/i18n/format';
import { Progress } from '../../shared/ui/UiPrimitives';
import { ActionMenu } from '../../shared/ui/ActionMenu';

function InvalidTopicPage() {
  const { t } = useI18n();
  return (
    <main className={styles.page}>
      <Link className={styles.backLink} to="/app/topics">
        {t('common.backToTopics')}
      </Link>
      <section className={styles.messageState} role="alert">
        <p className={styles.eyebrow}>{t('topics.invalid')}</p>
        <h1>{t('topics.invalidTitle')}</h1>
        <p>{t('topics.invalidText')}</p>
      </section>
    </main>
  );
}

function isTaskDeletionSuccessState(value: unknown): value is { learningTaskDeleted: true } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'learningTaskDeleted' in value &&
    value.learningTaskDeleted === true
  );
}

function isCreateTaskState(value: unknown): value is { openCreateTask: true } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'openCreateTask' in value &&
    value.openCreateTask === true
  );
}

function getSessionDeletionSuccessState(
  value: unknown,
): { studySessionDeleted: true; deletedSessionId: number } | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('studySessionDeleted' in value) ||
    value.studySessionDeleted !== true ||
    !('deletedSessionId' in value) ||
    typeof value.deletedSessionId !== 'number' ||
    !Number.isSafeInteger(value.deletedSessionId) ||
    value.deletedSessionId <= 0
  ) {
    return null;
  }
  return { studySessionDeleted: true, deletedSessionId: value.deletedSessionId };
}

function TopicDetails({ topicId }: { topicId: number }) {
  const { locale, t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const userId = user?.id ?? 0;
  const topicQuery = useTopic(userId, topicId);
  const updateMutation = useUpdateTopic(userId, topicId);
  const statusMutation = useUpdateTopicStatus(userId, topicId);
  const deleteMutation = useDeleteTopic(userId, topicId);
  const [openAction, setOpenAction] = useState<'edit' | 'status' | null>(null);
  const [taskMetrics, setTaskMetrics] = useState({ completed: 0, total: 0 });
  const [sessionMetrics, setSessionMetrics] = useState({ minutes: 0, total: 0 });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<{
    message: string;
    recoveryAction: 'back' | 'check' | null;
  } | null>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const sessionDeletionState = getSessionDeletionSuccessState(location.state as unknown);
  const deletedSessionId = sessionDeletionState?.deletedSessionId ?? null;

  useEffect(() => {
    if (deletedSessionId !== null) {
      queryClient.removeQueries({
        queryKey: studySessionQueryKeys.detail(userId, deletedSessionId),
        exact: true,
      });
    }
  }, [deletedSessionId, queryClient, userId]);

  useEffect(() => {
    if (!topicQuery.isSuccess || location.hash !== '#study-sessions') return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById('study-sessions')?.scrollIntoView({ block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.hash, topicQuery.isSuccess]);

  if (topicQuery.isPending) {
    return (
      <main className={styles.page} aria-busy="true">
        <Link className={styles.backLink} to="/app/topics">
          {t('common.backToTopics')}
        </Link>
        <div className={styles.loadingState} role="status">
          <span />
          <span />
          <p>{t('topics.loadingDetails')}</p>
        </div>
      </main>
    );
  }

  if (topicQuery.isError) {
    const notFound = topicQuery.error instanceof HttpError && topicQuery.error.status === 404;
    return (
      <main className={styles.page}>
        <Link className={styles.backLink} to="/app/topics">
          {t('common.backToTopics')}
        </Link>
        <section className={styles.messageState} role="alert">
          <p className={styles.eyebrow}>
            {notFound ? t('topics.notFound') : t('topics.unableLoad')}
          </p>
          <h1>{notFound ? t('topics.unavailableTitle') : t('topics.detailsUnavailable')}</h1>
          <p>
            {notFound
              ? t('topics.notFoundText')
              : getTopicErrorMessage(topicQuery.error, t('topics.loadDetailsError'), t)}
          </p>
          <button type="button" onClick={() => void topicQuery.refetch()}>
            {t('common.retry')}
          </button>
        </section>
      </main>
    );
  }

  const topic = topicQuery.data;
  const completedTasks = taskMetrics.completed;
  const totalTasks = taskMetrics.total;
  const completionPercent = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const studyMinutes = sessionMetrics.minutes;

  async function handleUpdate(request: Parameters<typeof updateMutation.mutateAsync>[0]) {
    await updateMutation.mutateAsync(request);
    setOpenAction(null);
    setSuccessMessage(t('topics.detailsUpdated'));
  }

  async function handleStatusChange(request: Parameters<typeof statusMutation.mutateAsync>[0]) {
    await statusMutation.mutateAsync(request);
    setOpenAction(null);
    setSuccessMessage(t('topics.statusUpdated'));
  }

  function closeDeleteDialog() {
    setIsDeleteDialogOpen(false);
    setDeleteError(null);
    window.setTimeout(() => deleteButtonRef.current?.focus(), 0);
  }

  async function handleDelete() {
    if (deleteMutation.isPending) {
      return;
    }

    setDeleteError(null);
    try {
      await deleteMutation.mutateAsync();
      setIsDeleteDialogOpen(false);
      await navigate('/app/topics', {
        replace: true,
        state: { topicDeleted: true, deletedTopicId: topicId },
      });
    } catch (error) {
      if (error instanceof RequestAbortedError) {
        return;
      }

      if (error instanceof HttpError && error.status === 409) {
        setDeleteError({
          message: t('topics.deleteConflict'),
          recoveryAction: null,
        });
      } else if (error instanceof HttpError && error.status === 404) {
        setDeleteError({
          message: t('topics.deleteMissing'),
          recoveryAction: 'back',
        });
      } else if (error instanceof NetworkError) {
        setDeleteError({
          message: t('topics.deleteNetwork'),
          recoveryAction: 'check',
        });
      } else {
        setDeleteError({
          message: getTopicErrorMessage(error, t('topics.deleteError'), t),
          recoveryAction: 'check',
        });
      }
    }
  }

  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumbs} aria-label={t('topics.breadcrumb')}>
        <Link to="/app/topics" aria-label={t('common.backToTopics')}>
          {t('topics.title')}
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{topic.title}</span>
      </nav>

      <header className={styles.pageHeader}>
        <span className={styles.topicMark} aria-hidden="true">
          {topic.title.slice(0, 1).toUpperCase()}
        </span>
        <div className={styles.headerCopy}>
          <p className={styles.eyebrow}>{t('topics.details')}</p>
          <h1>{topic.title}</h1>
          <p>{topic.description || t('common.noDescription')}</p>
        </div>
        <span className={styles.status} data-status={topic.status}>
          {localizeTopicStatus(t, topic.status)}
        </span>
      </header>

      {sessionDeletionState ? (
        <p className={styles.successMessage} role="status">
          {t('sessions.deleted')}
        </p>
      ) : isTaskDeletionSuccessState(location.state as unknown) ? (
        <p className={styles.successMessage} role="status">
          {t('tasks.deleted')}
        </p>
      ) : successMessage ? (
        <p className={styles.successMessage} role="status">
          {successMessage}
        </p>
      ) : null}

      <div className={styles.contentGrid}>
        <div className={styles.primaryColumn}>
          <LearningTasksSection
            userId={userId}
            topicId={topicId}
            initialCreateOpen={isCreateTaskState(location.state as unknown)}
            onMetricsChange={setTaskMetrics}
          />
          <StudySessionsSection
            userId={userId}
            topicId={topicId}
            onMetricsChange={setSessionMetrics}
          />
        </div>
        <aside className={styles.sideColumn} aria-label={t('topics.overview')}>
          <section className={styles.detailsCard} aria-labelledby="topic-overview-title">
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>{t('topics.overview')}</p>
                <h2 id="topic-overview-title">{t('topics.about')}</h2>
              </div>
              <ActionMenu
                label={t('topics.actions')}
                triggerRef={deleteButtonRef}
                items={[
                  {
                    label: t('common.edit'),
                    disabled: updateMutation.isPending || statusMutation.isPending,
                    onSelect: () => {
                      setOpenAction('edit');
                      setSuccessMessage(null);
                    },
                  },
                  {
                    label: t('topics.changeStatus'),
                    disabled: updateMutation.isPending || statusMutation.isPending,
                    onSelect: () => {
                      setOpenAction('status');
                      setSuccessMessage(null);
                    },
                  },
                  {
                    label: t('topics.delete'),
                    danger: true,
                    disabled: deleteMutation.isPending,
                    onSelect: () => {
                      deleteMutation.reset();
                      setDeleteError(null);
                      setOpenAction(null);
                      setSuccessMessage(null);
                      setIsDeleteDialogOpen(true);
                    },
                  },
                ]}
              />
            </div>

            <div className={styles.statGrid}>
              <div>
                <strong>
                  {completedTasks}/{totalTasks}
                </strong>
                <span>{t('topics.tasksComplete')}</span>
              </div>
              <div>
                <strong>{studyMinutes}</strong>
                <span>{t('dashboard.minutesUnit')}</span>
              </div>
              <div>
                <strong>{sessionMetrics.total}</strong>
                <span>{t('dashboard.sessions')}</span>
              </div>
            </div>
            <Progress
              value={completionPercent}
              label={t('dashboard.progressAria', { percent: completionPercent })}
            />
            <p className={styles.statusNote}>{t('topics.statusIndependent')}</p>

            <dl className={styles.metadata}>
              <div>
                <dt>{t('common.created')}</dt>
                <dd>
                  <time dateTime={topic.createdAt}>
                    {formatLocalDateTimeForLocale(topic.createdAt, locale)}
                  </time>
                </dd>
              </div>
              <div>
                <dt>{t('common.lastUpdated')}</dt>
                <dd>
                  <time dateTime={topic.updatedAt}>
                    {formatLocalDateTimeForLocale(topic.updatedAt, locale)}
                  </time>
                </dd>
              </div>
            </dl>
          </section>

          {openAction === 'edit' ? (
            <section className={styles.actionCard} aria-labelledby="edit-topic-heading">
              <p className={styles.eyebrow}>{t('topics.editDetails')}</p>
              <h2 id="edit-topic-heading">{t('topics.update')}</h2>
              <EditTopicForm
                topic={topic}
                isPending={updateMutation.isPending}
                onCancel={() => setOpenAction(null)}
                onSubmit={handleUpdate}
              />
            </section>
          ) : null}

          {openAction === 'status' ? (
            <section className={styles.actionCard} aria-labelledby="status-topic-heading">
              <p className={styles.eyebrow}>{t('topics.learningState')}</p>
              <h2 id="status-topic-heading">{t('topics.changeStatus')}</h2>
              <p className={styles.actionHint}>{t('topics.transitionHint')}</p>
              <TopicStatusForm
                currentStatus={topic.status}
                isPending={statusMutation.isPending}
                onCancel={() => setOpenAction(null)}
                onSubmit={handleStatusChange}
              />
            </section>
          ) : null}
        </aside>
      </div>

      {isDeleteDialogOpen ? (
        <DeleteTopicDialog
          topicTitle={topic.title}
          isPending={deleteMutation.isPending}
          errorMessage={deleteError?.message ?? null}
          recoveryAction={deleteError?.recoveryAction ?? null}
          onCancel={closeDeleteDialog}
          onConfirm={() => void handleDelete()}
          onRecovery={() => {
            setIsDeleteDialogOpen(false);
            setDeleteError(null);
            if (deleteError?.recoveryAction === 'back') {
              void navigate('/app/topics', { replace: true });
            } else {
              void topicQuery.refetch();
            }
          }}
        />
      ) : null}
    </main>
  );
}

export function TopicDetailsPage() {
  const { topicId: topicIdParam } = useParams();
  const topicId = parseTopicId(topicIdParam);

  return topicId === null ? <InvalidTopicPage /> : <TopicDetails topicId={topicId} />;
}
