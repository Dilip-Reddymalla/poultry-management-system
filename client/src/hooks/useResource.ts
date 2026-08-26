import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "../api/client.js";

export interface Resource<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  reload: () => void;
  /** Write a fresher copy in after a mutation instead of refetching. */
  replace: (data: T) => void;
}

interface Settled<T> {
  key: string;
  token: number;
  data: T | null;
  error: ApiError | null;
}

/**
 * One read of one resource. `key` is what identifies the request — change it
 * (filters, id, page) and the data reloads; the fetcher itself can be inline.
 *
 * `loading` is derived from whether the settled answer matches the key being
 * asked for, so the effect only ever writes state once the request finishes.
 */
export function useResource<T>(
  key: string,
  fetcher: (signal: AbortSignal) => Promise<T>,
  options: { enabled?: boolean } = {},
): Resource<T> {
  const enabled = options.enabled ?? true;

  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const [token, setToken] = useState(0);

  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const controller = new AbortController();

    fetcherRef
      .current(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setSettled({ key, token, data, error: null });
        }
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setSettled({
          key,
          token,
          data: null,
          error:
            caught instanceof ApiError
              ? caught
              : new ApiError(0, "Something went wrong."),
        });
      });

    return () => {
      controller.abort();
    };
  }, [key, token, enabled]);

  const reload = useCallback(() => {
    setToken((current) => current + 1);
  }, []);

  const replace = useCallback(
    (data: T) => {
      setSettled({ key, token, data, error: null });
    },
    [key, token],
  );

  const fresh = settled !== null && settled.key === key && settled.token === token;

  return {
    data: settled?.data ?? null,
    error: settled?.error ?? null,
    loading: enabled && !fresh,
    reload,
    replace,
  };
}
