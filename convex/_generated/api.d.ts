/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as annualResults from "../annualResults.js";
import type * as assignments from "../assignments.js";
import type * as assignmentsActions from "../assignmentsActions.js";
import type * as assignmentsQueries from "../assignmentsQueries.js";
import type * as attendance from "../attendance.js";
import type * as attendanceQueries from "../attendanceQueries.js";
import type * as auditLog from "../auditLog.js";
import type * as authSession from "../authSession.js";
import type * as chats from "../chats.js";
import type * as classGroups from "../classGroups.js";
import type * as curriculumPlans from "../curriculumPlans.js";
import type * as dashboard from "../dashboard.js";
import type * as dayRegimes from "../dayRegimes.js";
import type * as deleteAllBadges from "../deleteAllBadges.js";
import type * as deleteAllBadgesHelpers from "../deleteAllBadgesHelpers.js";
import type * as diaryExports from "../diaryExports.js";
import type * as documents from "../documents.js";
import type * as events from "../events.js";
import type * as extracurricular from "../extracurricular.js";
import type * as fees from "../fees.js";
import type * as fileValidation from "../fileValidation.js";
import type * as fixUsers from "../fixUsers.js";
import type * as gradeDeleteRequests from "../gradeDeleteRequests.js";
import type * as grades from "../grades.js";
import type * as homework from "../homework.js";
import type * as inspections from "../inspections.js";
import type * as internalCommission from "../internalCommission.js";
import type * as lessons from "../lessons.js";
import type * as migrateBadgesHelpers from "../migrateBadgesHelpers.js";
import type * as migrateBadgesV2 from "../migrateBadgesV2.js";
import type * as nonSchoolDays from "../nonSchoolDays.js";
import type * as notifications from "../notifications.js";
import type * as parentMeetings from "../parentMeetings.js";
import type * as passwords from "../passwords.js";
import type * as platformSettings from "../platformSettings.js";
import type * as projectActivities from "../projectActivities.js";
import type * as rateLimiting from "../rateLimiting.js";
import type * as remedialExams from "../remedialExams.js";
import type * as reports from "../reports.js";
import type * as reviews from "../reviews.js";
import type * as runBadgeMigrationV2 from "../runBadgeMigrationV2.js";
import type * as sanctions from "../sanctions.js";
import type * as schedules from "../schedules.js";
import type * as statistics from "../statistics.js";
import type * as studentDocuments from "../studentDocuments.js";
import type * as studentSupport from "../studentSupport.js";
import type * as syncTeachersAction from "../syncTeachersAction.js";
import type * as teacherAbsences from "../teacherAbsences.js";
import type * as teacherExtraHours from "../teacherExtraHours.js";
import type * as terms from "../terms.js";
import type * as users from "../users.js";
import type * as usersActions from "../usersActions.js";
import type * as warehouse from "../warehouse.js";
import type * as weeklySchedules from "../weeklySchedules.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  annualResults: typeof annualResults;
  assignments: typeof assignments;
  assignmentsActions: typeof assignmentsActions;
  assignmentsQueries: typeof assignmentsQueries;
  attendance: typeof attendance;
  attendanceQueries: typeof attendanceQueries;
  auditLog: typeof auditLog;
  authSession: typeof authSession;
  chats: typeof chats;
  classGroups: typeof classGroups;
  curriculumPlans: typeof curriculumPlans;
  dashboard: typeof dashboard;
  dayRegimes: typeof dayRegimes;
  deleteAllBadges: typeof deleteAllBadges;
  deleteAllBadgesHelpers: typeof deleteAllBadgesHelpers;
  diaryExports: typeof diaryExports;
  documents: typeof documents;
  events: typeof events;
  extracurricular: typeof extracurricular;
  fees: typeof fees;
  fileValidation: typeof fileValidation;
  fixUsers: typeof fixUsers;
  gradeDeleteRequests: typeof gradeDeleteRequests;
  grades: typeof grades;
  homework: typeof homework;
  inspections: typeof inspections;
  internalCommission: typeof internalCommission;
  lessons: typeof lessons;
  migrateBadgesHelpers: typeof migrateBadgesHelpers;
  migrateBadgesV2: typeof migrateBadgesV2;
  nonSchoolDays: typeof nonSchoolDays;
  notifications: typeof notifications;
  parentMeetings: typeof parentMeetings;
  passwords: typeof passwords;
  platformSettings: typeof platformSettings;
  projectActivities: typeof projectActivities;
  rateLimiting: typeof rateLimiting;
  remedialExams: typeof remedialExams;
  reports: typeof reports;
  reviews: typeof reviews;
  runBadgeMigrationV2: typeof runBadgeMigrationV2;
  sanctions: typeof sanctions;
  schedules: typeof schedules;
  statistics: typeof statistics;
  studentDocuments: typeof studentDocuments;
  studentSupport: typeof studentSupport;
  syncTeachersAction: typeof syncTeachersAction;
  teacherAbsences: typeof teacherAbsences;
  teacherExtraHours: typeof teacherExtraHours;
  terms: typeof terms;
  users: typeof users;
  usersActions: typeof usersActions;
  warehouse: typeof warehouse;
  weeklySchedules: typeof weeklySchedules;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
