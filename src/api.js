export async function apiFetch(path, options = {}) {
  const { timeoutMs, ...fetchOptions } = options;
  const mergedHeaders = {
    "Content-Type": "application/json",
    ...(fetchOptions.headers ?? {}),
  };
  const controller = fetchOptions.signal ? null : new AbortController();
  const timeoutId = controller
    ? window.setTimeout(() => controller.abort(), Number(timeoutMs ?? 8000))
    : null;

  let response;
  try {
    response = await fetch(path, {
      ...fetchOptions,
      headers: mergedHeaders,
      signal: controller ? controller.signal : fetchOptions.signal,
    });
  } catch (error) {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
    if (error?.name === "AbortError") {
      const timeoutError = new Error("Request timed out. Please try again.");
      timeoutError.status = 408;
      throw timeoutError;
    }
    throw error;
  } finally {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  }

  if (response.status === 204) {
    return null;
  }

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.message || "Request failed.");
    error.status = response.status;
    throw error;
  }

  return data;
}

export function adminFetch(path, token, options = {}) {
  return apiFetch(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });
}
