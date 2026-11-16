import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
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
import { useTopicCardMetrics } from '../../features/topics/model/topicCardMetrics';
import { CreateTopicForm } from '../../features/topics/ui/CreateTopicForm';
import { useI18n } from '../../shared/i18n/useI18n';
import { localizeTopicStatus } from '../../shared/i18n/domainLabels';
import { Progress } from '../../shared/ui/UiPrimitives';
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
  const { t } = useI18n();
  const { user } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const userId = user?.id ?? 0;
  const deletionState = getDeletionSuccessState(location.state as unknown);
  const topicsQuery = useTopics(userId);
  const metricsSentinelRef = useRef<HTMLElement>(null);
  const [metricsEnabled, setMetricsEnabled] = useState(false);
  const topicMetrics = useTopicCardMetrics(userId, topicsQuery.data ?? [], metricsEnabled);
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

  useEffect(() => {
    const sentinel = metricsSentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setMetricsEnabled(true);
        observer.disconnect();
      }
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [topicsQuery.isSuccess]);

  async function handleCreate(request: CreateTopicRequest) {
    await createMutation.mutateAsync(request);
    setIsFormOpen(false);
  }

  return (
    <main className={styles.page}>
      {deletionState ? (
        <p className={styles.successMessage} role="status">
          {t('topics.deleted')}
        </p>
      ) : null}
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>{t('topics.phaseBTitle')}</p>
          <h1>{t('topics.title')}</h1>
          <p>{t('topics.phaseBDescription')}</p>
        </div>
        <button type="button" onClick={() => setIsFormOpen(true)} disabled={isFormOpen}>
          {t('topics.add')}
        </button>
      </header>

      {isFormOpen ? (
        <section className={styles.formCard} aria-labelledby="create-topic-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>{t('topics.new')}</p>
              <h2 id="create-topic-title">{t('topics.createQuestion')}</h2>
            </div>
          </div>
          <CreateTopicForm
            isPending={createMutation.isPending}
            onCancel={() => setIsFormOpen(false)}
            onSubmit={handleCreate}
          />
        </section>
      ) : null}

      <section ref={metricsSentinelRef} aria-labelledby="topics-list-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>{t('topics.collection')}</p>
            <h2 id="topics-list-title">{t('topics.collectionTitle')}</h2>
          </div>
          {topicsQuery.data ? <p>{t('common.total', { count: topicsQuery.data.length })}</p> : null}
        </div>

        {topicsQuery.isPending ? (
          <div className={styles.loadingState} role="status">
            <span />
            <span />
            <span />
            <p>{t('topics.loading')}</p>
          </div>
        ) : topicsQuery.isError ? (
          <div className={styles.messageState} role="alert">
            <h3>{t('topics.unavailable')}</h3>
            <p>{t('topics.loadError')}</p>
            <button type="button" onClick={() => void topicsQuery.refetch()}>
              {t('common.retry')}
            </button>
          </div>
        ) : topicsQuery.data.length === 0 ? (
          <div className={styles.messageState}>
            <h3>{t('topics.emptyTitle')}</h3>
            <p>{t('topics.emptyText')}</p>
            <button type="button" onClick={() => setIsFormOpen(true)} disabled={isFormOpen}>
              {t('topics.addFirst')}
            </button>
          </div>
        ) : (
          <ul className={styles.topicList} aria-label={t('topics.listLabel')}>
            {topicsQuery.data.map((topic, index) => {
              const metric = topicMetrics.get(topic.id);
              const progress = metric?.totalTasks
                ? Math.round((metric.completedTasks / metric.totalTasks) * 100)
                : 0;
              return (
                <li key={topic.id} className={styles.topicCard}>
                  <div className={styles.cardTopline}>
                    <span className={styles.topicNumber} aria-hidden="true">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className={styles.status} data-status={topic.status}>
                      {localizeTopicStatus(t, topic.status)}
                    </span>
                  </div>
                  <div className={styles.cardCopy}>
                    <h3>
                      <Link to={`/app/topics/${topic.id}`}>{topic.title}</Link>
                    </h3>
                    <p>{topic.description || t('common.noDescription')}</p>
                  </div>
                  {metric?.isPending ? (
                    <p className={styles.metricNote}>{t('topics.loadingProgress')}</p>
                  ) : metric && !metric.isError ? (
                    <div className={styles.metrics}>
                      <div className={styles.progressHeader}>
                        <span>{t('topics.taskProgress')}</span>
                        <strong>
                          {metric.completedTasks}/{metric.totalTasks}
                        </strong>
                      </div>
                      <Progress
                        value={progress}
                        label={t('dashboard.progressAria', { percent: progress })}
                      />
                      <div className={styles.metricRow}>
                        <span>{t('topics.studyMinutes', { count: metric.studyMinutes })}</span>
                        <span>{t('dashboard.sessionCount', { count: metric.sessions })}</span>
                      </div>
                    </div>
                  ) : (
                    <p className={styles.metricNote}>{t('topics.openForProgress')}</p>
                  )}
                  <Link className={styles.openLink} to={`/app/topics/${topic.id}`}>
                    {t('topics.open')} <span aria-hidden="true">→</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
