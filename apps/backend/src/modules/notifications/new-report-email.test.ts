import request from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp } from "../../../test/helpers/app.js";
import { addSociety, addUser, sessionCookie } from "../../../test/helpers/factories.js";
import { makeJpeg } from "../../../test/helpers/images.js";
import { chooseRecipients } from "./notifications.service.js";
import { newReportEmail } from "./templates/new-report.js";

/** An admin (in no society). Green Park: two active managers, one disabled, one invited, a resident. Lake View: a manager. */
async function setup() {
  const ctx = createTestApp();
  const { store, clock } = ctx;
  const greenPark = addSociety(store, { name: "Green Park Residency" });
  const lakeView = addSociety(store, { name: "Lake View Towers" });
  const admin = await addUser(store, { role: "ADMIN", name: "Asha Rao", email: "asha@greenpark.example" });
  const rohit = await addUser(store, { role: "MANAGER", societyId: greenPark.id, name: "Rohit Sharma", email: "rohit@greenpark.example" });
  const kavya = await addUser(store, { role: "MANAGER", societyId: greenPark.id, name: "Kavya Nair", email: "kavya@greenpark.example" });
  await addUser(store, { role: "MANAGER", societyId: greenPark.id, status: "DISABLED", email: "old.manager@greenpark.example" });
  await addUser(store, { role: "MANAGER", societyId: greenPark.id, status: "INVITED", email: "new.manager@greenpark.example" });
  const meera = await addUser(store, { role: "RESIDENT", societyId: greenPark.id, name: "Meera Iyer", email: "meera@greenpark.example" });
  await addUser(store, { role: "MANAGER", societyId: lakeView.id, email: "manager@lakeview.example" });
  const cookie = (userId: string) => sessionCookie(store, userId, clock.now);
  return { ...ctx, greenPark, admin, rohit, kavya, meera, asMeera: cookie(meera.id), asRohit: cookie(rohit.id), cookie };
}

const fields = {
  title: "Streetlight out near Block C",
  description: "The pole light facing the Block C gate has been off for a week.\nThe path is dark after 7 pm.",
  category: "STREETLIGHTS",
  locationText: "Block C main gate",
};

function postReport(app: Parameters<typeof request>[0], cookie: string, overrides: Record<string, string> = {}) {
  return request(app)
    .post("/api/reports")
    .set("Cookie", cookie)
    .field({ ...fields, ...overrides })
    .attach("photo", makeJpeg(), { filename: "light.jpg", contentType: "image/jpeg" });
}

describe("new-report email", () => {
  it("emails each active manager of the report's society, one message per person", async () => {
    const { app, asMeera, emailSender, backgroundTasks } = await setup();

    const res = await postReport(app, asMeera);
    expect(res.status).toBe(201);
    expect(res.body).not.toHaveProperty("meta");
    await backgroundTasks.idle();

    expect(emailSender.sent.map((m) => m.to)).toEqual(["rohit@greenpark.example", "kavya@greenpark.example"]);
    const [toRohit] = emailSender.sent;
    expect(toRohit?.subject).toBe("[MyArea] Green Park Residency: New report: Streetlight out near Block C (Streetlights)");
    expect(toRohit?.text).toContain("Hi Rohit Sharma,");
    expect(toRohit?.text).toContain("Meera Iyer reported a new issue in Green Park Residency.");
    expect(toRohit?.text).toContain("Location: Block C main gate");
    expect(toRohit?.text).toContain(`Open the report, with its photo: http://localhost:3000/reports/${res.body.data.id}`);
  });

  it("doesn't email a manager about their own report", async () => {
    const { app, asRohit, emailSender, backgroundTasks } = await setup();
    await postReport(app, asRohit);
    await backgroundTasks.idle();
    expect(emailSender.sent.map((m) => m.to)).toEqual(["kavya@greenpark.example"]);
  });

  it("emails nobody, not even an admin, and logs a warning when the society has no active manager", async () => {
    const { app, store, asMeera, rohit, kavya, emailSender, backgroundTasks, logger } = await setup();
    store.users.get(rohit.id)!.status = "DISABLED";
    store.users.get(kavya.id)!.role = "RESIDENT";

    const res = await postReport(app, asMeera);
    await backgroundTasks.idle();

    expect(res.status).toBe(201);
    expect(emailSender.sent).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith("new-report email not sent: no active manager to notify", { reportId: res.body.data.id });
  });

  it("keeps sending to the others when one address fails, and logs without the address", async () => {
    const { app, asMeera, emailSender, backgroundTasks, logger, rohit } = await setup();
    emailSender.failFor.add("rohit@greenpark.example");

    const res = await postReport(app, asMeera);
    await backgroundTasks.idle();

    expect(res.status).toBe(201);
    expect(emailSender.sent.map((m) => m.to)).toEqual(["kavya@greenpark.example"]);
    expect(logger.warn).toHaveBeenCalledWith("new-report email failed", {
      reportId: res.body.data.id,
      userId: rohit.id,
      err: expect.any(Error),
    });
  });

  it("answers the resident without waiting for the mail server", async () => {
    const { app, store, asMeera, emailSender } = await setup();
    emailSender.hang = true;

    const res = await postReport(app, asMeera);

    expect(res.status).toBe(201);
    expect(store.reports.size).toBe(1);
  });

  it("sends nothing when the report isn't saved", async () => {
    const { app, store, asMeera, emailSender, mediaStorage, backgroundTasks } = await setup();

    expect((await postReport(app, asMeera, { title: "Hi" })).status).toBe(400);
    store.failReportWrites = new Error("db down");
    expect((await postReport(app, asMeera)).status).toBe(500);
    store.failReportWrites = null;
    mediaStorage.failSaveWith = new Error("disk full");
    expect((await postReport(app, asMeera)).status).toBe(502);
    await backgroundTasks.idle();

    expect(emailSender.sent).toEqual([]);
  });
});

describe("chooseRecipients", () => {
  const managers = [
    { id: "m1", name: "M1", email: "m1@x" },
    { id: "m2", name: "M2", email: "m2@x" },
  ];

  it("is every manager but the reporter", () => {
    expect(chooseRecipients(managers, "resident").map((s) => s.id)).toEqual(["m1", "m2"]);
    expect(chooseRecipients(managers, "m1").map((s) => s.id)).toEqual(["m2"]);
    expect(chooseRecipients(managers.slice(0, 1), "m1")).toEqual([]);
  });
});

describe("newReportEmail", () => {
  const input = {
    recipientName: "Rohit Sharma",
    societyName: "Green Park Residency",
    reporterName: "Meera Iyer",
    title: "Water leak in basement",
    description: "Water drips near slot B-14.",
    category: "WATER_DRAINAGE" as const,
    locationText: "Basement, slot B-14",
    createdAt: new Date("2026-10-29T04:35:00.000Z"),
    link: "http://localhost:3000/reports/7d0f3c2e-8a51-4c43-9d55-2f4c6a1b9e10",
  };

  it("includes the category label, exact time in UTC and the link", () => {
    const { subject, text, html } = newReportEmail(input);
    expect(subject).toBe("[MyArea] Green Park Residency: New report: Water leak in basement (Water & drainage)");
    expect(text).toContain("Submitted: 29 Oct 2026, 04:35 UTC");
    expect(text).toContain("Water drips near slot B-14.");
    expect(html).toContain(`href="${input.link}"`);
  });

  it("escapes user-supplied text in the HTML part", () => {
    const { html } = newReportEmail({
      ...input,
      title: "<img src=x onerror=alert(1)>",
      description: "<script>steal()</script>",
      locationText: 'Gate "2" & lobby',
      reporterName: "<b>Meera</b>",
    });
    expect(html).not.toMatch(/<img|<script|<b>Meera/);
    expect(html).toContain("&lt;script&gt;steal()&lt;/script&gt;");
    expect(html).toContain("Gate &quot;2&quot; &amp; lobby");
  });
});
