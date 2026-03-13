import assert from "node:assert/strict";
import { test } from "node:test";
import * as youtrack from "./youtrack.js";

const RUN_E2E = Boolean(process.env.YOUTRACK_E2E);

// To run against a real YouTrack instance, set these env vars:
//   YOUTRACK_E2E=1
//   YOUTRACK_TOKEN=perm-your-token-here
//   YOUTRACK_BASE=https://your-instance.youtrack.cloud/api
//   YOUTRACK_PROJECT_ID=0-1
//   YOUTRACK_PROJECT_SHORT=BIT

const skipReason =
  "Skipping YouTrack E2E tests (set YOUTRACK_E2E=1 and provide YOUTRACK_TOKEN to run).";

// NOTE: These tests mutate real data. They create an issue and delete it.

test("YouTrack E2E: create/update/stage/delete issue", {
  skip: !RUN_E2E,
}, async () => {
  const token = process.env.YOUTRACK_TOKEN;
  assert.ok(token, "YOUTRACK_TOKEN is required for E2E tests");

  const base = process.env.YOUTRACK_BASE || "https://your-instance.youtrack.cloud/api";
  const projectId = process.env.YOUTRACK_PROJECT_ID || "0-1";
  const projectShort = process.env.YOUTRACK_PROJECT_SHORT || "BIT";

  youtrack.setConfig({ base, projectId, projectShort });

  const summary = `E2E test ${Date.now()}`;
  const description = "Created by E2E test";

  const created = await youtrack.createIssue(token, {
    summary,
    description,
    priority: "Normal",
  });
  assert.ok(created.id, "created issue must have an id");

  // Update title + description
  const updatedSummary = summary + " (updated)";
  const updatedDesc = description + " (updated)";
  await youtrack.updateIssue(token, created.id, {
    summary: updatedSummary,
    description: updatedDesc,
  });

  // Update stage + priority
  await youtrack.updateCustomField(token, created.id, "Stage", "Test");
  await youtrack.updateCustomField(token, created.id, "Priority", "Major");

  const fetched = await youtrack.fetchIssue(token, created.id);
  assert.strictEqual(fetched.summary, updatedSummary);

  const stage = youtrack.getCustomFieldValue(fetched, "Stage");
  assert.strictEqual(stage, "Test", `expected stage to be 'Test', got '${stage}'`);

  const prio = youtrack.getCustomFieldValue(fetched, "Priority");
  assert.strictEqual(prio, "Major", `expected priority to be 'Major', got '${prio}'`);

  // Cleanup
  await youtrack.deleteIssue(token, created.id);
});

test("YouTrack E2E: skipped", () => {
  if (!RUN_E2E) test.skip(skipReason);
});
