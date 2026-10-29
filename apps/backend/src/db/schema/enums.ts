import { pgEnum } from "drizzle-orm/pg-core";
import { MEDIA_PURPOSES, MEDIA_TYPES, REPORT_CATEGORIES, REPORT_STATUSES } from "../../modules/reports/reports.types.js";
import { USER_ROLES, USER_STATUSES } from "../../modules/users/users.types.js";

// Values are mirrored in docs/API_CONTRACT.md §2 and frontend src/types/api.ts.
export const userRole = pgEnum("user_role", USER_ROLES);
export const userStatus = pgEnum("user_status", USER_STATUSES);
export const reportCategory = pgEnum("report_category", REPORT_CATEGORIES);
export const reportStatus = pgEnum("report_status", REPORT_STATUSES);
export const mediaType = pgEnum("media_type", MEDIA_TYPES);
export const mediaPurpose = pgEnum("media_purpose", MEDIA_PURPOSES);
