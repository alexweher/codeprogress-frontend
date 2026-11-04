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
import { topicStatusLabels } from '../../features/topics/model/topicStatus';
import { EditTopicForm } from '../../features/topics/ui/EditTopicForm';
import { DeleteTopicDialog } from '../../features/topics/ui/DeleteTopicDialog';
import { TopicStatusForm } from '../../features/topics/ui/TopicStatusForm';
import { HttpError, NetworkError, RequestAbortedError } from '../../shared/api/apiError';
import styles from './TopicDetailsPage.module.css';

function formatLocalDateTime(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  return match ? `${match[3]}.${match[2]}.${match[1]}, ${match[4]}:${match[5]}` : value;
}

function InvalidTopicPage() {
  return (
    <main className={styles.page}>
      <Link className={styles.backLink} to="/app/topics">
        ← Back to Topics
      </Link>
      <section className={styles.messageState} role="alert">
        <p className={styles.eyebrow}>Invalid topic</p>
        <h1>This topic address is not valid</h1>
        <p>Open a topic from your Topics list and try again.</p>
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

  if (topicQuery.isPending) {
    return (
      <main className={styles.page} aria-busy="true">
        <Link className={styles.backLink} to="/app/topics">
          ← Back to Topics
        </Link>
        <div className={styles.loadingState} role="status">
          <span />
          <span />
          <p>Loading topic…</p>
        </div>
      </main>
    );
  }

  if (topicQuery.isError) {
    const notFound = topicQuery.error instanceof HttpError && topicQuery.error.status === 404;
    return (
      <main className={styles.page}>
        <Link className={styles.backLink} to="/app/topics">
          ← Back to Topics
        </Link>
        <section className={styles.messageState} role="alert">
          <p className={styles.eyebrow}>{notFound ? 'Topic not found' : 'Unable to load topic'}</p>
          <h1>{notFound ? 'This topic is unavailable' : 'Topic details are unavailable'}</h1>
          <p>
            {notFound
              ? 'The topic does not exist or does not belong to your account.'
              : getTopicErrorMessage(topicQuery.error, 'The topic could not be loaded.')}
          </p>
          <button type="button" onClick={() => void topicQuery.refetch()}>
            Retry
          </button>
        </section>
      </main>
    );
  }

  const topic = topicQuery.data;

  async function handleUpdate(request: Parameters<typeof updateMutation.mutateAsync>[0]) {
    await updateMutation.mutateAsync(request);
    setOpenAction(null);
    setSuccessMessage('Topic details updated.');
  }

  async function handleStatusChange(request: Parameters<typeof statusMutation.mutateAsync>[0]) {
    await statusMutation.mutateAsync(request);
    setOpenAction(null);
    setSuccessMessage('Topic status changed.');
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
          message:
            'This topic cannot be deleted because it has learning tasks or study sessions. Related data must remain intact.',
          recoveryAction: null,
        });
      } else if (error instanceof HttpError && error.status === 404) {
        setDeleteError({
          message: 'This topic is already absent or is no longer available to your account.',
          recoveryAction: 'back',
        });
      } else if (error instanceof NetworkError) {
        setDeleteError({
          message:
            'The server could not be reached, so CodeProgress cannot confirm whether the topic was deleted. Check its current state before trying again.',
          recoveryAction: 'check',
        });
      } else {
        setDeleteError({
          message: getTopicErrorMessage(error, 'The topic could not be deleted.'),
          recoveryAction: 'check',
        });
      }
    }
  }

  return (
    <main className={styles.page}>
      <Link className={styles.backLink} to="/app/topics">
        ← Back to Topics
      </Link>

      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Topic details</p>
          <h1>{topic.title}</h1>
        </div>
        <span className={styles.status} data-status={topic.status}>
          {topicStatusLabels[topic.status]}
        </span>
      </header>

      {sessionDeletionState ? (
        <p className={styles.successMessage} role="status">
          Study session deleted successfully.
        </p>
      ) : isTaskDeletionSuccessState(location.state as unknown) ? (
        <p className={styles.successMessage} role="status">
          Learning task deleted successfully.
        </p>
      ) : successMessage ? (
        <p className={styles.successMessage} role="status">
          {successMessage}
        </p>
      ) : null}

      <section className={styles.detailsCard} aria-labelledby="topic-overview-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Overview</p>
            <h2 id="topic-overview-title">About this topic</h2>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              onClick={() => {
                setOpenAction('edit');
                setSuccessMessage(null);
              }}
              disabled={updateMutation.isPending || statusMutation.isPending}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => {
                setOpenAction('status');
                setSuccessMessage(null);
              }}
              disabled={updateMutation.isPending || statusMutation.isPending}
            >
              Change Status
            </button>
            <button
              ref={deleteButtonRef}
              className={styles.deleteTopicButton}
              type="button"
              onClick={() => {
                deleteMutation.reset();
                setDeleteError(null);
                setOpenAction(null);
                setSuccessMessage(null);
                setIsDeleteDialogOpen(true);
              }}
              disabled={
                updateMutation.isPending || statusMutation.isPending || deleteMutation.isPending
              }
            >
              Delete Topic
            </button>
          </div>
        </div>

        <p className={topic.description ? styles.description : styles.emptyDescription}>
          {topic.description || 'No description provided.'}
        </p>

        <dl className={styles.metadata}>
          <div>
            <dt>Created</dt>
            <dd>
              <time dateTime={topic.createdAt}>{formatLocalDateTime(topic.createdAt)}</time>
            </dd>
          </div>
          <div>
            <dt>Last updated</dt>
            <dd>
              <time dateTime={topic.updatedAt}>{formatLocalDateTime(topic.updatedAt)}</time>
            </dd>
          </div>
        </dl>
      </section>

      {openAction === 'edit' ? (
        <section className={styles.actionCard} aria-labelledby="edit-topic-heading">
          <p className={styles.eyebrow}>Edit details</p>
          <h2 id="edit-topic-heading">Update topic</h2>
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
          <p className={styles.eyebrow}>Learning state</p>
          <h2 id="status-topic-heading">Change topic status</h2>
          <p className={styles.actionHint}>All status transitions are supported by API v1.0.0.</p>
          <TopicStatusForm
            currentStatus={topic.status}
            isPending={statusMutation.isPending}
            onCancel={() => setOpenAction(null)}
            onSubmit={handleStatusChange}
          />
        </section>
      ) : null}

      <LearningTasksSection userId={userId} topicId={topicId} />
      <StudySessionsSection userId={userId} topicId={topicId} />

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
