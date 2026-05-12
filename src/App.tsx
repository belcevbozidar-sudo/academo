import { Suspense } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { DefaultProviders } from "./components/providers/default.tsx";
import LocaleWrapper from "./components/providers/locale-wrapper.tsx";
import { SAVED_OR_DEFAULT_LOCALE, setLocaleInPath } from "./i18n.ts";
import "./i18n.ts";
import AuthCallback from "./pages/auth/Callback.tsx";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";

// Admin pages
import Classes from "./pages/admin/Classes.tsx";
import AddClassPage from "./pages/admin/AddClassPage.tsx";
import EditClassPage from "./pages/admin/EditClassPage.tsx";
import ClassesList from "./pages/admin/ClassesList.tsx";
import ClassDetails from "./pages/admin/ClassDetails.tsx";
import Subjects from "./pages/admin/Subjects.tsx";
import AddSubjectPage from "./pages/admin/AddSubjectPage.tsx";
import EditSubjectPage from "./pages/admin/EditSubjectPage.tsx";
import SubjectDetails from "./pages/admin/SubjectDetails.tsx";
import Users from "./pages/admin/Users.tsx";
import AddUserPage from "./pages/admin/AddUserPage.tsx";
import EditUserPage from "./pages/admin/EditUserPage.tsx";
import ImportUsersPage from "./pages/admin/ImportUsersPage.tsx";
import ImportStudentsParentsPage from "./pages/admin/ImportStudentsParentsPage.tsx";
import UserProfile from "./pages/admin/UserProfile.tsx";
import AdminProfile from "./pages/admin/AdminProfile.tsx";
import CurriculumPlans from "./pages/admin/CurriculumPlans.tsx";
import AddEditCurriculumPlan from "./pages/admin/AddEditCurriculumPlan.tsx";
import NonSchoolDays from "./pages/admin/NonSchoolDays.tsx";
import School from "./pages/admin/School.tsx";
import BadgeMigration from "./pages/admin/BadgeMigration.tsx";
import DeleteAllBadges from "./pages/admin/DeleteAllBadges.tsx";
import AdminDayRegimes from "./pages/admin/DayRegimes.tsx";
import AddDayRegime from "./pages/admin/AddDayRegime.tsx";
import AcademicTerms from "./pages/admin/AcademicTerms.tsx";
import EditAcademicTermsPage from "./pages/admin/EditAcademicTermsPage.tsx";
import PlatformSettings from "./pages/admin/PlatformSettings.tsx";
import ModuleSettings from "./pages/admin/ModuleSettings.tsx";
import Requests from "./pages/admin/Requests.tsx";

// Fees pages
import AllFees from "./pages/fees/AllFees.tsx";
import AddFee from "./pages/fees/AddFee.tsx";
import AllBankAccounts from "./pages/fees/AllBankAccounts.tsx";
import AddBankAccount from "./pages/fees/AddBankAccount.tsx";
import EditBankAccount from "./pages/fees/EditBankAccount.tsx";

// Events pages
import AllEvents from "./pages/events/AllEvents.tsx";
import AllEventsPage from "./pages/events/AllEventsPage.tsx";
import MyInvitations from "./pages/events/MyInvitations.tsx";
import AllEventsNew from "./pages/events/AllEventsNew.tsx";
import AddEventPage from "./pages/events/AddEventPage.tsx";
import EditEventPage from "./pages/events/EditEventPage.tsx";
import SchoolCalendar from "./pages/events/SchoolCalendar.tsx";

// Competitions pages
import AllCompetitions from "./pages/competitions/AllCompetitions.tsx";
import CompetitionResults from "./pages/competitions/CompetitionResults.tsx";
import StudentCompetitions from "./pages/competitions/StudentCompetitions.tsx";

// Diary pages
import ClassSchedule from "./pages/diary/ClassSchedule.tsx";
import MyLesson from "./pages/diary/MyLesson.tsx";
import LessonDetails from "./pages/diary/LessonDetails.tsx";
import LessonRedirect from "./pages/diary/LessonRedirect.tsx";
import ClassGrades from "./pages/diary/ClassGrades.tsx";
import ClassAbsences from "./pages/diary/ClassAbsences.tsx";
import ClassReviews from "./pages/diary/ClassReviews.tsx";
import AddWeeklySchedule from "./pages/diary/AddWeeklySchedule.tsx";
import ClassTopics from "./pages/diary/ClassTopics.tsx";
import ClassTests from "./pages/diary/ClassTests.tsx";
import ClassParentMeetings from "./pages/diary/ClassParentMeetings.tsx";
import ClassSanctions from "./pages/diary/ClassSanctions.tsx";
import ClassStudents from "./pages/diary/ClassStudents.tsx";
import StudentSupportPage from "./pages/diary/StudentSupportPage.tsx";
import AddStudentSupportPage from "./pages/diary/AddStudentSupportPage.tsx";
import InternalCommissionPage from "./pages/diary/InternalCommissionPage.tsx";
import AnnualResultsPage from "./pages/diary/AnnualResultsPage.tsx";
import ClassHomework from "./pages/diary/ClassHomework.tsx";
import RemedialExamsPage from "./pages/diary/RemedialExamsPage.tsx";
import AddParentMeetingPage from "./pages/diary/AddParentMeetingPage.tsx";
import EditParentMeetingPage from "./pages/diary/EditParentMeetingPage.tsx";

// Documents pages
import DiaryExports from "./pages/documents/DiaryExports.tsx";
import StudentDocuments from "./pages/documents/StudentDocuments.tsx";

// Schedules pages
import DayRegimes from "./pages/schedules/DayRegimes.tsx";
import WeeklySchedules from "./pages/schedules/WeeklySchedules.tsx";

// Statistics pages
import GradesAndSchool from "./pages/statistics/GradesAndSchool.tsx";
import StudentStatisticsPage from "./pages/statistics/StudentStatisticsPage.tsx";
import MyHours from "./pages/statistics/MyHours.tsx";

// Inspection pages
import InspectionPage from "./pages/inspection/InspectionPage.tsx";

// Profile pages
import Profile from "./pages/profile/Profile.tsx";
import UserSchedule from "./pages/profile/UserSchedule.tsx";

// Messages pages
import Messages from "./pages/messages/Messages.tsx";

// Notifications pages
import NotificationsPage from "./pages/NotificationsPage.tsx";

// Tasks pages
import MyTasks from "./pages/tasks/MyTasks.tsx";
import TaskDetail from "./pages/tasks/TaskDetail.tsx";
import ReceivedTasks from "./pages/tasks/ReceivedTasks.tsx";
import AllTasks from "./pages/tasks/AllTasks.tsx";
import ProjectActivities from "./pages/tasks/ProjectActivities.tsx";
import AddProjectActivity from "./pages/tasks/AddProjectActivity.tsx";
import ViewProjectActivity from "./pages/tasks/ViewProjectActivity.tsx";

// Lecture Hours pages
import MyAbsences from "./pages/lecture-hours/MyAbsences.tsx";
import MySubstitutions from "./pages/lecture-hours/MySubstitutions.tsx";
import AllAbsences from "./pages/lecture-hours/AllAbsences.tsx";
import AllAbsencesNew from "./pages/lecture-hours/AllAbsencesNew.tsx";
import AddAbsence from "./pages/lecture-hours/AddAbsence.tsx";
import AbsenceDetails from "./pages/lecture-hours/AbsenceDetails.tsx";
import MyExtraHours from "./pages/lecture-hours/MyExtraHours.tsx";
import AllExtraHours from "./pages/lecture-hours/AllExtraHours.tsx";

// Extracurricular pages
import MyActivities from "./pages/extracurricular/MyActivities.tsx";
import AllActivities from "./pages/extracurricular/AllActivities.tsx";

// Dialog-to-page conversions
import AddNonSchoolDayPage from "./pages/admin/AddNonSchoolDayPage.tsx";
import EditNonSchoolDayPage from "./pages/admin/EditNonSchoolDayPage.tsx";
import EditSchoolBasicPage from "./pages/admin/EditSchoolBasicPage.tsx";
import AddReviewPage from "./pages/diary/AddReviewPage.tsx";
import AddTestPage from "./pages/diary/AddTestPage.tsx";
import ChangePasswordPage from "./pages/profile/ChangePasswordPage.tsx";
import Enable2FAPage from "./pages/profile/Enable2FAPage.tsx";
import Disable2FAPage from "./pages/profile/Disable2FAPage.tsx";
import NewDirectChatPage from "./pages/messages/NewDirectChatPage.tsx";
import CreateGroupPage from "./pages/messages/CreateGroupPage.tsx";

// Reports pages
import ReportsPage from "./pages/reports/ReportsPage.tsx";
import NewReportPage from "./pages/reports/NewReportPage.tsx";
import ReportDetailPage from "./pages/reports/ReportDetailPage.tsx";

export default function App() {
  return (
    <DefaultProviders>
      <BrowserRouter>
        <Suspense fallback={<div></div>}>
          <Routes>
            {/* Root: redirect to saved/default locale */}
            <Route
              path="/"
              element={
                <Navigate
                  to={setLocaleInPath(SAVED_OR_DEFAULT_LOCALE, "/")}
                  replace
                />
              }
            />

            {/* Non-localized routes (auth, webhooks, etc.) */}
            <Route path="/auth/callback" element={<AuthCallback />} />

            {/* All localized routes under /:lng */}
            <Route
              path="/:lng"
              element={
                <LocaleWrapper>
                  <Outlet />
                </LocaleWrapper>
              }
            >
              <Route index element={<Index />} />
              
              {/* Admin routes */}
              <Route path="admin/classes" element={<Classes />} />
              <Route path="admin/classes/add" element={<AddClassPage />} />
              <Route path="admin/classes/edit/:classId" element={<EditClassPage />} />
              <Route path="admin/classes/:classId" element={<ClassDetails />} />
              <Route path="admin/classes-list" element={<ClassesList />} />
              <Route path="admin/subjects" element={<Subjects />} />
              <Route path="admin/subjects/add" element={<AddSubjectPage />} />
              <Route path="admin/subjects/edit/:subjectId" element={<EditSubjectPage />} />
              <Route path="admin/subjects/:subjectId" element={<SubjectDetails />} />
              <Route path="admin/users" element={<Users />} />
              <Route path="admin/users/add" element={<AddUserPage />} />
              <Route path="admin/users/import" element={<ImportUsersPage />} />
              <Route path="admin/users/import-students-parents" element={<ImportStudentsParentsPage />} />
              <Route path="admin/users/edit/:userId" element={<EditUserPage />} />
              <Route path="admin/user/:userId" element={<UserProfile />} />
              <Route path="admin/user/:userId/admin-profile" element={<AdminProfile />} />
              <Route path="admin/curriculum-plans" element={<CurriculumPlans />} />
              <Route path="admin/curriculum-plans/add" element={<AddEditCurriculumPlan />} />
              <Route path="admin/curriculum-plans/edit/:planId" element={<AddEditCurriculumPlan />} />
              <Route path="admin/non-school-days" element={<NonSchoolDays />} />
              <Route path="admin/non-school-days/add" element={<AddNonSchoolDayPage />} />
              <Route path="admin/non-school-days/edit/:id" element={<EditNonSchoolDayPage />} />
              <Route path="admin/school" element={<School />} />
              <Route path="admin/school/edit-basic" element={<EditSchoolBasicPage />} />
              <Route path="admin/badge-migration" element={<BadgeMigration />} />
              <Route path="admin/delete-all-badges" element={<DeleteAllBadges />} />
              <Route path="admin/day-regimes" element={<AdminDayRegimes />} />
              <Route path="admin/day-regimes/add" element={<AddDayRegime />} />
              <Route path="admin/day-regimes/edit/:id" element={<AddDayRegime />} />
              <Route path="admin/academic-terms" element={<AcademicTerms />} />
              <Route path="admin/academic-terms/edit" element={<EditAcademicTermsPage />} />
              <Route path="admin/settings" element={<PlatformSettings />} />
              <Route path="admin/modules" element={<ModuleSettings />} />
              <Route path="admin/requests" element={<Requests />} />
              
              {/* Fees routes */}
              <Route path="fees/all-fees" element={<AllFees />} />
              <Route path="fees/add" element={<AddFee />} />
              <Route path="fees/bank-accounts" element={<AllBankAccounts />} />
              <Route path="fees/bank-accounts/add" element={<AddBankAccount />} />
              <Route path="fees/bank-accounts/:id/edit" element={<EditBankAccount />} />
              
              {/* Events routes */}
              <Route path="events/all-events" element={<AllEvents />} />
              <Route path="events/add" element={<AddEventPage />} />
              <Route path="events/edit/:eventId" element={<EditEventPage />} />
              <Route path="events/list" element={<AllEventsPage />} />
              <Route path="events/my-invitations" element={<MyInvitations />} />
              <Route path="events/all-events-new" element={<AllEventsNew />} />
              <Route path="events/calendar" element={<SchoolCalendar />} />
              
              {/* Competitions routes */}
              <Route path="competitions/student" element={<StudentCompetitions />} />
              <Route path="competitions/all" element={<AllCompetitions />} />
              <Route path="competitions/results" element={<CompetitionResults />} />
              
              {/* Diary routes */}
              <Route path="diary/class-schedule" element={<ClassSchedule />} />
              <Route path="diary/my-lesson" element={<MyLesson />} />
              <Route path="diary/lesson" element={<LessonRedirect />} />
              <Route path="diary/lesson/:lessonId" element={<LessonDetails />} />
              <Route path="diary/class/:classId" element={<Navigate to="grades" replace />} />
              <Route path="diary/class/:classId/grades" element={<ClassGrades />} />
              <Route path="diary/class/:classId/absences" element={<ClassAbsences />} />
              <Route path="diary/class/:classId/reviews" element={<ClassReviews />} />
              <Route path="diary/class/:classId/reviews/add" element={<AddReviewPage />} />
              <Route path="diary/class/:classId/topics" element={<ClassTopics />} />
              <Route path="diary/class/:classId/tests" element={<ClassTests />} />
              <Route path="diary/class/:classId/tests/add" element={<AddTestPage />} />
              <Route path="diary/class/:classId/tests/edit/:testId" element={<AddTestPage />} />
              <Route path="diary/class/:classId/homework" element={<ClassHomework />} />
              <Route path="diary/class/:classId/parent-meetings" element={<ClassParentMeetings />} />
              <Route path="diary/class/:classId/parent-meetings/add" element={<AddParentMeetingPage />} />
              <Route path="diary/class/:classId/parent-meetings/edit/:meetingId" element={<EditParentMeetingPage />} />
              <Route path="diary/class/:classId/remedial-exams" element={<RemedialExamsPage />} />
              <Route path="diary/class/:classId/student-support" element={<StudentSupportPage />} />
              <Route path="diary/class/:classId/student-support/add" element={<AddStudentSupportPage />} />
              <Route path="diary/class/:classId/internal-commission" element={<InternalCommissionPage />} />
              <Route path="diary/class/:classId/sanctions" element={<ClassSanctions />} />
              <Route path="diary/class/:classId/annual-results" element={<AnnualResultsPage />} />
              <Route path="diary/class/:classId/students" element={<ClassStudents />} />
              <Route path="diary/class/:classId/schedule" element={<ClassSchedule />} />
              <Route path="diary/class/:classId/schedule/add" element={<AddWeeklySchedule />} />
              <Route path="diary/class/:classId/schedule/edit/:scheduleId" element={<AddWeeklySchedule />} />
              
              {/* Documents routes */}
              <Route path="documents/diary-exports" element={<DiaryExports />} />
              <Route path="documents/student-documents" element={<StudentDocuments />} />
              
              {/* Schedules routes */}
              <Route path="schedules/day-regimes" element={<DayRegimes />} />
              <Route path="schedules/weekly-schedules" element={<WeeklySchedules />} />
              
              {/* Statistics routes */}
              <Route path="statistics/grades-and-school" element={<GradesAndSchool />} />
              <Route path="statistics/student/:userId" element={<StudentStatisticsPage />} />
              <Route path="statistics/my-hours" element={<MyHours />} />
              
              {/* Curriculum Plans route */}
              <Route path="curriculum-plans" element={<CurriculumPlans />} />
              
              {/* Inspection routes */}
              <Route path="inspection" element={<InspectionPage />} />
              
              {/* Profile routes */}
              <Route path="profile" element={<Profile />} />
              <Route path="profile/:userId" element={<Profile />} />
              <Route path="profile/:userId/schedule" element={<UserSchedule />} />
              <Route path="profile/change-password" element={<ChangePasswordPage />} />
              <Route path="profile/enable-2fa" element={<Enable2FAPage />} />
              <Route path="profile/disable-2fa" element={<Disable2FAPage />} />
              
              {/* Messages routes */}
              <Route path="messages" element={<Messages />} />
              <Route path="messages/new-chat" element={<NewDirectChatPage />} />
              <Route path="messages/create-group" element={<CreateGroupPage />} />
              
              {/* Notifications route */}
              <Route path="notifications" element={<NotificationsPage />} />
              
              {/* Tasks routes */}
              <Route path="tasks/my-tasks" element={<MyTasks />} />
              <Route path="tasks/my-tasks/:taskId" element={<TaskDetail />} />
              <Route path="tasks/received-tasks" element={<ReceivedTasks />} />
              <Route path="tasks/all-tasks" element={<AllTasks />} />
              <Route path="tasks/project-activities" element={<ProjectActivities />} />
              <Route path="tasks/project-activities/add" element={<AddProjectActivity />} />
              <Route path="tasks/project-activities/edit/:activityId" element={<AddProjectActivity />} />
              <Route path="tasks/project-activities/view/:activityId" element={<ViewProjectActivity />} />
              
              {/* Lecture Hours routes */}
              <Route path="lecture-hours/my-absences" element={<MyAbsences />} />
              <Route path="lecture-hours/my-substitutions" element={<MySubstitutions />} />
              <Route path="lecture-hours/all-absences" element={<AllAbsences />} />
              <Route path="lecture-hours/all-absences-new" element={<AllAbsencesNew />} />
              <Route path="lecture-hours/add-absence" element={<AddAbsence />} />
              <Route path="lecture-hours/absence-schedule/:absenceId" element={<AbsenceDetails />} />
              <Route path="lecture-hours/my-extra" element={<MyExtraHours />} />
              <Route path="lecture-hours/all-extra" element={<AllExtraHours />} />
              
              {/* Extracurricular routes */}
              <Route path="extracurricular/my-activities" element={<MyActivities />} />
              <Route path="extracurricular/my-activities/:id" element={<MyActivities />} />
              <Route path="extracurricular/all-activities" element={<AllActivities />} />
              <Route path="extracurricular/all-activities/add" element={<AllActivities />} />
              <Route path="extracurricular/all-activities/:id" element={<AllActivities />} />
              
              {/* Reports routes */}
              <Route path="reports" element={<ReportsPage />} />
              <Route path="reports/new" element={<NewReportPage />} />
              <Route path="reports/:reportId" element={<ReportDetailPage />} />
              
              {/* ADD ALL ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </DefaultProviders>
  );
}
