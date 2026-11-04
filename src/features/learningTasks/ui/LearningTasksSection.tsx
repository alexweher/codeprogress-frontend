import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getLearningTaskErrorMessage } from '../lib/learningTaskErrors';
import { formatLocalDate } from '../lib/localDate';
import { useCreateLearningTask, useLearningTasks } from '../model/learningTaskQueries';
import {
  learningTaskDifficultyLabels,
  learningTaskPriorityLabels,
  learningTaskStatusLabels,
} from '../model/learningTaskMetadata';
import { CreateLearningTaskForm } from './CreateLearningTaskForm';
import styles from './LearningTasksSection.module.css';

type LearningTasksSectionProps = {
  userId: number;
  topicId: number;
};

export function LearningTasksSection({ userId, topicId }: LearningTasksSectionProps) {
  const tasksQuery = useLearningTasks(userId, topicId);
  const createMutation = useCreateLearningTask(userId, topicId);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  return (
    <section className={styles.section} aria-labelledby="learning-tasks-title">
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Study plan</p>
          <h2 id="learning-tasks-title">Learning tasks</h2>
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
          Add task
        </button>
      </div>

      {successMessage ? (
        <p className={styles.successMessage} role="status">
          {successMessage}
        </p>
      ) : null}

      {isCreateOpen ? (
        <div className={styles.formCard} aria-labelledby="create-learning-task-title">
          <h3 id="create-learning-task-title">Create learning task</h3>
          <CreateLearningTaskForm
            isPending={createMutation.isPending}
            onCancel={() => {
              createMutation.reset();
              setIsCreateOpen(false);
            }}
            onSubmit={async (request) => {
              await createMutation.mutateAsync(request);
              setIsCreateOpen(false);
              setSuccessMessage('Learning task created.');
            }}
          />
        </div>
      ) : null}

      {tasksQuery.isPending ? (
        <div className={styles.loadingState} role="status" aria-busy="true">
          <span />
          <span />
          <p>Loading learning tasks…</p>
        </div>
      ) : null}

      {tasksQuery.isError ? (
        <div className={styles.errorState} role="alert">
          <h3>Learning tasks are unavailable</h3>
          <p>
            {getLearningTaskErrorMessage(
              tasksQuery.error,
              'The learning tasks could not be loaded. Try again.',
            )}
          </p>
          <button type="button" onClick={() => void tasksQuery.refetch()}>
            Retry tasks
          </button>
        </div>
      ) : null}

      {tasksQuery.isSuccess && tasksQuery.data.length === 0 ? (
        <div className={styles.emptyState}>
          <h3>No learning tasks yet</h3>
          <p>Add a concrete next step for this topic when you are ready.</p>
        </div>
      ) : null}

      {tasksQuery.isSuccess && tasksQuery.data.length > 0 ? (
        <ul className={styles.list} aria-label="Learning tasks">
          {tasksQuery.data.map((task) => (
            <li className={styles.taskCard} key={task.id}>
              <div className={styles.taskHeader}>
                <h3>
                  <Link to={`/app/tasks/${task.id}`}>{task.title}</Link>
                </h3>
                <span className={styles.status} data-status={task.status}>
                  {learningTaskStatusLabels[task.status]}
                </span>
              </div>
              {task.description ? <p className={styles.description}>{task.description}</p> : null}
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
              </dl>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
