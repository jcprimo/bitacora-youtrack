import assert from "node:assert/strict";
import { test } from "node:test";
import * as youtrack from "./youtrack.js";

const DUMMY_TOKEN = "fake-token";

function makeFetchMock({ ok = true, status = 200, json = {}, validate }) {
  return async (url, opts) => {
    if (typeof validate === "function") validate(url, opts);
    return {
      ok,
      status,
      json: async () => json,
    };
  };
}

test("fetchIssues hits the correct endpoint and parses json", async () => {
  const expectedFields = [
    "idReadable",
    "id",
    "summary",
    "description",
    "created",
    "updated",
    "resolved",
    "customFields(name,value(name))",
  ].join(",");

  const mockJson = { data: "ok" };
  globalThis.fetch = makeFetchMock({
    json: mockJson,
    validate: (url, opts) => {
      const u = new URL(url, "http://example.com");
      assert.strictEqual(u.pathname, "/yt-api/issues");
      assert.strictEqual(u.searchParams.get("query"), "project: BIT sort by: updated desc");
      assert.strictEqual(u.searchParams.get("fields"), expectedFields);
      assert.strictEqual(opts.headers.Authorization, `Bearer ${DUMMY_TOKEN}`);
      assert.strictEqual(opts.method, undefined);
    },
  });

  const out = await youtrack.fetchIssues(DUMMY_TOKEN);
  assert.deepStrictEqual(out, mockJson);
});

test("fetchIssue hits the right URL and returns json", async () => {
  const issueId = "ABC-123";
  const mockJson = { id: issueId };
  globalThis.fetch = makeFetchMock({
    json: mockJson,
    validate: (url) => {
      assert.ok(url.includes(`/yt-api/issues/${issueId}?fields=`));
    },
  });

  const out = await youtrack.fetchIssue(DUMMY_TOKEN, issueId);
  assert.deepStrictEqual(out, mockJson);
});

test("createIssue posts correct payload", async () => {
  const payloadMatch = (bodyStr) => {
    const body = JSON.parse(bodyStr);
    assert.strictEqual(body.project.id, "0-1");
    assert.strictEqual(body.summary, "Test summary");
    assert.strictEqual(body.description, "Test description");
    assert.strictEqual(body.customFields[0].name, "Priority");
    assert.strictEqual(body.customFields[0].value.name, "Major");
  };

  globalThis.fetch = makeFetchMock({
    json: { id: "123" },
    validate: (url, opts) => {
      assert.strictEqual(url, "/yt-api/issues?fields=idReadable,id,summary");
      assert.strictEqual(opts.method, "POST");
      payloadMatch(opts.body);
    },
  });

  const out = await youtrack.createIssue(DUMMY_TOKEN, {
    summary: "Test summary",
    description: "Test description",
    priority: "Major",
  });
  assert.deepStrictEqual(out, { id: "123" });
});

test("updateIssue only sends provided fields", async () => {
  globalThis.fetch = makeFetchMock({
    json: { id: "456" },
    validate: (url, opts) => {
      assert.strictEqual(url, "/yt-api/issues/456?fields=idReadable,id,summary");
      const body = JSON.parse(opts.body);
      assert.strictEqual(body.summary, "New summary");
      assert.ok(!Object.prototype.hasOwnProperty.call(body, "description"));
    },
  });

  const out = await youtrack.updateIssue(DUMMY_TOKEN, "456", { summary: "New summary" });
  assert.deepStrictEqual(out, { id: "456" });
});

test("updateCustomField uses correct type for Stage and Priority", async () => {
  const validate = (url, opts, expectedType) => {
    const body = JSON.parse(opts.body);
    assert.strictEqual(body.customFields[0].$type, expectedType);
  };

  // Stage
  globalThis.fetch = makeFetchMock({
    json: { id: "1" },
    validate: (url, opts) => validate(url, opts, "StateIssueCustomField"),
  });
  await youtrack.updateCustomField(DUMMY_TOKEN, "1", "Stage", "Review");

  // Priority
  globalThis.fetch = makeFetchMock({
    json: { id: "1" },
    validate: (url, opts) => validate(url, opts, "SingleEnumIssueCustomField"),
  });
  await youtrack.updateCustomField(DUMMY_TOKEN, "1", "Priority", "Major");
});

test("executeCommand returns true when ok", async () => {
  globalThis.fetch = makeFetchMock({
    json: {},
    validate: (url, opts) => {
      assert.ok(url.endsWith("/commands"));
      assert.strictEqual(opts.method, "POST");
      const body = JSON.parse(opts.body);
      assert.strictEqual(body.query, "fix version 1.2.3");
    },
  });

  const ok = await youtrack.executeCommand(DUMMY_TOKEN, "ISSUE-1", "fix version 1.2.3");
  assert.strictEqual(ok, true);
});

test("deleteIssue returns true when ok", async () => {
  globalThis.fetch = makeFetchMock({
    json: {},
    validate: (url, opts) => {
      assert.ok(url.endsWith("/issues/ISSUE-1"));
      assert.strictEqual(opts.method, "DELETE");
    },
  });

  const ok = await youtrack.deleteIssue(DUMMY_TOKEN, "ISSUE-1");
  assert.strictEqual(ok, true);
});

test("getCustomFieldValue and formatDate helpers work", () => {
  const issue = {
    customFields: [
      { name: "Priority", value: { name: "Critical" } },
      { name: "Stage", value: { name: "Test" } },
    ],
  };
  assert.strictEqual(youtrack.getCustomFieldValue(issue, "Stage"), "Test");
  assert.strictEqual(youtrack.getCustomFieldValue(issue, "Missing"), null);

  assert.strictEqual(youtrack.formatDate(null), "—");
  const formatted = youtrack.formatDate(Date.UTC(2026, 2, 12, 10, 0));
  assert.strictEqual(typeof formatted, "string");
  assert.ok(formatted.includes("AM") || formatted.includes("PM"));
});
