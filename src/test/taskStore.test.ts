import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useTaskStore } from '../stores/taskStore';
import { taskApi } from '../services/api';

vi.mock('../services/api', () => ({
  taskApi: {
    list: vi.fn(),
    create: vi.fn(),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    retry: vi.fn(),
  },
}));

describe('TaskStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTaskStore.setState({
      tasks: [],
      selectedTaskId: null,
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('has empty tasks array', () => {
      const { tasks } = useTaskStore.getState();
      expect(tasks).toEqual([]);
    });

    it('has null selectedTaskId', () => {
      const { selectedTaskId } = useTaskStore.getState();
      expect(selectedTaskId).toBeNull();
    });

    it('has isLoading false', () => {
      const { isLoading } = useTaskStore.getState();
      expect(isLoading).toBe(false);
    });

    it('has null error', () => {
      const { error } = useTaskStore.getState();
      expect(error).toBeNull();
    });
  });

  describe('fetchTasks', () => {
    it('sets isLoading true when fetching', async () => {
      vi.mocked(taskApi.list).mockResolvedValue({ tasks: [], total: 0 });

      const promise = useTaskStore.getState().fetchTasks();

      expect(useTaskStore.getState().isLoading).toBe(true);

      await promise;
    });

    it('updates tasks on success', async () => {
      const mockTasks = [
        { id: '1', description: 'Task 1', status: 'pending' },
        { id: '2', description: 'Task 2', status: 'running' },
      ];
      vi.mocked(taskApi.list).mockResolvedValue({ tasks: mockTasks, total: 2 });

      await useTaskStore.getState().fetchTasks();

      expect(useTaskStore.getState().tasks).toEqual(mockTasks);
      expect(useTaskStore.getState().isLoading).toBe(false);
    });

    it('sets error on failure', async () => {
      vi.mocked(taskApi.list).mockRejectedValue(new Error('Failed to fetch'));

      await useTaskStore.getState().fetchTasks();

      expect(useTaskStore.getState().error).toBe('Failed to fetch');
      expect(useTaskStore.getState().isLoading).toBe(false);
    });

    it('clears previous error on new fetch', async () => {
      useTaskStore.setState({ error: 'Previous error' });
      vi.mocked(taskApi.list).mockResolvedValue({ tasks: [], total: 0 });

      await useTaskStore.getState().fetchTasks();

      expect(useTaskStore.getState().error).toBeNull();
    });

    it('passes filters to taskApi.list', async () => {
      vi.mocked(taskApi.list).mockResolvedValue({ tasks: [], total: 0 });

      await useTaskStore.getState().fetchTasks({ status: 'pending', agent_id: 'agent-1' });

      expect(taskApi.list).toHaveBeenCalledWith({ status: 'pending', agent_id: 'agent-1' });
    });
  });

  describe('createTask', () => {
    it('sets isLoading true when creating', async () => {
      vi.mocked(taskApi.create).mockResolvedValue({ task: {}, message: 'Created' });
      vi.mocked(taskApi.list).mockResolvedValue({ tasks: [], total: 0 });

      const promise = useTaskStore.getState().createTask({ description: 'New Task' });

      expect(useTaskStore.getState().isLoading).toBe(true);

      await promise;
    });

    it('calls taskApi.create with data', async () => {
      const createData = {
        description: 'New Task',
        mode: 'auto',
        target_agent_id: 'agent-1',
      };
      vi.mocked(taskApi.create).mockResolvedValue({ task: {}, message: 'Created' });
      vi.mocked(taskApi.list).mockResolvedValue({ tasks: [], total: 0 });

      await useTaskStore.getState().createTask(createData);

      expect(taskApi.create).toHaveBeenCalledWith(createData);
    });

    it('calls fetchTasks after successful creation', async () => {
      vi.mocked(taskApi.create).mockResolvedValue({ task: {}, message: 'Created' });
      vi.mocked(taskApi.list).mockResolvedValue({ tasks: [], total: 0 });

      await useTaskStore.getState().createTask({ description: 'New Task' });

      expect(taskApi.list).toHaveBeenCalled();
    });

    it('sets error on failure', async () => {
      vi.mocked(taskApi.create).mockRejectedValue(new Error('Creation failed'));

      await useTaskStore.getState().createTask({ description: 'New Task' });

      expect(useTaskStore.getState().error).toBe('Creation failed');
      expect(useTaskStore.getState().isLoading).toBe(false);
    });
  });

  describe('cancelTask', () => {
    it('calls taskApi.cancel with taskId', async () => {
      vi.mocked(taskApi.cancel).mockResolvedValue({ message: 'Cancelled' });

      await useTaskStore.getState().cancelTask('task-1');

      expect(taskApi.cancel).toHaveBeenCalledWith('task-1');
    });

    it('updates only the specified task status to cancelled', async () => {
      useTaskStore.setState({
        tasks: [
          { id: 'task-1', description: 'Task 1', status: 'running' },
          { id: 'task-2', description: 'Task 2', status: 'running' },
        ],
      });
      vi.mocked(taskApi.cancel).mockResolvedValue({ message: 'Cancelled' });

      await useTaskStore.getState().cancelTask('task-1');

      expect(useTaskStore.getState().tasks[0].status).toBe('cancelled');
      expect(useTaskStore.getState().tasks[1].status).toBe('running');
    });

    it('sets error on failure', async () => {
      vi.mocked(taskApi.cancel).mockRejectedValue(new Error('Cancel failed'));

      await useTaskStore.getState().cancelTask('task-1');

      expect(useTaskStore.getState().error).toBe('Cancel failed');
    });
  });

  describe('pauseTask', () => {
    it('calls taskApi.pause with taskId', async () => {
      vi.mocked(taskApi.pause).mockResolvedValue({ message: 'Paused' });

      await useTaskStore.getState().pauseTask('task-1');

      expect(taskApi.pause).toHaveBeenCalledWith('task-1');
    });

    it('updates only the specified task status to paused', async () => {
      useTaskStore.setState({
        tasks: [
          { id: 'task-1', description: 'Task 1', status: 'running' },
          { id: 'task-2', description: 'Task 2', status: 'running' },
        ],
      });
      vi.mocked(taskApi.pause).mockResolvedValue({ message: 'Paused' });

      await useTaskStore.getState().pauseTask('task-1');

      expect(useTaskStore.getState().tasks[0].status).toBe('paused');
      expect(useTaskStore.getState().tasks[1].status).toBe('running');
    });

    it('sets error on failure', async () => {
      vi.mocked(taskApi.pause).mockRejectedValue(new Error('Pause failed'));

      await useTaskStore.getState().pauseTask('task-1');

      expect(useTaskStore.getState().error).toBe('Pause failed');
    });
  });

  describe('resumeTask', () => {
    it('calls taskApi.resume with taskId', async () => {
      vi.mocked(taskApi.resume).mockResolvedValue({ message: 'Resumed' });
      vi.mocked(taskApi.list).mockResolvedValue({ tasks: [], total: 0 });

      await useTaskStore.getState().resumeTask('task-1');

      expect(taskApi.resume).toHaveBeenCalledWith('task-1', undefined);
    });

    it('passes userInput to taskApi.resume', async () => {
      vi.mocked(taskApi.resume).mockResolvedValue({ message: 'Resumed' });
      vi.mocked(taskApi.list).mockResolvedValue({ tasks: [], total: 0 });

      await useTaskStore.getState().resumeTask('task-1', 'user input');

      expect(taskApi.resume).toHaveBeenCalledWith('task-1', 'user input');
    });

    it('calls fetchTasks after successful resume', async () => {
      vi.mocked(taskApi.resume).mockResolvedValue({ message: 'Resumed' });
      vi.mocked(taskApi.list).mockResolvedValue({ tasks: [], total: 0 });

      await useTaskStore.getState().resumeTask('task-1');

      expect(taskApi.list).toHaveBeenCalled();
    });

    it('sets error on failure', async () => {
      vi.mocked(taskApi.resume).mockRejectedValue(new Error('Resume failed'));

      await useTaskStore.getState().resumeTask('task-1');

      expect(useTaskStore.getState().error).toBe('Resume failed');
    });
  });

  describe('retryTask', () => {
    it('calls taskApi.retry with taskId', async () => {
      vi.mocked(taskApi.retry).mockResolvedValue({ message: 'Retried' });

      await useTaskStore.getState().retryTask('task-1');

      expect(taskApi.retry).toHaveBeenCalledWith('task-1');
    });

    it('updates only the specified task status to pending', async () => {
      useTaskStore.setState({
        tasks: [
          { id: 'task-1', description: 'Task 1', status: 'failed' },
          { id: 'task-2', description: 'Task 2', status: 'failed' },
        ],
      });
      vi.mocked(taskApi.retry).mockResolvedValue({ message: 'Retried' });

      await useTaskStore.getState().retryTask('task-1');

      expect(useTaskStore.getState().tasks[0].status).toBe('pending');
      expect(useTaskStore.getState().tasks[1].status).toBe('failed');
    });

    it('sets error on failure', async () => {
      vi.mocked(taskApi.retry).mockRejectedValue(new Error('Retry failed'));

      await useTaskStore.getState().retryTask('task-1');

      expect(useTaskStore.getState().error).toBe('Retry failed');
    });
  });

  describe('setSelectedTask', () => {
    it('sets selectedTaskId to given id', () => {
      useTaskStore.getState().setSelectedTask('task-1');

      expect(useTaskStore.getState().selectedTaskId).toBe('task-1');
    });

    it('sets selectedTaskId to null', () => {
      useTaskStore.setState({ selectedTaskId: 'task-1' });

      useTaskStore.getState().setSelectedTask(null);

      expect(useTaskStore.getState().selectedTaskId).toBeNull();
    });
  });

  describe('clearError', () => {
    it('sets error to null', () => {
      useTaskStore.setState({ error: 'Some error' });

      useTaskStore.getState().clearError();

      expect(useTaskStore.getState().error).toBeNull();
    });
  });

  describe('Task State Transitions', () => {
    it('handles running to cancelled transition', async () => {
      useTaskStore.setState({
        tasks: [{ id: 'task-1', description: 'Task 1', status: 'running' }],
      });
      vi.mocked(taskApi.cancel).mockResolvedValue({ message: 'Cancelled' });

      await useTaskStore.getState().cancelTask('task-1');

      expect(useTaskStore.getState().tasks[0].status).toBe('cancelled');
    });

    it('handles running to paused transition', async () => {
      useTaskStore.setState({
        tasks: [{ id: 'task-1', description: 'Task 1', status: 'running' }],
      });
      vi.mocked(taskApi.pause).mockResolvedValue({ message: 'Paused' });

      await useTaskStore.getState().pauseTask('task-1');

      expect(useTaskStore.getState().tasks[0].status).toBe('paused');
    });

    it('handles failed to pending transition on retry', async () => {
      useTaskStore.setState({
        tasks: [{ id: 'task-1', description: 'Task 1', status: 'failed' }],
      });
      vi.mocked(taskApi.retry).mockResolvedValue({ message: 'Retried' });

      await useTaskStore.getState().retryTask('task-1');

      expect(useTaskStore.getState().tasks[0].status).toBe('pending');
    });
  });
});