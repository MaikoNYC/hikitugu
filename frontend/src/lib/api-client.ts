const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Request failed" }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  }

  get<T>(path: string) {
    return this.request<T>(path, { method: "GET" });
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(path: string) {
    return this.request<T>(path, { method: "DELETE" });
  }

  // Token-injected variants for authenticated requests

  getWithToken<T>(path: string, token: string) {
    return this.request<T>(path, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  postWithToken<T>(path: string, token: string, body?: unknown) {
    return this.request<T>(path, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  putWithToken<T>(path: string, token: string, body?: unknown) {
    return this.request<T>(path, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  deleteWithToken<T>(path: string, token: string) {
    return this.request<T>(path, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
