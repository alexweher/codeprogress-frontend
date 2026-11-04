# CodeProgress API contract

Статус: **verified** по backend release `v1.0.0`, commit
`d90f5b85cf929c82b5292c5264f4ae2e7161bddf`.

Источники: controllers, DTO, security configuration и global exception handler в
[backend repository](https://github.com/alexweher/code-progress-api/tree/v1.0.0/src/main/java/com/example/codeprogress).

## Общие правила

- Локальный backend: `http://localhost:8080`.
- Browser-facing base URL в dev: `/api` через Vite proxy.
- Публичны только health, registration, login и OpenAPI/Swagger endpoints.
- Остальные endpoints требуют `Authorization: Bearer <accessToken>`.
- API выдаёт access token без refresh token.
- Все пользовательские данные owner-scoped на стороне backend.
- `LocalDate` передаётся как `YYYY-MM-DD`; `LocalDateTime` — ISO-8601 строка без
  предполагаемого frontend timezone conversion.

## Endpoint groups

| Область   | Methods and paths                                                                                                                                                                                                                                    | Auth |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| Health    | `GET /api/health`                                                                                                                                                                                                                                    | Нет  |
| Auth      | `POST /api/auth/register`, `POST /api/auth/login`                                                                                                                                                                                                    | Нет  |
| User      | `GET /api/users/me`                                                                                                                                                                                                                                  | Да   |
| Topics    | `POST/GET /api/topics`, `GET /api/topics/search`, `GET/PUT/DELETE /api/topics/{id}`, `PATCH /api/topics/{id}/status`, `GET /api/topics/{topicId}/progress`                                                                                           | Да   |
| Tasks     | `POST/GET /api/topics/{topicId}/tasks`, `GET /api/tasks/search`, `GET/PUT/DELETE /api/tasks/{id}`, `PATCH /api/tasks/{id}/status`, `PATCH /api/tasks/{id}/planning`, `GET /api/tasks/due-today`, `GET /api/tasks/upcoming`, `GET /api/tasks/overdue` | Да   |
| Sessions  | `POST/GET /api/topics/{topicId}/sessions`, `GET/PUT/DELETE /api/sessions/{id}`, `GET /api/sessions/search`                                                                                                                                           | Да   |
| Dashboard | `GET /api/dashboard/summary`, `GET /api/dashboard/activity?from=YYYY-MM-DD&to=YYYY-MM-DD`                                                                                                                                                            | Да   |

## Authentication DTO

```text
RegisterUserRequest { email, password }
LoginRequest        { email, password }
LoginResponse       { accessToken, tokenType, expiresIn }
UserResponse        { id, email, createdAt, updatedAt }
```

## Dashboard

Оба endpoint защищены bearer token и возвращают только данные текущего пользователя.

### Summary

```http
GET /api/dashboard/summary
```

Успешный `200`:

```text
DashboardSummaryResponse {
  totalTopics: long,
  plannedTasks: long,
  activeTasks: long,
  completedTasks: long,
  totalStudyMinutes: long,
  studyMinutesLast7Days: long,
  studySessionsCount: long,
  completionPercent: int,
  lastStudyDate: LocalDate | null
}
```

- `completionPercent` округляется backend до целого и равен `0`, если tasks отсутствуют.
- `studyMinutesLast7Days` использует inclusive семь календарных дней по настроенной
  backend time zone.
- Для пользователя без данных числовые поля равны `0`, `lastStudyDate` равен `null`.

### Daily activity

```http
GET /api/dashboard/activity?from=YYYY-MM-DD&to=YYYY-MM-DD
```

Успешный `200`:

```text
DashboardActivityResponse {
  from: LocalDate,
  to: LocalDate,
  timeZone: string,
  days: DailyActivityResponse[]
}

DailyActivityResponse {
  date: LocalDate,
  studyMinutes: long,
  studySessionsCount: long
}
```

- `from` и `to` обязательны и включаются в диапазон.
- Максимальный inclusive диапазон — 366 дней.
- Backend возвращает каждую календарную дату диапазона по возрастанию, включая дни с
  `studyMinutes=0` и `studySessionsCount=0`.
- Date-only значения передаются без преобразования в UTC timestamps.
- Неверный, неполный, обратный или слишком длинный диапазон возвращает
  `400 ApiErrorResponse`; отсутствующий/невалидный bearer token возвращает `401`.

Verified sources:

- [`DashboardController`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/dashboard/controller/DashboardController.java)
- [`DashboardSummaryResponse`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/dashboard/dto/DashboardSummaryResponse.java)
- [`DashboardActivityResponse`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/dashboard/dto/DashboardActivityResponse.java)
- [`DailyActivityResponse`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/dashboard/dto/DailyActivityResponse.java)
- [`DashboardService`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/dashboard/service/DashboardService.java)

## Topics list and create

Both endpoints require bearer authentication and are owner-scoped by the backend.

```http
GET /api/topics
POST /api/topics
```

- `GET` returns `200 TopicResponse[]`. This endpoint is unpaginated; no search, sort or
  pagination parameters are used by the initial Topics screen.
- `POST` accepts `CreateTopicRequest { title, description }` and returns
  `201 TopicResponse`.
- `title` is required, non-blank and at most 120 characters.
- `description` is nullable/optional and at most 2000 characters.
- Owner identity is taken from the authenticated backend principal. The create request
  contains no owner field.
- New topics receive `PLANNED` on the backend. The create request contains no status.

```text
TopicResponse {
  id: long,
  title: string,
  description: string | null,
  status: PLANNED | IN_PROGRESS | COMPLETED,
  createdAt: LocalDateTime,
  updatedAt: LocalDateTime
}
```

Validation failures return `400 ApiErrorResponse` with `fieldErrors`; missing or invalid
authentication returns `401`. The frontend validates every successful response at runtime.

Verified sources:

- [`TopicController`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/topic/controller/TopicController.java)
- [`CreateTopicRequest`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/topic/dto/CreateTopicRequest.java)
- [`TopicResponse`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/topic/dto/TopicResponse.java)
- [`TopicStatus`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/topic/TopicStatus.java)
- [`TopicService`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/topic/service/TopicService.java)

## Topic details, update and status

All three endpoints require bearer authentication and look up the topic by both ID and
the current owner. A missing topic and another user's topic therefore produce the same
`404 ApiErrorResponse`.

```http
GET /api/topics/{id}
PUT /api/topics/{id}
PATCH /api/topics/{id}/status
```

- `GET` returns `200 TopicResponse`.
- `PUT` replaces the editable fields and returns `200 TopicResponse`.
- `PATCH` changes the status and returns `200 TopicResponse`.

```text
UpdateTopicRequest {
  title: string,
  description: string | null
}

UpdateTopicStatusRequest {
  status: PLANNED | IN_PROGRESS | COMPLETED
}
```

`UpdateTopicRequest` uses the same validation as create: `title` is required/non-blank
and limited to 120 characters; nullable `description` is limited to 2000 characters.
`status` is required. API v1.0.0 defines no transition matrix: `Topic.updateStatus`
accepts every verified enum value from every current status, including the same status.

Successful PUT/PATCH responses include the complete updated `TopicResponse`. Validation
failures return `400` with `fieldErrors`; a missing/non-owned topic returns `404`; invalid
authentication returns `401`. No request contains `ownerId` or `userId`.

Verified sources:

- [`TopicController`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/topic/controller/TopicController.java)
- [`UpdateTopicRequest`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/topic/dto/UpdateTopicRequest.java)
- [`UpdateTopicStatusRequest`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/topic/dto/UpdateTopicStatusRequest.java)
- [`TopicService`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/topic/service/TopicService.java)
- [`Topic`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/topic/Topic.java)
- [`GlobalExceptionHandler`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/common/exception/GlobalExceptionHandler.java)

## LearningTask details, update, status and planning

All endpoints require bearer authentication and are owner-scoped through the task's Topic.
A missing task and a task owned by another user both produce `404 ApiErrorResponse`.

```http
GET   /api/tasks/{id}           -> 200 LearningTaskResponse
PUT   /api/tasks/{id}           -> 200 LearningTaskResponse
PATCH /api/tasks/{id}/status    -> 200 LearningTaskResponse
PATCH /api/tasks/{id}/planning  -> 200 LearningTaskResponse
```

```text
UpdateLearningTaskRequest {
  title: string,                  // required, non-blank, max 160
  description: string | null,     // optional, max 3000
  difficulty: EASY | MEDIUM | HARD // required
}

UpdateLearningTaskStatusRequest {
  status: PLANNED | IN_PROGRESS | COMPLETED // required
}

UpdateLearningTaskPlanningRequest {
  deadline: LocalDate | null,
  priority: LOW | MEDIUM | HIGH // required
}
```

`PUT` does not accept status, deadline or priority. Planning always sends the required
priority and uses an explicit `null` deadline to clear it. Backend v1.0.0 has no status
transition matrix: its service delegates every valid enum value to `updateStatus`.
Status changes affect Dashboard task counts and completion percentage, so the frontend
invalidates Dashboard summary. Details and planning changes do not. None of these
operations changes Dashboard activity, which is based on study sessions.

Verified sources:

- [`LearningTaskController`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/learningtask/controller/LearningTaskController.java)
- [`UpdateLearningTaskRequest`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/learningtask/dto/UpdateLearningTaskRequest.java)
- [`UpdateLearningTaskStatusRequest`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/learningtask/dto/UpdateLearningTaskStatusRequest.java)
- [`UpdateLearningTaskPlanningRequest`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/learningtask/dto/UpdateLearningTaskPlanningRequest.java)
- [`LearningTaskService`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/learningtask/service/LearningTaskService.java)

## Delete LearningTask

```http
DELETE /api/tasks/{id}
Authorization: Bearer <accessToken>
```

The endpoint has no request body and returns an empty `204 No Content` only after the
owner-scoped task has been deleted.

Verified backend rules:

- the task is resolved by both `{id}` and the current Topic owner;
- an absent task or another user's task returns `404 ApiErrorResponse`;
- before deletion, backend checks whether the task occurs in
  `StudySession.completedTasks` for the same owner;
- a referenced task returns `409 ApiErrorResponse` with message
  `Learning task with id {id} cannot be deleted because it is part of study session history`;
- backend does not delete or modify related StudySessions;
- invalid authentication returns `401` through the standard security flow;
- an unexpected data-integrity conflict can also produce the generic `409` message
  `Operation conflicts with the current data state`;
- an unexpected backend failure returns `500 ApiErrorResponse`.

The frontend treats only `204` as confirmed deletion. It requires explicit confirmation,
does not offer cascade cleanup, and treats network failure as an ambiguous result that
must be checked with a new GET before any manual retry. Confirmed deletion removes the task
from its Topic list and invalidates Dashboard summary, but not Dashboard activity because
deleting a task does not change StudySession history.

Verified sources:

- [`LearningTaskController`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/learningtask/controller/LearningTaskController.java)
- [`LearningTaskService`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/learningtask/service/LearningTaskService.java)
- [`LearningTaskDeletionConflictException`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/learningtask/exception/LearningTaskDeletionConflictException.java)
- [`GlobalExceptionHandler`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/common/exception/GlobalExceptionHandler.java)
- backend `LearningTaskControllerTest` and `LearningTaskServiceTest` at reference commit.

## Delete Topic

```http
DELETE /api/topics/{id}
Authorization: Bearer <accessToken>
```

The endpoint has no request body and returns an empty `204 No Content` only after the
owner-scoped topic has been deleted.

Verified backend rules:

- the topic is first resolved by both `{id}` and the authenticated owner;
- an absent topic or another user's topic returns `404 ApiErrorResponse` with message
  `Topic with id {id} was not found`;
- before deletion, backend checks both learning tasks and study sessions using the same
  topic ID and owner ID;
- if either related collection is non-empty, backend returns `409 ApiErrorResponse` with
  message `Topic with id {id} cannot be deleted because it has learning tasks or study sessions`;
- backend performs no cascade delete of related learning data;
- invalid authentication returns `401` through the standard security/error flow.

The frontend therefore requires an explicit confirmation, treats only `204` as success,
does not offer cascade deletion, and treats a network failure as an ambiguous outcome that
must be checked before retrying.

Verified sources:

- [`TopicController`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/topic/controller/TopicController.java)
- [`TopicService`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/topic/service/TopicService.java)
- [`TopicDeletionConflictException`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/topic/exception/TopicDeletionConflictException.java)
- [`GlobalExceptionHandler`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/common/exception/GlobalExceptionHandler.java)
- backend `TopicControllerTest` and `TopicServiceTest` at release `v1.0.0`.

## LearningTasks list and create

Both endpoints require bearer authentication. The backend resolves the Topic by both
`topicId` and the current owner before listing or creating tasks.

```http
GET /api/topics/{topicId}/tasks
POST /api/topics/{topicId}/tasks
```

- `GET` returns `200 LearningTaskResponse[]` as an unpaginated list. The repository method
  defines no explicit sort order, so the frontend preserves response order and does not
  invent sorting.
- `POST` accepts `CreateLearningTaskRequest` and returns `201 LearningTaskResponse`.
- Missing or non-owned Topics return the same owner-scoped `404 ApiErrorResponse`.
- Missing or invalid authentication returns `401`.
- Validation failures return `400 ApiErrorResponse` with `fieldErrors`.

```text
CreateLearningTaskRequest {
  title: string,
  description: string | null,
  difficulty: EASY | MEDIUM | HARD,
  deadline: LocalDate | null,
  priority: LOW | MEDIUM | HIGH | null
}

LearningTaskResponse {
  id: long,
  topicId: long,
  title: string,
  description: string | null,
  difficulty: EASY | MEDIUM | HARD,
  status: PLANNED | IN_PROGRESS | COMPLETED,
  deadline: LocalDate | null,
  priority: LOW | MEDIUM | HIGH,
  createdAt: LocalDateTime,
  updatedAt: LocalDateTime
}
```

Validation and defaults:

- `title` is required, non-blank and limited to 160 characters;
- `description` is optional/nullable and limited to 3000 characters;
- `difficulty` is required;
- `deadline` is optional/nullable and uses `YYYY-MM-DD` without timezone conversion;
- `priority` is optional/nullable; backend uses `MEDIUM` when it is omitted;
- backend creates every task with initial status `PLANNED`;
- requests contain no `ownerId`, `userId`, `topicId` body field or task `status`.

Creating a task changes Dashboard task counts, so the frontend invalidates Dashboard
summary. It does not invalidate Dashboard activity because activity is derived from study
sessions and study minutes, not task creation.

Verified sources:

- [`LearningTaskController`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/learningtask/controller/LearningTaskController.java)
- [`CreateLearningTaskRequest`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/learningtask/dto/CreateLearningTaskRequest.java)
- [`LearningTaskResponse`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/learningtask/dto/LearningTaskResponse.java)
- [`LearningTaskService`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/learningtask/service/LearningTaskService.java)
- [`LearningTaskRepository`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/learningtask/repository/LearningTaskRepository.java)
- [`LearningTask`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/learningtask/LearningTask.java)
- [`GlobalExceptionHandler`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/common/exception/GlobalExceptionHandler.java)

## StudySessions list, create, details, update and delete

All endpoints require bearer authentication and are scoped to the current user through the Topic
owner.

```http
GET  /api/topics/{topicId}/sessions -> 200 StudySessionResponse[]
POST /api/topics/{topicId}/sessions -> 201 StudySessionResponse
GET  /api/sessions/{id}             -> 200 StudySessionResponse
PUT  /api/sessions/{id}             -> 200 StudySessionResponse
DELETE /api/sessions/{id}          -> 204 (empty body)
```

`GET` is an unpaginated list ordered by `sessionDate DESC` by the repository. The frontend
preserves the backend order. A missing Topic and another user's Topic both return owner-scoped
`404 ApiErrorResponse`.

```text
CreateStudySessionRequest {
  sessionDate: LocalDate,       // required, ISO YYYY-MM-DD
  durationMinutes: int,         // required by primitive JSON binding, @Positive; 1..2147483647
  note: string | null,          // optional, max 2000
  completedTaskIds: Set<long>   // required and non-null; may be empty; each id positive/non-null
}

UpdateStudySessionRequest {        // same field contract as create; full replacement
  sessionDate: LocalDate,          // required, ISO YYYY-MM-DD
  durationMinutes: int,            // @Positive; 1..2147483647
  note: string | null,             // optional, max 2000
  completedTaskIds: Set<long>      // required/non-null; may be empty; ids positive/non-null
}

StudySessionResponse {
  id: long,
  topicId: long,
  sessionDate: LocalDate,
  durationMinutes: int,
  note: string | null,
  completedTaskIds: Set<long>,
  createdAt: LocalDateTime,
  updatedAt: LocalDateTime
}
```

`LocalDate` is a calendar-only value and must not be converted to UTC. `createdAt` and
`updatedAt` are zone-free `LocalDateTime` values. Backend v1.0.0 has no past/future restriction
for `sessionDate` and no maximum duration annotation beyond the Java `int` representation.

Creation and task reconciliation occur in one transaction:

- every completed task id is loaded owner-scoped and must belong to the path Topic;
- an unknown/non-owned task returns `404`; a current-user task from another Topic returns `400`;
- an empty completed-task set is valid;
- selected `PLANNED` or `IN_PROGRESS` tasks become `COMPLETED`, while backend records their prior
  status as session-managed;
- a task already completed manually remains `COMPLETED` and is not marked session-managed;
- the frontend must not issue extra task PATCH requests;
- creation therefore invalidates the Topic task list and selected task details, Dashboard summary,
  and all cached Dashboard activity ranges;
- validation and malformed JSON return `400`; missing/invalid auth returns `401`; normal create has
  no domain-specific `409`, though the global data-integrity handler can return generic `409`.

Details and update rules:

- session lookup uses `findByIdAndTopicOwnerId`; missing and another user's session both return
  `404 ApiErrorResponse`;
- `PUT` replaces date, duration, nullable note and the entire completed-task set;
- new completed tasks are marked `COMPLETED` using the same atomic rules as create;
- tasks kept in the set remain linked; `completeFromStudySession` is idempotent while they stay
  completed, but can re-establish session-managed completion if their status was changed manually;
- a removed task is restored to its saved `PLANNED` or `IN_PROGRESS` value only when its status is
  session-managed and no other StudySession owned by the same user still references it;
- a removed manually completed task remains `COMPLETED`;
- a removed session-managed task referenced by another session remains `COMPLETED` and managed;
- an unchanged set requires no frontend reconciliation; backend remains the only status authority;
- frontend invalidates both old and new completed-task details, the Topic task list, Dashboard
  summary/activity, and synchronizes session detail/list caches;
- standard update errors are `400`, owner-scoped `404`, auth `401`, and possible generic
  data-integrity `409`; the controller defines no update-specific domain conflict.

Delete rules:

- `DELETE` has no request body and accepts only the exact empty `204` as confirmed success;
- lookup is owner-scoped through `findByIdAndTopicOwnerId`; a missing or non-owned session returns
  the same `404 ApiErrorResponse`;
- backend deletes the StudySession inside one transaction and then reconciles every task that the
  session completed;
- a session-managed task is restored to its saved `PLANNED` or `IN_PROGRESS` status only if no
  other StudySession of the same owner still references that task;
- a session-managed task referenced by another session remains `COMPLETED` until the last
  historical reference is removed;
- a task that was completed manually was never marked session-managed and remains `COMPLETED`;
- frontend must not issue task status PATCH requests; it refreshes task/list and Dashboard caches
  from backend-owned state;
- the controller defines no delete-specific business conflict. An invalid path value can produce
  `400`, missing/invalid auth produces `401`, owner-scoped lookup produces `404`, the global
  data-integrity handler may produce generic `409`, and unexpected failures produce generic `500`;
- a network failure leaves the result ambiguous: clients must re-check with GET and must not
  automatically repeat the DELETE.

Verified sources at reference commit `d90f5b85cf929c82b5292c5264f4ae2e7161bddf`:

- [`StudySessionController`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/studysession/controller/StudySessionController.java)
- [`CreateStudySessionRequest`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/studysession/dto/CreateStudySessionRequest.java)
- [`UpdateStudySessionRequest`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/studysession/dto/UpdateStudySessionRequest.java)
- [`StudySessionResponse`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/studysession/dto/StudySessionResponse.java)
- [`StudySessionService`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/studysession/service/StudySessionService.java)
- [`StudySessionRepository`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/studysession/repository/StudySessionRepository.java)
- [`StudySession`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/studysession/StudySession.java)
- [`LearningTask`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/learningtask/LearningTask.java)
- [`GlobalExceptionHandler`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/common/exception/GlobalExceptionHandler.java)
- backend `StudySessionControllerTest`, `StudySessionServiceTest` and `CodeProgressPostgresIT` at
  the reference commit.

Registration returns `201 UserResponse` and does not sign the user in. Login returns
`200 LoginResponse`. `expiresIn` is measured in seconds.

### Registration request validation

`POST /api/auth/register` is public and accepts JSON:

```text
{ email: string, password: string }
```

- `email`: required, valid email, at most 320 characters; backend trims and converts it
  to lowercase before uniqueness checks and persistence.
- `password`: required, non-blank, from 8 through 72 characters.
- Success: `201 UserResponse { id, email, createdAt, updatedAt }`.
- Validation failure: `400 ApiErrorResponse` with per-field `fieldErrors`.
- Existing normalized email: `409 ApiErrorResponse` with message
  `User with this email is already registered`.
- Registration returns no access token and does not authenticate the new account.

Frontend redirects a successful registration to `/login`. Only the normalized email
from `UserResponse` is passed in React Router navigation state for safe prefill; password
is not passed, persisted, or added to the URL.

Verified sources:

- [`RegisterUserRequest`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/user/dto/RegisterUserRequest.java)
- [`UserService`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/user/service/UserService.java)
- [`EmailAlreadyRegisteredException`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/user/exception/EmailAlreadyRegisteredException.java)
- [`GlobalExceptionHandler`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/common/exception/GlobalExceptionHandler.java)

### Login request validation

`POST /api/auth/login` accepts JSON:

```text
{ email: string, password: string }
```

- `email`: required, valid email, at most 320 characters; backend trims it.
- `password`: required and non-blank. The login DTO does not repeat the registration
  length constraint.
- Invalid credentials return `401` with message `Invalid email or password`.
- Successful login does not itself return the user. The client must call authenticated
  `GET /api/users/me` and trust that response as the current identity.

Verified sources:

- [`AuthController`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/user/controller/AuthController.java)
- [`LoginRequest`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/user/dto/LoginRequest.java)
- [`LoginResponse`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/user/dto/LoginResponse.java)
- [`UserResponse`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/user/dto/UserResponse.java)
- [`SecurityConfig`](https://github.com/alexweher/code-progress-api/blob/v1.0.0/src/main/java/com/example/codeprogress/user/security/SecurityConfig.java)

## Enumerations

```text
TopicStatus:            PLANNED | IN_PROGRESS | COMPLETED
LearningTaskStatus:     PLANNED | IN_PROGRESS | COMPLETED
LearningTaskDifficulty: EASY | MEDIUM | HARD
LearningTaskPriority:   LOW | MEDIUM | HIGH
```

## Pagination and sorting

Paginated responses use:

```text
PageResponse<T> { content, page, size, totalElements, totalPages, first, last }
```

- `page >= 0`, default `0`.
- `size` is `1..100`, default `20`.
- `sort` format is `field,asc` or `field,desc`.
- Allowed sort fields are endpoint-specific and verified in controllers.

## Error response

```text
ApiErrorResponse {
  timestamp,
  status,
  error,
  message,
  path,
  fieldErrors: [{ field, message }]
}
```

Expected statuses: `400` invalid input, `401` missing/invalid authentication, `404`
missing or non-owned resource, `409` data/deletion conflict, `500` unexpected server
failure. Network/CORS failures are not API responses and must be handled separately.

Security-level `401` uses message `Authentication is required or token is invalid`.
Frontend global logout is triggered only when a `401` belongs to a request that carried
the current in-memory token. A public login `401` remains a form error.

## Frontend authentication lifecycle

1. POST credentials to `/api/auth/login` without `Authorization`.
2. Keep the returned access token in memory only.
3. Call `/api/users/me` with `Authorization: Bearer <token>`.
4. Expose protected routes only after the current-user response succeeds.
5. On logout or authenticated `401`, abort the session signal, clear user state and
   cancel/clear the TanStack Query cache.
6. A full reload loses the session. No refresh-token flow exists in backend v1.0.0.

## Unknown / deferred

- Production API origin and reverse-proxy layout are not defined in frontend scope.
- Browser CORS is not explicitly configured in backend v1.0.0; development therefore
  uses the documented Vite proxy.
- Dashboard, authentication, registration, complete Topics CRUD/status, complete LearningTasks
  CRUD/status/planning, and complete StudySessions CRUD are integrated against the verified mock
  contract. Live StudySession DELETE and browser E2E remain separately deferred.
