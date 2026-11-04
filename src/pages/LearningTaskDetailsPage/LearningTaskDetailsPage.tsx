import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../features/auth/model/useAuth';
import { getLearningTaskErrorMessage } from '../../features/learningTasks/lib/learningTaskErrors';
import { parseLearningTaskId } from '../../features/learningTasks/lib/learningTaskId';
import { formatLocalDate } from '../../features/learningTasks/lib/localDate';
import {
  learningTaskQueryKeys,
  useDeleteLearningTask,
  useLearningTask,
  useUpdateLearningTask,
  useUpdateLearningTaskPlanning,
  useUpdateLearningTaskStatus,
} from '../../features/learningTasks/model/learningTaskQueries';
import {
  learningTaskDifficultyLabels,
  learningTaskPriorityLabels,
  learningTaskStatusLabels,
} from '../../features/learningTasks/model/learningTaskMetadata';
import { EditLearningTaskForm } from '../../features/learningTasks/ui/EditLearningTaskForm';
import { LearningTaskPlanningForm } from '../../features/learningTasks/ui/LearningTaskPlanningForm';
import { LearningTaskStatusForm } from '../../features/learningTasks/ui/LearningTaskStatusForm';
import { DeleteLearningTaskDialog } from '../../features/learningTasks/ui/DeleteLearningTaskDialog';
import { HttpError, NetworkError, RequestAbortedError } from '../../shared/api/apiError';
import styles from './LearningTaskDetailsPage.module.css';

function formatLocalDateTime(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  return match ? `${match[3]}.${match[2]}.${match[1]}, ${match[4]}:${match[5]}` : value;
}

function InvalidTaskPage() {
  return (
    <main className={styles.page}>
      <Link className={styles.backLink} to="/app/topics">
        ← Back to Topics
      </Link>
      <section className={styles.messageState} role="alert">
        <p className={styles.eyebrow}>Invalid task</p>
        <h1>This task address is not valid</h1>
        <p>Open a learning task from its Topic and try again.</p>
      </section>
    </main>
  );
}

function LearningTaskDetails({ taskId }: { taskId: number }) {
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
          <p>Loading learning task…</p>
        </div>
      </main>
    );
  if (taskQuery.isError) {
    const notFound = taskQuery.error instanceof HttpError && taskQuery.error.status === 404;
    return (
      <main className={styles.page}>
        <Link className={styles.backLink} to="/app/topics">
          ← Back to Topics
        </Link>
        <section className={styles.messageState} role="alert">
          <p className={styles.eyebrow}>{notFound ? 'Task not found' : 'Unable to load task'}</p>
          <h1>
            {notFound
              ? 'This learning task is unavailable'
              : 'Learning task details are unavailable'}
          </h1>
          <p>
            {notFound
              ? 'The task does not exist or does not belong to your account.'
              : getLearningTaskErrorMessage(
                  taskQuery.error,
                  'The learning task could not be loaded.',
                )}
          </p>
          <button type="button" onClick={() => void taskQuery.refetch()}>
            Retry
          </button>
        </section>
      </main>
    );
  }

  const task = taskQuery.data;
  const pending =
    updateMutation.isPending ||
    statusMutation.isPending ||
    planningMutation.isPending ||
    deleteMutation.isPending;
  const open = (action: 'edit' | 'status' | 'planning') => {
    setOpenAction(action);
    setSuccessMessage(null);
  };

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
          message:
            error.apiError?.message ??
            'This learning task cannot be deleted because it is part of study session history.',
          recoveryAction: null,
        });
      } else if (error instanceof HttpError && error.status === 404) {
        setDeleteError({
          message:
            'This learning task is already absent or is no longer available to your account.',
          recoveryAction: 'back',
        });
      } else if (error instanceof NetworkError) {
        setDeleteError({
          message:
            'The server could not be reached, so CodeProgress cannot confirm whether the learning task was deleted. Check its current state before trying again.',
          recoveryAction: 'check',
        });
      } else {
        setDeleteError({
          message: getLearningTaskErrorMessage(error, 'The learning task could not be deleted.'),
          recoveryAction: 'check',
        });
      }
    }
  }
  return (
    <main className={styles.page}>
      <Link className={styles.backLink} to={`/app/topics/${task.topicId}`}>
        ← Back to Topic
      </Link>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Learning task</p>
          <h1>{task.title}</h1>
        </div>
        <span className={styles.status} data-status={task.status}>
          {learningTaskStatusLabels[task.status]}
        </span>
      </header>
      {successMessage ? (
        <p className={styles.successMessage} role="status">
          {successMessage}
        </p>
      ) : null}
      <section className={styles.detailsCard} aria-labelledby="task-overview-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Overview</p>
            <h2 id="task-overview-title">Task details</h2>
          </div>
          <div className={styles.actions}>
            <button type="button" disabled={pending} onClick={() => open('edit')}>
              Edit details
            </button>
            <button type="button" disabled={pending} onClick={() => open('status')}>
              Change status
            </button>
            <button type="button" disabled={pending} onClick={() => open('planning')}>
              Edit planning
            </button>
            <button
              ref={deleteButtonRef}
              className={styles.deleteTaskButton}
              type="button"
              disabled={pending}
              onClick={() => {
                deleteMutation.reset();
                setDeleteError(null);
                setOpenAction(null);
                setSuccessMessage(null);
                setIsDeleteDialogOpen(true);
              }}
            >
              Delete LearningTask
            </button>
          </div>
        </div>
        <p className={task.description ? styles.description : styles.emptyDescription}>
          {task.description || 'No description provided.'}
        </p>
        <dl className={styles.metadata}>
          <div>
            <dt>Difficulty</dt>
            <dd>{learningTaskDifficultyLabels[task.difficulty]}</dd>
          </div>
          <div>
            <dt>Priority</dt>
            <dd>{learningTaskPriorityLabels[task.priority]}</dd>
          </div>
          <div>
            <dt>Deadline</dt>
            <dd>
              {task.deadline ? (
                <time dateTime={task.deadline}>{formatLocalDate(task.deadline)}</time>
              ) : (
                'No deadline'
              )}
            </dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>
              <time dateTime={task.createdAt}>{formatLocalDateTime(task.createdAt)}</time>
            </dd>
          </div>
          <div>
            <dt>Last updated</dt>
            <dd>
              <time dateTime={task.updatedAt}>{formatLocalDateTime(task.updatedAt)}</time>
            </dd>
          </div>
        </dl>
      </section>
      {openAction === 'edit' ? (
        <section className={styles.actionCard} aria-labelledby="edit-task-title">
          <p className={styles.eyebrow}>Edit details</p>
          <h2 id="edit-task-title">Update learning task</h2>
          <EditLearningTaskForm
            task={task}
            isPending={updateMutation.isPending}
            onCancel={() => setOpenAction(null)}
            onSubmit={async (request) => {
              await updateMutation.mutateAsync(request);
              setOpenAction(null);
              setSuccessMessage('Learning task details updated.');
            }}
          />
        </section>
      ) : null}
      {openAction === 'status' ? (
        <section className={styles.actionCard} aria-labelledby="status-task-title">
          <p className={styles.eyebrow}>Learning state</p>
          <h2 id="status-task-title">Change task status</h2>
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
              setSuccessMessage('Learning task status changed.');
            }}
          />
        </section>
      ) : null}
      {openAction === 'planning' ? (
        <section className={styles.actionCard} aria-labelledby="planning-task-title">
          <p className={styles.eyebrow}>Planning</p>
          <h2 id="planning-task-title">Update deadline and priority</h2>
          <LearningTaskPlanningForm
            task={task}
            isPending={planningMutation.isPending}
            onCancel={() => setOpenAction(null)}
            onSubmit={async (request) => {
              await planningMutation.mutateAsync(request);
              setOpenAction(null);
              setSuccessMessage('Learning task planning updated.');
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
