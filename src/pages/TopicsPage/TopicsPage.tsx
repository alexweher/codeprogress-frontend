import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/model/useAuth';
import { learningTaskQueryKeys } from '../../features/learningTasks/model/learningTaskQueries';
import { studySessionQueryKeys } from '../../features/studySessions/model/studySessionQueries';
import type { CreateTopicRequest } from '../../features/topics/api/topicsApi';
import {
  topicQueryKeys,
  useCreateTopic,
  useTopics,
} from '../../features/topics/model/topicQueries';
import { topicStatusLabels } from '../../features/topics/model/topicStatus';
import { CreateTopicForm } from '../../features/topics/ui/CreateTopicForm';
import styles from './TopicsPage.module.css';

function getDeletionSuccessState(
  value: unknown,
): { topicDeleted: true; deletedTopicId: number } | null {
  const isValid =
    typeof value === 'object' &&
    value !== null &&
    'topicDeleted' in value &&
    value.topicDeleted === true &&
    'deletedTopicId' in value &&
    typeof value.deletedTopicId === 'number' &&
    Number.isSafeInteger(value.deletedTopicId) &&
    value.deletedTopicId > 0;

  return isValid ? { topicDeleted: true, deletedTopicId: value.deletedTopicId as number } : null;
}

export function TopicsPage() {
  const { user } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const userId = user?.id ?? 0;
  const deletionState = getDeletionSuccessState(location.state as unknown);
  const topicsQuery = useTopics(userId);
  const createMutation = useCreateTopic(userId);
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    if (!deletionState) return;
    queryClient.removeQueries({
      queryKey: topicQueryKeys.detail(userId, deletionState.deletedTopicId),
      exact: true,
    });
    queryClient.removeQueries({
      queryKey: learningTaskQueryKeys.topic(userId, deletionState.deletedTopicId),
    });
    queryClient.removeQueries({
      queryKey: studySessionQueryKeys.topic(userId, deletionState.deletedTopicId),
    });
  }, [deletionState, queryClient, userId]);

  async function handleCreate(request: CreateTopicRequest) {
    await createMutation.mutateAsync(request);
    setIsFormOpen(false);
  }

  return (
    <main className={styles.page}>
      {deletionState ? (
        <p className={styles.successMessage} role="status">
          Topic deleted successfully.
        </p>
      ) : null}
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Learning workspace</p>
          <h1>My Topics</h1>
          <p>Keep the subjects you want to learn in one focused place.</p>
        </div>
        <button type="button" onClick={() => setIsFormOpen(true)} disabled={isFormOpen}>
          Add Topic
        </button>
      </header>

      {isFormOpen ? (
        <section className={styles.formCard} aria-labelledby="create-topic-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>New topic</p>
              <h2 id="create-topic-title">What will you learn next?</h2>
            </div>
          </div>
          <CreateTopicForm
            isPending={createMutation.isPending}
            onCancel={() => setIsFormOpen(false)}
            onSubmit={handleCreate}
          />
        </section>
      ) : null}

      <section aria-labelledby="topics-list-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Your collection</p>
            <h2 id="topics-list-title">Topics</h2>
          </div>
          {topicsQuery.data ? <p>{topicsQuery.data.length} total</p> : null}
        </div>

        {topicsQuery.isPending ? (
          <div className={styles.loadingState} role="status">
            <span />
            <span />
            <span />
            <p>Loading topics…</p>
          </div>
        ) : topicsQuery.isError ? (
          <div className={styles.messageState} role="alert">
            <h3>Topics are unavailable</h3>
            <p>We couldn’t load your topics. Check your connection and try again.</p>
            <button type="button" onClick={() => void topicsQuery.refetch()}>
              Retry
            </button>
          </div>
        ) : topicsQuery.data.length === 0 ? (
          <div className={styles.messageState}>
            <h3>No topics yet</h3>
            <p>Create your first topic to start organizing what you want to learn.</p>
            <button type="button" onClick={() => setIsFormOpen(true)} disabled={isFormOpen}>
              Add your first topic
            </button>
          </div>
        ) : (
          <ul className={styles.topicList} aria-label="Learning topics">
            {topicsQuery.data.map((topic) => (
              <li key={topic.id}>
                <div>
                  <h3>
                    <Link to={`/app/topics/${topic.id}`}>{topic.title}</Link>
                  </h3>
                  {topic.description ? <p>{topic.description}</p> : null}
                </div>
                <span data-status={topic.status}>{topicStatusLabels[topic.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
