import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getLearningTaskErrorMessage } from '../lib/learningTaskErrors';
import { useCreateLearningTask, useLearningTasks } from '../model/learningTaskQueries';
import { CreateLearningTaskForm } from './CreateLearningTaskForm';
import styles from './LearningTasksSection.module.css';
import { useI18n } from '../../../shared/i18n/useI18n';
import {
  localizeDifficulty,
  localizePriority,
  localizeTaskStatus,
} from '../../../shared/i18n/domainLabels';
import { formatLocalDateForLocale } from '../../../shared/i18n/format';
import { Progress } from '../../../shared/ui/UiPrimitives';

type LearningTasksSectionProps = {
  userId: number;
  topicId: number;
  initialCreateOpen?: boolean;
  onMetricsChange?: (metrics: { completed: number; total: number }) => void;
};

export function LearningTasksSection({
  userId,
  topicId,
  initialCreateOpen = false,
  onMetricsChange,
}: LearningTasksSectionProps) {
  const { locale, t } = useI18n();
  const tasksQuery = useLearningTasks(userId, topicId);
  const createMutation = useCreateLearningTask(userId, topicId);
  const [isCreateOpen, setIsCreateOpen] = useState(initialCreateOpen);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const tasks = tasksQuery.data ?? [];
  const completed = tasks.filter((task) => task.status === 'COMPLETED').length;
  const completion = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  const nextTask =
    tasks.find((task) => task.status === 'IN_PROGRESS') ??
    tasks.find((task) => task.status === 'PLANNED');

  useEffect(() => {
    if (tasksQuery.isSuccess) onMetricsChange?.({ completed, total: tasks.length });
  }, [completed, onMetricsChange, tasks.length, tasksQuery.isSuccess]);

  return (
    <section className={styles.section} aria-labelledby="learning-tasks-title">
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>{t('tasks.studyPlan')}</p>
          <h2 id="learning-tasks-title">{t('tasks.title')}</h2>
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
          {t('tasks.add')}
        </button>
      </div>

      {tasksQuery.isSuccess && tasks.length > 0 ? (
        <div className={styles.routeSummary}>
          <div>
            <span>{t('tasks.routeProgress')}</span>
            <strong>
              {completed}/{tasks.length}
            </strong>
          </div>
          <Progress
            value={completion}
            label={t('dashboard.progressAria', { percent: completion })}
          />
          <p>
            {nextTask ? t('tasks.nextStep', { title: nextTask.title }) : t('tasks.routeComplete')}
          </p>
        </div>
      ) : null}

      {successMessage ? (
        <p className={styles.successMessage} role="status">
          {successMessage}
        </p>
      ) : null}

      {isCreateOpen ? (
        <div className={styles.formCard} aria-labelledby="create-learning-task-title">
          <h3 id="create-learning-task-title">{t('tasks.createTitle')}</h3>
          <CreateLearningTaskForm
            isPending={createMutation.isPending}
            onCancel={() => {
              createMutation.reset();
              setIsCreateOpen(false);
            }}
            onSubmit={async (request) => {
              await createMutation.mutateAsync(request);
              setIsCreateOpen(false);
              setSuccessMessage(t('tasks.created'));
            }}
          />
        </div>
      ) : null}

      {tasksQuery.isPending ? (
        <div className={styles.loadingState} role="status" aria-busy="true">
          <span />
          <span />
          <p>{t('tasks.loading')}</p>
        </div>
      ) : null}

      {tasksQuery.isError ? (
        <div className={styles.errorState} role="alert">
          <h3>{t('tasks.unavailable')}</h3>
          <p>{getLearningTaskErrorMessage(tasksQuery.error, t('tasks.loadError'), t)}</p>
          <button type="button" onClick={() => void tasksQuery.refetch()}>
            {t('tasks.retry')}
          </button>
        </div>
      ) : null}

      {tasksQuery.isSuccess && tasksQuery.data.length === 0 ? (
        <div className={styles.emptyState}>
          <h3>{t('tasks.empty')}</h3>
          <p>{t('tasks.emptyText')}</p>
        </div>
      ) : null}

      {tasksQuery.isSuccess && tasksQuery.data.length > 0 ? (
        <ul className={styles.list} aria-label={t('tasks.listLabel')}>
          {tasksQuery.data.map((task, index) => (
            <li
              className={styles.taskCard}
              key={task.id}
              data-current={task.id === nextTask?.id || undefined}
            >
              <span className={styles.stepMarker} aria-hidden="true">
                {task.status === 'COMPLETED' ? '✓' : index + 1}
              </span>
              <div className={styles.taskBody}>
                <div className={styles.taskHeader}>
                  <h3>
                    <Link to={`/app/tasks/${task.id}`}>{task.title}</Link>
                  </h3>
                  <span className={styles.status} data-status={task.status}>
                    {localizeTaskStatus(t, task.status)}
                  </span>
                </div>
                {task.description ? <p className={styles.description}>{task.description}</p> : null}
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
                </dl>
                {task.id === nextTask?.id ? (
                  <Link className={styles.continueLink} to={`/app/tasks/${task.id}`}>
                    {t('tasks.continue')} <span aria-hidden="true">→</span>
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
