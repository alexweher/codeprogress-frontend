import { selectNextDashboardTask, type DashboardTask } from './dashboardLearningFocus';

function task(id: number, status: DashboardTask['status']): DashboardTask {
  return {
    id,
    topicId: 7,
    title: `Task ${id}`,
    description: null,
    difficulty: 'MEDIUM',
    status,
    deadline: null,
    priority: 'MEDIUM',
    createdAt: '2026-01-01T10:00:00',
    updatedAt: '2026-01-01T10:00:00',
    topic: {
      id: 7,
      title: 'Topic',
      description: null,
      status: 'IN_PROGRESS',
      createdAt: '2026-01-01T10:00:00',
      updatedAt: '2026-01-01T10:00:00',
    },
  };
}

describe('dashboard learning focus', () => {
  it('selects the first in-progress task before a planned task', () => {
    expect(
      selectNextDashboardTask([task(1, 'PLANNED'), task(2, 'IN_PROGRESS'), task(3, 'IN_PROGRESS')])
        ?.id,
    ).toBe(2);
  });

  it('falls back to the first planned task and returns null when all tasks are complete', () => {
    expect(selectNextDashboardTask([task(1, 'COMPLETED'), task(2, 'PLANNED')])?.id).toBe(2);
    expect(selectNextDashboardTask([task(1, 'COMPLETED')])).toBeNull();
  });
});
