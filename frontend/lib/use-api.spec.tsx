// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

import { ApiError, SessionError } from "./api";
import { useApi } from "./use-api";

beforeEach(() => vi.clearAllMocks());

describe("useApi", () => {
  it("is loading first, then has the data", async () => {
    const load = vi.fn(async () => "answer");
    const { result } = renderHook(() => useApi(load));
    expect(result.current).toEqual({ data: null, error: null, loading: true });
    await waitFor(() => expect(result.current).toEqual({ data: "answer", error: null, loading: false }));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("hands back the error, not loading, when the request fails", async () => {
    const failure = new ApiError(500, "boom");
    const load = vi.fn(async () => {
      throw failure;
    });
    const { result } = renderHook(() => useApi(load));
    await waitFor(() => expect(result.current).toEqual({ data: null, error: failure, loading: false }));
    expect(replace).not.toHaveBeenCalled();
  });

  it("wraps something that is not an Error", async () => {
    const load = vi.fn(async () => {
      throw "plain string";
    });
    const { result } = renderHook(() => useApi(load));
    await waitFor(() => expect(result.current.error?.message).toBe("plain string"));
  });

  it("goes to the login page with the expired notice when the session has ended, and shows no error", async () => {
    const load = vi.fn(async () => {
      throw new SessionError();
    });
    const { result } = renderHook(() => useApi(load));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?reason=expired"));
    expect(result.current).toEqual({ data: null, error: null, loading: true });
  });

  it("starts loading again for a new request, never showing the previous request's data", async () => {
    let finish!: (v: string) => void;
    const first = async () => "first";
    const second = () => new Promise<string>((r) => (finish = r));
    const { result, rerender } = renderHook(({ load }) => useApi(load), { initialProps: { load: first as () => Promise<string> } });
    await waitFor(() => expect(result.current.data).toBe("first"));

    rerender({ load: second });
    expect(result.current).toEqual({ data: null, error: null, loading: true });
    await act(async () => finish("second"));
    await waitFor(() => expect(result.current.data).toBe("second"));
  });

  it("ignores a late answer to a request that has been replaced", async () => {
    let finishOld!: (v: string) => void;
    const old = () => new Promise<string>((r) => (finishOld = r));
    const next = async () => "new";
    const { result, rerender } = renderHook(({ load }) => useApi(load), { initialProps: { load: old as () => Promise<string> } });
    rerender({ load: next });
    await waitFor(() => expect(result.current.data).toBe("new"));
    await act(async () => finishOld("old"));
    expect(result.current.data).toBe("new");
  });
});

describe("useApi with an argument", () => {
  it("passes the argument to the loader", async () => {
    const load = vi.fn(async (id: string) => `alert ${id}`);
    const { result } = renderHook(() => useApi(load, "a1"));
    await waitFor(() => expect(result.current.data).toBe("alert a1"));
    expect(load).toHaveBeenCalledWith("a1");
  });

  it("asks again, and shows loading, when the argument changes, never the previous answer", async () => {
    let finish!: (v: string) => void;
    const load = vi.fn((id: string) => (id === "a1" ? Promise.resolve("first") : new Promise<string>((r) => (finish = r))));
    const { result, rerender } = renderHook(({ id }) => useApi(load, id), { initialProps: { id: "a1" } });
    await waitFor(() => expect(result.current.data).toBe("first"));

    rerender({ id: "a2" });
    expect(result.current).toEqual({ data: null, error: null, loading: true });
    await act(async () => finish("second"));
    await waitFor(() => expect(result.current.data).toBe("second"));
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not ask again when the same argument is rendered again", async () => {
    const load = vi.fn(async (id: string) => id);
    const { result, rerender } = renderHook(({ id }) => useApi(load, id), { initialProps: { id: "a1" } });
    await waitFor(() => expect(result.current.data).toBe("a1"));
    rerender({ id: "a1" });
    rerender({ id: "a1" });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("works without an argument", async () => {
    const load = vi.fn(async () => "x");
    const { result } = renderHook(() => useApi(load));
    await waitFor(() => expect(result.current.data).toBe("x"));
  });
});
