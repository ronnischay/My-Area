import { describe, expect, it } from "vitest";
import { createFakeLogger } from "../../test/helpers/app.js";
import { createBackgroundTasks } from "./background-tasks.js";

describe("createBackgroundTasks", () => {
  it("runs tasks after the current code and waits for all of them in idle()", async () => {
    const tasks = createBackgroundTasks(createFakeLogger());
    const done: string[] = [];

    tasks.run("a", async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      done.push("a");
      // A task started while another is running is awaited too.
      tasks.run("c", async () => {
        done.push("c");
      });
    });
    tasks.run("b", async () => {
      done.push("b");
    });
    expect(done).toEqual([]);

    await tasks.idle();
    expect(done.sort()).toEqual(["a", "b", "c"]);
  });

  it("logs a failed task instead of throwing", async () => {
    const logger = createFakeLogger();
    const tasks = createBackgroundTasks(logger);
    const err = new Error("smtp down");

    tasks.run("new-report email", async () => {
      throw err;
    });
    await tasks.idle();

    expect(logger.error).toHaveBeenCalledWith("background task failed", { task: "new-report email", err });
  });
});
