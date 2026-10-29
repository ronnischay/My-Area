import { describe, expect, it } from "vitest";
import { insertSociety, insertUser, testDatabaseUrl, useTestDatabase } from "../../../test/helpers/db.js";
import { createNotificationsRepository } from "./notifications.repository.js";

describe.skipIf(!testDatabaseUrl)("notifications repository (PostgreSQL)", () => {
  const db = useTestDatabase();

  it("returns the society name and only its ACTIVE managers and admins, oldest first", async () => {
    const repo = createNotificationsRepository(db);
    const greenPark = await insertSociety(db, "Green Park Residency");
    const lakeView = await insertSociety(db, "Lake View Towers");
    const admin = await insertUser(db, { email: "asha@greenpark.example", role: "ADMIN", societyId: greenPark.id, name: "Asha Rao" });
    const manager = await insertUser(db, { email: "rohit@greenpark.example", role: "MANAGER", societyId: greenPark.id, name: "Rohit Sharma" });
    await insertUser(db, { email: "old@greenpark.example", role: "MANAGER", societyId: greenPark.id, status: "DISABLED" });
    await insertUser(db, { email: "new@greenpark.example", role: "MANAGER", societyId: greenPark.id, status: "INVITED" });
    await insertUser(db, { email: "meera@greenpark.example", role: "RESIDENT", societyId: greenPark.id });
    await insertUser(db, { email: "m@lakeview.example", role: "MANAGER", societyId: lakeView.id });

    expect(await repo.findSocietyStaff(greenPark.id)).toEqual({
      societyName: "Green Park Residency",
      staff: [
        { id: admin.id, name: "Asha Rao", email: "asha@greenpark.example", role: "ADMIN" },
        { id: manager.id, name: "Rohit Sharma", email: "rohit@greenpark.example", role: "MANAGER" },
      ],
    });
    expect(await repo.findSocietyStaff("7d0f3c2e-8a51-4c43-9d55-2f4c6a1b9e10")).toBeNull();
  });
});
