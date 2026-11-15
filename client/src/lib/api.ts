let localToken: string | undefined;

export interface BootstrapData {
  token: string;
  settings: Record<string, string>;
  dataStatus: {
    ready: boolean;
    location: string;
  };
}

export async function getBootstrap(): Promise<BootstrapData> {
  const response = await fetch("/api/bootstrap");
  if (!response.ok) {
    throw new Error("无法连接本地数据服务");
  }
  const data = (await response.json()) as BootstrapData;
  localToken = data.token;
  return data;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  if (method !== "GET" && !localToken) {
    await getBootstrap();
  }

  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }
  if (method !== "GET" && localToken) {
    headers.set("x-app-token", localToken);
  }

  const response = await fetch(path, { ...options, headers });
  if (!response.ok) {
    let message = "操作失败，请稍后重试";
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // Keep the stable user-facing fallback.
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
