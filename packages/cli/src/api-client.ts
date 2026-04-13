/**
 * Thin HTTP client for the Agent Pool server API.
 */

export interface ApiClientOptions {
  serverUrl: string;
  apiKey: string;
}

export class ApiClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.serverUrl.replace(/\/$/, '') + '/api/v1';
    this.apiKey = options.apiKey;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
    };
    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = await res.json() as { data?: T; error?: { message: string } };
    if (!res.ok || json.error) {
      throw new Error(json.error?.message ?? `HTTP ${res.status}`);
    }
    return json.data as T;
  }

  // Tasks
  async listTasks(status?: string): Promise<Task[]> {
    const qs = status ? `?status=${status}` : '';
    return this.request('GET', `/tasks${qs}`);
  }

  async getTask(id: string): Promise<Task> {
    return this.request('GET', `/tasks/${id}`);
  }

  async createTask(title: string, description?: string, priority?: string): Promise<Task> {
    return this.request('POST', '/tasks', {
      title,
      description: description ?? title,
      priority: priority ?? 'medium',
    });
  }

  async cancelTask(id: string): Promise<Task> {
    return this.request('POST', `/tasks/${id}/cancel`);
  }

  async retryTask(id: string): Promise<Task> {
    return this.request('POST', `/tasks/${id}/retry`);
  }

  // Plans
  async getPlans(taskId: string): Promise<Plan[]> {
    return this.request('GET', `/tasks/${taskId}/plans`);
  }

  async approvePlan(taskId: string, planId: string): Promise<Plan> {
    return this.request('POST', `/tasks/${taskId}/plans/${planId}/approve`);
  }

  async rejectPlan(taskId: string, planId: string, feedback: string): Promise<Plan> {
    return this.request('POST', `/tasks/${taskId}/plans/${planId}/reject`, { feedback });
  }

  // Diffs / Merge
  async getDiffs(taskId: string): Promise<Diff[]> {
    return this.request('GET', `/tasks/${taskId}/diffs`);
  }

  async approveMerge(taskId: string): Promise<Task> {
    return this.request('POST', `/tasks/${taskId}/merge/approve`);
  }

  async rejectMerge(taskId: string): Promise<Task> {
    return this.request('POST', `/tasks/${taskId}/merge/reject`);
  }

  async requestChanges(taskId: string, comments: string): Promise<Task> {
    return this.request('POST', `/tasks/${taskId}/review/request-changes`, { comments });
  }

  // Slots
  async listSlots(): Promise<Slot[]> {
    return this.request('GET', '/slots');
  }

  // Events
  async listEvents(limit?: number): Promise<Event[]> {
    const qs = limit ? `?limit=${limit}` : '';
    return this.request('GET', `/events${qs}`);
  }
}

// Types (minimal, matching server schema)
export interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  model_tier: string;
  target_branch: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface Plan {
  id: string;
  task_id: string;
  content: string;
  file_manifest: string[];
  reasoning: string;
  estimate: string;
  status: string;
  reviewer_feedback: string | null;
  created_at: string;
}

export interface Diff {
  id: string;
  task_id: string;
  diff_content: string;
  files_changed: { path: string; additions: number; deletions: number }[];
  additions: number;
  deletions: number;
  audit: { verdict?: string } | null;
  test_results: unknown | null;
}

export interface Slot {
  id: string;
  slot_number: number;
  status: string;
  branch_name: string | null;
  current_task_id: string | null;
  claimed_at: string | null;
}

export interface Event {
  id: string;
  task_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}
