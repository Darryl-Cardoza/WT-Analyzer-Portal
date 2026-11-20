import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SessionError } from "./api";

interface Settled<T, A> {
  load: ((arg: A) => Promise<T>) | null; // which request this answer belongs to
  arg: A | undefined;
  data: T | null;
  error: Error | null;
}

/**
 * Runs `load(arg)` in the browser and returns its answer. `load` is a module-level function and `arg` a plain value
 * (a string), so a new request happens exactly when one of them changes and no memoizing is needed in the caller.
 * An ended session goes to the login page with the expired notice instead of returning an error.
 * `loading` is true until the answer to the *current* request is in, so a new request never shows the previous one's data.
 */
export function useApi<T, A = undefined>(load: (arg: A) => Promise<T>, arg?: A): { data: T | null; error: Error | null; loading: boolean } {
  const { replace } = useRouter();
  const [state, setState] = useState<Settled<T, A>>({ load: null, arg: undefined, data: null, error: null });

  useEffect(() => {
    let current = true;
    load(arg as A).then(
      (data) => {
        if (current) setState({ load, arg, data, error: null });
      },
      (e: unknown) => {
        if (!current) return;
        if (e instanceof SessionError) replace("/login?reason=expired");
        else setState({ load, arg, data: null, error: e instanceof Error ? e : new Error(String(e)) });
      },
    );
    return () => {
      current = false; // a late answer to a replaced request is ignored
    };
  }, [load, arg, replace]);

  const settled = state.load === load && Object.is(state.arg, arg);
  return { data: settled ? state.data : null, error: settled ? state.error : null, loading: !settled };
}
