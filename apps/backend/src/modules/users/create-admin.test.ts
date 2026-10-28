import request from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp } from "../../../test/helpers/app.js";
import { fastPasswordHasher } from "../../../test/helpers/factories.js";
import { createFakeUsersRepository } from "../../../test/helpers/fakes.js";
import { CreateAdminError, createAdminAccount } from "./create-admin.js";

describe("createAdminAccount", () => {
  it("creates an ACTIVE admin without a society who can then sign in", async () => {
    const { app, store } = createTestApp();
    const deps = { repository: createFakeUsersRepository(store), passwordHasher: fastPasswordHasher };

    const { id, email } = await createAdminAccount(deps, {
      email: " Asha.Rao@GreenPark.example ",
      name: "Asha Rao",
      password: "a strong admin password",
    });

    expect(email).toBe("asha.rao@greenpark.example");
    expect(store.users.get(id)).toMatchObject({ role: "ADMIN", status: "ACTIVE", societyId: null });

    const login = await request(app).post("/api/auth/login").send({ email, password: "a strong admin password" });
    expect(login.status).toBe(200);
    expect(login.body.data).toMatchObject({ role: "ADMIN", society: null });
  });

  it("rejects invalid input and duplicate emails with readable messages", async () => {
    const { store } = createTestApp();
    const deps = { repository: createFakeUsersRepository(store), passwordHasher: fastPasswordHasher };

    await expect(createAdminAccount(deps, { email: "nope", name: "A", password: "short" })).rejects.toThrow(
      /email: Enter a valid email address\nname: Name must be at least 2 characters\npassword: Password must be at least 10 characters/,
    );

    await createAdminAccount(deps, { email: "asha@example.com", name: "Asha Rao", password: "a strong admin password" });
    await expect(
      createAdminAccount(deps, { email: "ASHA@example.com", name: "Asha Again", password: "another strong password" }),
    ).rejects.toThrow(new CreateAdminError("email: asha@example.com already has a MyArea account"));
  });
});
