import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../features/auth/model/useAuth';
import { getLearningTaskErrorMessage } from '../../features/learningTasks/lib/learningTaskErrors';
import { parseLearningTaskId } from '../../features/learningTasks/lib/learningTaskId';
import {
  learningTaskQueryKeys,
  useDeleteLearningTask,
  useLearningTask,
  useUpdateLearningTask,
  useUpdateLearningTaskPlanning,
  useUpdateLearningTaskStatus,
} from '../../features/learningTasks/model/learningTaskQueries';
import { EditLearningTaskForm } from '../../features/learningTasks/ui/EditLearningTaskForm';
import { LearningTaskPlanningForm } from '../../features/learningTasks/ui/LearningTaskPlanningForm';
import { LearningTaskStatusForm } from '../../features/learningTasks/ui/LearningTaskStatusForm';
import { DeleteLearningTaskDialog } from '../../features/learningTasks/ui/DeleteLearningTaskDialog';
import { topicQueryKeys } from '../../features/topics/model/topicQueries';
import type { TopicResponse } from '../../features/topics/api/topicsApi';
import { ActionMenu } from '../../shared/ui/ActionMenu';
import { HttpError, NetworkError, RequestAbortedError } from '../../shared/api/apiError';
import styles from './LearningTaskDetailsPage.module.css';
import { useI18n } from '../../shared/i18n/useI18n';
import { formatLocalDateForLocale, formatLocalDateTimeForLocale } from '../../shared/i18n/format';
import {
  localizeDifficulty,
  localizePriority,
  localizeTaskStatus,
} from '../../shared/i18n/domainLabels';

function InvalidTaskPage() {
  const { t } = useI18n();
  return (
    <main className={styles.page}>
      <Link className={styles.backLink} to="/app/topics">
        {t('common.backToTopics')}
      </Link>
      <section className={styles.messageState} role="alert">
        <p className={styles.eyebrow}>{t('tasks.invalid')}</p>
        <h1>{t('tasks.invalidTitle')}</h1>
        <p>{t('tasks.invalidText')}</p>
      </section>
    </main>
  );
}

function LearningTaskDetails({ taskId }: { taskId: number }) {
  const { locale, t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = user?.id ?? 0;
  const taskQuery = useLearningTask(userId, taskId);
  const updateMutation = useUpdateLearningTask(userId, taskId);
  const statusMutation = useUpdateLearningTaskStatus(userId, taskId);
  const planningMutation = useUpdateLearningTaskPlanning(userId, taskId);
  const deleteMutation = useDeleteLearningTask(userId, taskId, taskQuery.data?.topicId ?? 0);
  const [openAction, setOpenAction] = useState<'edit' | 'status' | 'planning' | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<{
    message: string;
    recoveryAction: 'back' | 'check' | null;
  } | null>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);

  if (taskQuery.isPending)
    return (
      <main className={styles.page} aria-busy="true">
        <div className={styles.loadingState} role="status">
          <span />
          <span />
          <p>{t('tasks.loadingDetails')}</p>
        </div>
      </main>
    );
  if (taskQuery.isError) {
    const notFound = taskQuery.error instanceof HttpError && taskQuery.error.status === 404;
    return (
      <main className={styles.page}>
        <Link className={styles.backLink} to="/app/topics">
          {t('common.backToTopics')}
        </Link>
        <section className={styles.messageState} role="alert">
          <p className={styles.eyebrow}>{notFound ? t('tasks.notFound') : t('tasks.unableLoad')}</p>
          <h1>{notFound ? t('tasks.unavailableTitle') : t('tasks.detailsUnavailable')}</h1>
          <p>
            {notFound
              ? t('tasks.notFoundText')
              : getLearningTaskErrorMessage(taskQuery.error, t('tasks.loadDetailsError'), t)}
          </p>
          <button type="button" onClick={() => void taskQuery.refetch()}>
            {t('common.retry')}
          </button>
        </section>
      </main>
    );
  }

  const task = taskQuery.data;
  const cachedTopic =
    queryClient.getQueryData<TopicResponse>(topicQueryKeys.detail(userId, task.topicId)) ??
    queryClient
      .getQueryData<TopicResponse[]>(topicQueryKeys.list(userId))
      ?.find((topic) => topic.id === task.topicId);
  const topicTitle = cachedTopic?.title ?? t('tasks.parentTopic', { id: task.topicId });
  const pending =
    updateMutation.isPending ||
    statusMutation.isPending ||
    planningMutation.isPending ||
    deleteMutation.isPending;
  const open = (action: 'edit' | 'status' | 'planning') => {
    setOpenAction(action);
    setSuccessMessage(null);
  };

  async function handlePrimaryAction() {
    if (task.status === 'COMPLETED') {
      await navigate(`/app/topics/${task.topicId}`, { state: { openCreateTask: true } });
      return;
    }
    const status = task.status === 'PLANNED' ? 'IN_PROGRESS' : 'COMPLETED';
    await statusMutation.mutateAsync({ status });
    setSuccessMessage(t('tasks.statusUpdated'));
  }

  function closeDeleteDialog() {
    setIsDeleteDialogOpen(false);
    setDeleteError(null);
    window.setTimeout(() => deleteButtonRef.current?.focus(), 0);
  }

  async function handleDelete() {
    if (deleteMutation.isPending) return;
    setDeleteError(null);
    try {
      await deleteMutation.mutateAsync();
      setIsDeleteDialogOpen(false);
      await navigate(`/app/topics/${task.topicId}`, {
        replace: true,
        state: { learningTaskDeleted: true },
      });
      window.setTimeout(() => {
        queryClient.removeQueries({
          queryKey: learningTaskQueryKeys.detail(userId, taskId),
          exact: true,
        });
      }, 0);
    } catch (error) {
      if (error instanceof RequestAbortedError) return;
      if (error instanceof HttpError && error.status === 409) {
        setDeleteError({
          message: error.apiError?.message ?? t('tasks.deleteConflict'),
          recoveryAction: null,
        });
      } else if (error instanceof HttpError && error.status === 404) {
        setDeleteError({
          message: t('tasks.deleteMissing'),
          recoveryAction: 'back',
        });
      } else if (error instanceof NetworkError) {
        setDeleteError({
          message: t('tasks.deleteNetwork'),
          recoveryAction: 'check',
        });
      } else {
        setDeleteError({
          message: getLearningTaskErrorMessage(error, t('tasks.deleteError'), t),
          recoveryAction: 'check',
        });
      }
    }
  }
  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumbs} aria-label={t('tasks.breadcrumb')}>
        <Link to="/app/topics">{t('topics.title')}</Link>
        <span aria-hidden="true">/</span>
        <Link to={`/app/topics/${task.topicId}`} aria-label={t('common.backToTopic')}>
          {topicTitle}
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{task.title}</span>
      </nav>
      <header className={styles.pageHeader}>
        <div className={styles.headerCopy}>
          <p className={styles.eyebrow}>{t('tasks.learningTask')}</p>
          <h1>{task.title}</h1>
          <p>{task.description || t('common.noDescription')}</p>
        </div>
        <div className={styles.heroAction}>
          <span className={styles.status} data-status={task.status}>
            {localizeTaskStatus(t, task.status)}
          </span>
          <button type="button" disabled={pending} onClick={() => void handlePrimaryAction()}>
            {task.status === 'PLANNED'
              ? t('tasks.start')
              : task.status === 'IN_PROGRESS'
                ? t('tasks.complete')
                : t('tasks.addNext')}
          </button>
        </div>
      </header>
      {successMessage ? (
        <p className={styles.successMessage} role="status">
          {successMessage}
        </p>
      ) : null}
      <section className={styles.detailsCard} aria-labelledby="task-overview-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>{t('topics.overview')}</p>
            <h2 id="task-overview-title">{t('tasks.details')}</h2>
          </div>
          <ActionMenu
            label={t('tasks.actions')}
            triggerRef={deleteButtonRef}
            items={[
              { label: t('tasks.editDetails'), disabled: pending, onSelect: () => open('edit') },
              { label: t('tasks.changeStatus'), disabled: pending, onSelect: () => open('status') },
              {
                label: t('tasks.editPlanning'),
                disabled: pending,
                onSelect: () => open('planning'),
              },
              {
                label: t('tasks.delete'),
                danger: true,
                disabled: pending,
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
        <p className={styles.reconciliationNote}>
          {t('tasks.sessionNote')}{' '}
          <Link to={`/app/topics/${task.topicId}#study-sessions`}>{t('tasks.openSessions')}</Link>
        </p>
        <dl className={styles.metadata}>
          <div>
            <dt>{t('tasks.difficulty')}</dt>
            <dd>{localizeDifficulty(t, task.difficulty)}</dd>
          </div>
          <div>
            <dt>{t('tasks.priority')}</dt>
            <dd>{localizePriority(t, task.priority)}</dd>
          </div>
          <div>
            <dt>{t('tasks.deadline')}</dt>
            <dd>
              {task.deadline ? (
                <time dateTime={task.deadline}>
                  {formatLocalDateForLocale(task.deadline, locale)}
                </time>
              ) : (
                t('tasks.noDeadline')
              )}
            </dd>
          </div>
          <div>
            <dt>{t('common.created')}</dt>
            <dd>
              <time dateTime={task.createdAt}>
                {formatLocalDateTimeForLocale(task.createdAt, locale)}
              </time>
            </dd>
          </div>
          <div>
            <dt>{t('common.lastUpdated')}</dt>
            <dd>
              <time dateTime={task.updatedAt}>
                {formatLocalDateTimeForLocale(task.updatedAt, locale)}
              </time>
            </dd>
          </div>
        </dl>
      </section>
      {openAction === 'edit' ? (
        <section className={styles.actionCard} aria-labelledby="edit-task-title">
          <p className={styles.eyebrow}>{t('tasks.editDetails')}</p>
          <h2 id="edit-task-title">{t('tasks.update')}</h2>
          <EditLearningTaskForm
            task={task}
            isPending={updateMutation.isPending}
            onCancel={() => setOpenAction(null)}
            onSubmit={async (request) => {
              await updateMutation.mutateAsync(request);
              setOpenAction(null);
              setSuccessMessage(t('tasks.detailsUpdated'));
            }}
          />
        </section>
      ) : null}
      {openAction === 'status' ? (
        <section className={styles.actionCard} aria-labelledby="status-task-title">
          <p className={styles.eyebrow}>{t('tasks.learningState')}</p>
          <h2 id="status-task-title">{t('tasks.changeStatusTitle')}</h2>
          <p className={styles.hint}>
            API v1.0.0 supports all three status values without a transition matrix.
          </p>
          <LearningTaskStatusForm
            currentStatus={task.status}
            isPending={statusMutation.isPending}
            onCancel={() => setOpenAction(null)}
            onSubmit={async (request) => {
              await statusMutation.mutateAsync(request);
              setOpenAction(null);
              setSuccessMessage(t('tasks.statusUpdated'));
            }}
          />
        </section>
      ) : null}
      {openAction === 'planning' ? (
        <section className={styles.actionCard} aria-labelledby="planning-task-title">
          <p className={styles.eyebrow}>{t('tasks.planning')}</p>
          <h2 id="planning-task-title">{t('tasks.updatePlanning')}</h2>
          <LearningTaskPlanningForm
            task={task}
            isPending={planningMutation.isPending}
            onCancel={() => setOpenAction(null)}
            onSubmit={async (request) => {
              await planningMutation.mutateAsync(request);
              setOpenAction(null);
              setSuccessMessage(t('tasks.planningUpdated'));
            }}
          />
        </section>
      ) : null}
      {isDeleteDialogOpen ? (
        <DeleteLearningTaskDialog
          taskTitle={task.title}
          isPending={deleteMutation.isPending}
          errorMessage={deleteError?.message ?? null}
          recoveryAction={deleteError?.recoveryAction ?? null}
          onCancel={closeDeleteDialog}
          onConfirm={() => void handleDelete()}
          onRecovery={() => {
            setIsDeleteDialogOpen(false);
            setDeleteError(null);
            if (deleteError?.recoveryAction === 'back') {
              void navigate(`/app/topics/${task.topicId}`, { replace: true });
            } else {
              void taskQuery.refetch();
            }
          }}
        />
      ) : null}
    </main>
  );
}

export function LearningTaskDetailsPage() {
  const { taskId: value } = useParams();
  const taskId = parseLearningTaskId(value);
  return taskId === null ? <InvalidTaskPage /> : <LearningTaskDetails taskId={taskId} />;
}
