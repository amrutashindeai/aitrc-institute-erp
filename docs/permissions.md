# Backend authorization baseline

Authorization is enforced on the API, not just the frontend. All authenticated routes use `authenticate`; role-gated routes use `authorize`; activity/evidence/compliance controllers additionally check resource scope. Missing permission is denied by default.

| Capability | DIRECTOR | PRINCIPAL | HOD | COMMITTEE_HEAD | FACULTY | ADMIN |
|---|---|---|---|---|---|---|
| Institution dashboard | Read | Read | Denied | Denied | Denied | Read |
| User creation/status/role | Denied | Denied | Denied | Denied | Denied | Manage |
| Department/committee master data | Read | Manage | Scoped read | Scoped read | Read | Manage |
| Academic year | Read | Manage | Read | Read | Read | Manage |
| Activity create/assign | Manage | Manage | Department scope | Committee scope | Denied | Manage |
| Activity start/submit | Only scoped/assigned logic | Only scoped/assigned logic | Scoped | Scoped | Assigned/owned | Scoped |
| Return/verify/close | Scoped | Scoped | Department scope | Committee scope | Denied | API role policy applies |
| Evidence metadata/download | Institution scope | Institution scope | Department scope | Committee scope | Assigned/owned | Not globally unrestricted |
| Compliance criteria | Read | Manage | Read | Read | Read | Manage |
| Audit log | Institution | Institution | Department-scoped | Actor-scoped | Denied | Institution |

This is a conservative baseline. Some workflows (for example, HOD/committee review and evidence access) need institution-specific policy decisions before production deployment. A primary role is stored on each user; department and committee memberships do not implicitly grant another role.
