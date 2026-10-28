import { pgEnum } from "drizzle-orm/pg-core";
import { USER_ROLES, USER_STATUSES } from "../../modules/users/users.types.js";

// Values are mirrored in docs/API_CONTRACT.md §2 and frontend src/types/api.ts.
export const userRole = pgEnum("user_role", USER_ROLES);
export const userStatus = pgEnum("user_status", USER_STATUSES);
