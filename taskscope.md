# Task Scope: Student Account Display Format In Permissions UI

## Objective

Update the `/permissions` user/account display format for student accounts so each student item shows:

```text
Nguyen Van A
ID: <account-or-user-id>
```

The current UI pattern shown in the screenshot is:

```text
1241510003
Username: 1241510003 - ID: 22dfd029
```

This is not the desired student account presentation. The student code or username should not be the primary visible label when the linked student profile has a full name.

## Required UI Behavior

For student accounts in `/permissions`:

1. The top line must show the student full name.
2. The second line must show only the ID label and value.
3. The second line must not show `Username:` for student accounts.
4. The student code can remain available for search and backend identity, but it should not be the primary visible label in this UI row.

Expected display example:

```text
Nguyen Van A
ID: 22dfd029
```

## Data Mapping

Use this priority for the top display name:

```ts
student_profile.full_name
display_name
user_name
username
'Unknown user'
```

Use this priority for the ID value:

```ts
user._id
user.id
```

If the ID is shortened in the existing UI, keep the same shortening helper or formatting convention, but keep the label as:

```text
ID: <value>
```

## Guardrails

This is a display-only change.

Do not change:

- Student login identity.
- `user_name` stored in the database.
- Student code login behavior.
- Password behavior.
- Account status checks.
- Permission assignment payloads.
- API request body fields that still require user IDs.

Student accounts must still be able to log in with the existing dedicated student login flow after admin activation:

```text
username/account: student_code
password: date of birth in ddmmyyyy format
```

## Files To Review Or Update

Primary file:

```text
frontend/src/app/permissions/page.tsx
```

Also check the permission detail page for the same display consistency:

```text
frontend/src/app/permissions/[id]/page.tsx
```

Backend enrichment should continue to provide student display fields:

```text
backend/src/auth/services/auth.service.ts
```

Expected API fields for student users:

```ts
{
  user_name: '1241510003',
  display_name: 'Nguyen Van A',
  student_profile: {
    student_code: '1241510003',
    full_name: 'Nguyen Van A'
  }
}
```

## Implementation Notes

The UI should render a student row like this:

```tsx
<div className="font-medium">
  {getUserDisplayName(user)}
</div>
<div className="text-sm text-muted-foreground">
  ID: {formatUserId(user._id || user.id)}
</div>
```

The helper should remain a module-level helper, outside import blocks and outside component render bodies:

```ts
const getUserDisplayName = (user: any) =>
  user?.student_profile?.full_name ||
  user?.display_name ||
  user?.user_name ||
  user?.username ||
  'Unknown user';
```

If non-student accounts still need username context, keep that behavior only for non-student rows, not for student rows.

## Verification Checklist

1. Open `/permissions`.
2. Confirm a student account row shows the student full name on the top line.
3. Confirm the row second line shows `ID: <value>`.
4. Confirm the row no longer shows `Username: <student_code>` for student accounts.
5. Confirm searching by student full name still works.
6. Confirm searching by student code still works if the code is included in hidden/searchable row data.
7. Confirm selecting a student account for permission preview still shows the full name.
8. Confirm assigning permissions still uses the correct user/account ID.
9. Confirm student login still works only after admin activation.
10. Confirm inactive student accounts still cannot log in.

## Acceptance Criteria

- `/permissions` student user rows show `student full name` as the primary label.
- `/permissions` student user rows show only `ID: <value>` as the secondary label.
- Student code and username remain intact for login and backend identity.
- The display change does not affect the dedicated student login flow.
- Permission assignment and preview continue to use stable user IDs internally.
