import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildDriveSourceRef,
  isDriveFileInConfiguredFolder,
} from "./google-drive-sync";

function makeProgress() {
  return {
    filesDiscovered: 0,
    filesProcessed: 0,
    filesFailed: 0,
    filesSkipped: 0,
    bytesDownloaded: 0,
    apiCalls: 0,
    errors: [] as string[],
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe("buildDriveSourceRef", () => {
  it("creates a stable source ref from the Drive file id", () => {
    expect(buildDriveSourceRef("file-123")).toBe("google-drive:file-123");
  });
});

describe("isDriveFileInConfiguredFolder", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("accepts direct children without extra Drive lookups", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await isDriveFileInConfiguredFolder(
      "token",
      {
        id: "file-1",
        name: "doc.txt",
        mimeType: "text/plain",
        parents: ["folder-1"],
      },
      "folder-1",
      false,
      makeProgress()
    );

    expect(result).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("walks ancestor folders when recursive sync is enabled", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ id: "child-folder", parents: ["root-folder"] })
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await isDriveFileInConfiguredFolder(
      "token",
      {
        id: "file-2",
        name: "nested.txt",
        mimeType: "text/plain",
        parents: ["child-folder"],
      },
      "root-folder",
      true,
      makeProgress()
    );

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects nested files when subfolders are disabled", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await isDriveFileInConfiguredFolder(
      "token",
      {
        id: "file-3",
        name: "nested.txt",
        mimeType: "text/plain",
        parents: ["child-folder"],
      },
      "root-folder",
      false,
      makeProgress()
    );

    expect(result).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
