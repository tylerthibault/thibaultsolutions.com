# Code Quality 9/10 Remediation Plan

**Repository:** `tylerthibault/thibaultsolutions.com`  
**Target:** Every reviewed engineering category scores **9.0/10 or higher**, with no unresolved High or Medium severity findings.  
**Execution model:** One remediation item at a time. Do not advance to the next item until the current item passes the QA gate.  
**Change strategy:** Keep this plan on `main`. Perform implementation work on a dedicated long-lived branch (recommended: `refactor/quality-9`) and maintain a single PR until all gates pass. Do not merge piecemeal architecture work into `main` unless the current item is fully validated and specifically approved.

---

## 1. Quality Target

The project is considered complete only when the independent/adversarial QA pass scores **all** of the following at **9.0/10 or higher**:

| Category | Target |
| --- | ---: |
| Overall architecture | >= 9.0 |
| TypeScript / React | >= 9.0 |
| Backend / API design | >= 9.0 |
| Database design / migrations | >= 9.0 |
| HTML semantics / accessibility | >= 9.0 |
| CSS architecture | >= 9.0 |
| JavaScript organization | >= 9.0 |
| Componentization / modularity | >= 9.0 |
| Security / privacy | >= 9.0 |
| Testing / CI | >= 9.0 |
| Maintainability / readability | >= 9.0 |

The final weighted average must also be **>= 9.0**, but a high average may not hide a weak category. Every category must independently pass.

### Hard blockers

Completion is not allowed while any of the following are true:

- Any unresolved **High** or **Medium** severity code-review finding exists.
- CI is not green on the exact commit being reviewed.
- A migration can unintentionally expose previously private data.
- Public endpoints expose unnecessary internal identifiers or sensitive metadata.
- Heavy media processing still occurs synchronously inside request/response paths when it can be queued.
- Major UI feature files remain monolithic without justified boundaries.
- The homepage remains split across competing static and React implementations.
- Duplicate validation/media-processing logic remains in multiple upload paths without a shared abstraction.
- Accessibility violations exist in interactive UI.
- Tests do not cover the public-feedback security boundary and critical user flows.

---

## 2. Execution Protocol

Every remediation item follows the same cycle.

### Implementer pass

1. Read the current item and its acceptance criteria.
2. Inspect all adjacent code before changing anything.
3. Make the smallest architecture-correct change that solves the root cause rather than appending another workaround.
4. Add or update tests before calling the item complete.
5. Run local/static validation where available:
   - `npm run typecheck`
   - `npm run lint`
   - `npm test`
   - `npm run test:effects`
   - `npm run build`
   - relevant integration/E2E tests
6. Push the work to the quality branch and update the PR.
7. Do **not** mark the item complete yet.

### Independent/adversarial QA gate

QA must review the changed code as if it were rejecting a production PR for a demanding engineering organization.

QA rules:

- Assume the implementation is wrong until evidence shows otherwise.
- Read the diff and affected surrounding modules, not only the implementer's summary.
- Inspect failure paths, rollback behavior, race conditions, authorization, privacy, accessibility, tests, and maintainability.
- Do not award points for intent. Award points only for code and test evidence.
- Do not accept "works in the browser" as evidence of architectural quality.
- Do not accept a lint workaround when state ownership or module boundaries are the real issue.
- Do not accept duplicate logic because it is "small."
- Do not accept silent error swallowing.
- Do not accept public data expansion without an explicit migration policy.
- Re-run or inspect the exact CI run for the reviewed commit.
- Score the relevant categories from 0.0-10.0.
- The current item passes only if:
  - every category affected by the item is >= 9.0,
  - no new High or Medium finding is introduced,
  - all item acceptance criteria are met,
  - CI is green.

If QA scores the item below 9.0, **stay on the same item**, fix the findings, and submit it to QA again. Do not start the next item.

---

## 3. Branch / PR Strategy

Recommended branch:

```text
refactor/quality-9
```

Recommended workflow:

```text
main
  └── CODE_QUALITY_9_PLAN.md

refactor/quality-9
  ├── remediation item 01
  ├── QA fixes for item 01
  ├── remediation item 02
  ├── QA fixes for item 02
  └── ...
```

Maintain one PR named approximately:

```text
Engineering quality remediation to 9/10
```

The PR description should contain:

- current item,
- status,
- CI link,
- QA score,
- blocking QA findings,
- completed checklist.

---

# 4. Remediation Backlog

The order below is intentional. Privacy/data exposure and architectural correctness come before cosmetic cleanup.

---

## Q9-01 — Preserve Privacy in Public-Feedback Migration

### Problem

The public-feedback migration currently includes behavior equivalent to making all existing feedback videos public. Historical private review content must not become public merely because the product's default behavior changed.

### Required outcome

- Existing video visibility is preserved.
- Only explicitly public/newly-created public feedback items become public.
- Homepage-linked videos intended for public review may be created/publicized explicitly.
- Migration is safe to run against an existing production database.
- Migration remains idempotent where appropriate.
- A regression test proves private rows stay private.

### Acceptance criteria

- No blanket `UPDATE feedback_videos SET is_public = true`.
- Migration test covers at least:
  - existing private item remains private,
  - existing public item remains public,
  - homepage media receives the intended public feedback record,
  - migration rerun does not duplicate mappings.
- QA security/privacy score >= 9.0.

---

## Q9-02 — Fix Invalid Nested Interactive Markup

### Problem

The feedback action can be injected as a `button` inside an existing portfolio `a`, creating invalid nested interactive content and keyboard/accessibility ambiguity.

### Required outcome

- Feedback controls are never descendants of another interactive control.
- Keyboard behavior is predictable.
- Screen readers receive a useful accessible name.
- Focus indicators are visible.
- Pointer behavior does not depend on event-propagation hacks to undo invalid markup.

### Acceptance criteria

- HTML passes semantic inspection for nested interactive elements.
- Feedback icon is focusable and usable by keyboard.
- Card link still works.
- No duplicate clickable regions with conflicting actions.
- Automated or test-level accessibility coverage is added where practical.
- QA HTML/accessibility score >= 9.0.

---

## Q9-03 — Make Homepage Media + Feedback Synchronization Atomic

### Problem

Homepage slot updates, media asset inserts, feedback-video synchronization, and filesystem writes can partially succeed, leaving orphan rows or database records pointing to missing files.

### Required outcome

Create a service-layer operation that coordinates:

- media asset creation/update,
- homepage slot mutation,
- feedback-video mapping,
- cleanup of superseded media,
- rollback/compensation on failure.

Use a database transaction for database state. Treat filesystem operations explicitly with staged/finalized states or compensating cleanup.

### Acceptance criteria

- Database changes for a homepage video update are transactional.
- Failed feedback-video synchronization cannot leave a half-updated homepage slot.
- Failed DB commit cannot leave a newly referenced final file without cleanup strategy.
- Old media is not deleted until the new state is durable.
- Tests deliberately inject a failure between steps and prove consistency.
- QA architecture/database score >= 9.0.

---

## Q9-04 — Move Timeline Generation Out of HTTP GET

### Problem

The timeline endpoint can synchronously run FFmpeg thumbnail extraction and full-audio decoding during a browser GET.

### Required outcome

- Generate timeline assets as a background job after upload/finalization.
- Reuse the existing job infrastructure where sensible.
- HTTP timeline GET becomes a fast read-only endpoint.
- Job status is explicit: pending / processing / ready / failed.
- Regeneration is deterministic and safe.

### Acceptance criteria

- GET does not invoke FFmpeg.
- Upload/finalization queues timeline processing.
- Worker creates waveform + frames.
- API returns an explicit processing state until assets exist.
- Retries are safe/idempotent.
- Failure is observable and surfaced to UI.
- Tests cover ready/pending/failed states.
- QA architecture/performance score >= 9.0.

---

## Q9-05 — Establish One Canonical Homepage Implementation

### Problem

The repository contains a React `app/page.tsx`, a static `index.html`, a build-time copy to `legacy-home.html`, and a root rewrite that makes the static page the actual homepage.

### Required outcome

Move the real homepage into the Next application and remove the competing implementation.

### Acceptance criteria

- `/` is rendered from the App Router.
- The current visual design and user behavior are preserved.
- `legacy-home.html` root rewrite is removed.
- Static `index.html` is no longer the production homepage.
- `scripts/copy-legacy.mjs` is removed or reduced to unrelated assets only.
- No developer can accidentally edit a dead homepage implementation.
- Visual regression/manual screenshot checks verify no unintended design drift.
- QA architecture/maintainability score >= 9.0.

---

## Q9-06 — Componentize the Homepage

### Problem

Homepage media hydration, quick-feedback modal creation, dynamic controls, and player injection currently live in imperative DOM code.

### Required outcome

Create explicit React components for the homepage.

Suggested boundaries:

- `HomepageHero`
- `PortfolioSection`
- `PortfolioVideoCard`
- `PortfolioVideoPlayer`
- `FeedbackIconButton`
- `QuickFeedbackModal`
- `ContactSection`

### Acceptance criteria

- No large imperative DOM-construction script remains for homepage behavior.
- Dynamic media state is represented as React state/data.
- Modal focus behavior is implemented correctly.
- Data loading has typed response models.
- Public feedback quick-submit shares domain/API utilities with the Feedback Lab where appropriate.
- QA React/componentization score >= 9.0.

---

## Q9-07 — Decompose `FeedbackReview.tsx`

### Problem

`FeedbackReview.tsx` is a monolithic client component containing player integration, TikTok messaging, identity, timeline, comments, moderation, and UI.

### Required outcome

Split behavior by responsibility.

Recommended structure:

```text
src/components/feedback/
  FeedbackReview.tsx
  FeedbackPlayer.tsx
  FeedbackTimeline.tsx
  FeedbackComposer.tsx
  FeedbackComments.tsx
  FeedbackCommentMoments.tsx
  FeedbackModerationActions.tsx

src/hooks/
  useFeedbackIdentity.ts
  usePreparedPlayback.ts
  useTikTokPlayer.ts
  useFeedbackComments.ts
```

### Acceptance criteria

- Orchestrator component is easy to scan and primarily composes child components/hooks.
- External-player logic is isolated.
- Anonymous identity persistence is isolated.
- Comment network mutations are centralized.
- Timeline rendering is isolated.
- No artificial `setTimeout(..., 0)` exists merely to satisfy lint rules.
- Components have focused tests where behavior warrants it.
- QA componentization/React score >= 9.0.

---

## Q9-08 — Replace Accretive Global CSS with Structured CSS

### Problem

Global CSS contains chronological overrides, repeated definitions, and feature-specific rules that supersede earlier declarations.

### Required outcome

Keep the existing visual design but reorganize styles structurally.

Recommended direction:

```text
styles/
  tokens.css
  base.css
  utilities.css

src/components/.../*.module.css
```

CSS Modules are preferred for feature/component styles. Global CSS should contain only tokens, resets/base, and intentionally global utilities.

### Acceptance criteria

- Duplicate/contradictory `.feedback-grid`, `.feedback-card-thumb`, and related override chains are consolidated.
- Component styles are co-located.
- No "append another override at bottom" pattern remains for active features.
- Responsive rules live with their owning component styles.
- CSS variables remain the source of truth for theme tokens.
- Visual regression/manual checks verify no unintended styling changes.
- QA CSS score >= 9.0.

---

## Q9-09 — Consolidate Upload Validation and Upload Services

### Problem

Video MIME maps, extension validation, size limits, chunk handling, and storage patterns are duplicated across homepage, Feedback Lab, and project upload endpoints despite an existing upload-policy module.

### Required outcome

Create shared upload primitives/services.

Suggested modules:

```text
src/lib/uploads/policy.ts
src/lib/uploads/stream-upload.ts
src/lib/uploads/chunked-upload.ts
src/lib/media/media-service.ts
```

### Acceptance criteria

- Accepted MIME/extension definitions exist in one place.
- Size-limit behavior is consistent.
- Filename validation is consistent.
- Chunk sequencing logic is reusable and tested.
- Endpoints become thin request adapters.
- No duplicated MIME maps remain.
- QA backend/maintainability score >= 9.0.

---

## Q9-10 — Consolidate FFmpeg / FFprobe Execution

### Problem

Multiple FFmpeg process runners exist with different timeout/error/buffer behavior.

### Required outcome

Create one process-execution/media foundation used by:

- metadata probing,
- playback conversion,
- thumbnails,
- timeline frames,
- waveform generation,
- worker rendering where practical.

### Acceptance criteria

- Shared timeout/kill/error semantics.
- Bounded stderr capture.
- Structured errors.
- Cancellation/timeout behavior is tested.
- No unnecessary duplicate process-runner implementations remain.
- QA maintainability/backend score >= 9.0.

---

## Q9-11 — Define a Canonical Video/Media Domain Model

### Problem

Homepage slots, media assets, and feedback videos overlap and require manual synchronization.

### Required outcome

Decide and document the canonical ownership model.

Preferred principle:

- `media_assets` represents physical media.
- a canonical video/content entity owns review/publication relationships,
- homepage placement references the canonical entity rather than duplicating the media/review identity.

Do not perform an unnecessarily risky rewrite; migrate in controlled steps.

### Acceptance criteria

- The same video is not independently represented in two domain tables without an explicit reason.
- Homepage placement does not require ad-hoc mirrored fields.
- Ownership, visibility, media source, and review identity have clear homes.
- DB constraints enforce relationships.
- Migration tests prove preservation.
- QA database/architecture score >= 9.0.

---

## Q9-12 — Strengthen Database Domain Constraints

### Problem

Important domain states are stored as unrestricted text.

### Required outcome

Use database constraints/enums/checks where stable and valuable.

Candidates include:

- feedback video source type,
- provider,
- video status,
- comment status,
- render status where appropriate.

### Acceptance criteria

- Invalid state cannot be inserted directly through SQL for protected fields.
- TypeScript domain types mirror DB constraints.
- Migrations preserve current data.
- Tests cover invalid-state rejection where practical.
- QA database score >= 9.0.

---

## Q9-13 — Harden Public Feedback Privacy and Abuse Controls

### Problem

Public feedback now stores IP/user-agent metadata and trusts proxy headers according to deployment assumptions. Retention/unblocking and limiter identity need clearer design.

### Required outcome

- Document trusted-proxy assumptions.
- Normalize client-IP extraction behind one helper.
- Do not trust arbitrary proxy headers when deployment does not guarantee sanitization.
- Define retention for IP/user-agent metadata.
- Add unblock management.
- Scope blocks appropriately for current/possible future ownership model.
- Combine IP and anonymous reviewer identity for abuse controls where useful.
- Do not expose IPs publicly.
- Add a privacy-facing disclosure aligned with actual behavior.

### Acceptance criteria

- One trusted client-IP helper.
- Configurable retention or explicit deletion policy.
- Admin can list/unblock blocked sources.
- Tests cover spoofed/untrusted header scenarios according to deployment config.
- QA security/privacy score >= 9.0.

---

## Q9-14 — Make Rate Limiting Robust

### Problem

Current SELECT-then-INSERT limiting can race, and no-IP requests skip the limiter.

### Required outcome

Choose a limiter appropriate to deployment scale without needless complexity.

Acceptable options include:

- PostgreSQL-backed atomic counters/windows,
- trusted reverse-proxy/WAF limiting plus application fallback,
- another explicit shared limiter.

Use reviewer UUID as a secondary signal, not as a trusted identity.

### Acceptance criteria

- Concurrent requests cannot trivially bypass the intended rate.
- Requests without IP still receive reasonable abuse protection.
- Limits are configurable.
- Normal users are unlikely to be blocked.
- Tests simulate boundary/concurrency behavior where feasible.
- QA security score >= 9.0.

---

## Q9-15 — Minimize Public API Data

### Problem

Public comment responses include internal fields such as `authorId` that the browser does not require.

### Required outcome

Define explicit DTOs for public API responses.

### Acceptance criteria

- Public comment DTO contains only fields required by the UI.
- Internal user IDs, IPs, user agents, moderation internals, and unrelated DB columns are omitted.
- Route response types are centralized/shared where practical.
- Tests assert absence of private/internal fields.
- QA privacy/API score >= 9.0.

---

## Q9-16 — Accessibility Pass

### Problem

Dialogs, tabs, and injected controls are only partially accessible.

### Required outcome

Audit all public and Feedback Lab interactive flows.

Required focus:

- modal/dialog focus trapping,
- focus restoration,
- Escape behavior,
- keyboard-only operation,
- visible focus styles,
- tab semantics,
- labels/descriptions,
- no nested interactive elements,
- reduced motion,
- video controls.

### Acceptance criteria

- Dialogs correctly trap/restore focus.
- Tablist uses correct `role=tab`, `aria-selected`, and relationships.
- All icon-only controls have accessible names.
- Keyboard walkthrough succeeds without mouse.
- Automated accessibility checks are introduced where feasible.
- QA HTML/accessibility score >= 9.0.

---

## Q9-17 — Replace Silent Failure States with Explicit State Machines

### Problem

Some async failures are swallowed, leaving misleading loading UI.

### Required outcome

Represent meaningful async operations with explicit states such as:

```text
idle | loading | ready | error
```

Apply to:

- timeline,
- playback preparation,
- homepage slot hydration,
- comment mutations where needed.

### Acceptance criteria

- No critical `.catch(() => undefined)` hides a user-impacting failure.
- Users receive actionable error state/retry where appropriate.
- Logs retain enough technical detail for diagnosis without leaking internals.
- Tests cover failure state.
- QA React/reliability score >= 9.0.

---

## Q9-18 — Standardize Formatting and Repository Conventions

### Problem

Formatting varies dramatically between files and there is no repository formatter.

### Required outcome

Add a formatter and enforce a consistent code style.

### Acceptance criteria

- Add Prettier or an equivalent formatter.
- Add `format` and `format:check` scripts.
- CI checks formatting.
- Reformat source/test scripts deliberately in a dedicated commit to reduce future diff noise.
- Document basic repository conventions.
- QA maintainability/readability score >= 9.0.

---

## Q9-19 — Expand Public Feedback Test Coverage

### Problem

The current CI pipeline is strong, but the new public-feedback boundary is under-tested.

### Required coverage

At minimum:

- anonymous user can access public review,
- anonymous user cannot access private review,
- private review remains private after migration,
- anonymous comment submission,
- validation failures,
- timestamp bounds,
- quick feedback,
- detailed feedback,
- internal fields absent from public responses,
- IP block,
- unblock,
- rate limit,
- hidden comment visibility,
- owner moderation permissions,
- non-owner moderation rejection,
- homepage video to review mapping,
- timeline processing lifecycle,
- no-audio timeline,
- failed processing state,
- browser media range serving.

### Acceptance criteria

- Critical paths are covered by integration/E2E tests.
- Security boundary tests are explicit and readable.
- Tests are deterministic.
- CI runtime remains reasonable.
- QA testing score >= 9.0.

---

## Q9-20 — Improve Observability and Operational Safety

### Problem

Media processing and public-feedback behavior need enough observability to diagnose production issues.

### Required outcome

Introduce consistent structured logs for important server events.

Suggested events:

- upload.started/completed/failed,
- media.processing.started/completed/failed,
- feedback.comment.created,
- feedback.comment.blocked,
- feedback.rate_limited,
- timeline.queued/completed/failed,
- migration/startup failure.

Never log raw comment text, passwords, cookies, full IPs unnecessarily, or secrets.

### Acceptance criteria

- Logs use a consistent structured shape.
- Sensitive data is redacted/minimized.
- Processing failures are traceable by stable IDs.
- QA operational-readiness score >= 9.0.

---

## Q9-21 — Final Dead-Code / Duplication Cleanup

### Problem

Architecture migrations commonly leave obsolete files and compatibility paths.

### Required outcome

After all major refactors:

- remove dead homepage implementation,
- remove unused CSS,
- remove obsolete helper modules,
- remove duplicated DTO/types,
- remove old compatibility routes when safe,
- remove stale comments describing no-longer-current behavior.

### Acceptance criteria

- Repository search confirms obsolete paths are unused.
- Build, tests, and E2E remain green.
- No "temporary" compatibility layer remains without a documented reason and owner.
- QA maintainability score >= 9.0.

---

# 5. Final QA Audit

After Q9-01 through Q9-21 are individually accepted, perform a fresh full-repository audit without relying on prior scores.

The final QA reviewer must:

1. Read the current repository architecture.
2. Inspect the main user-facing flows.
3. Inspect authentication/public authorization boundaries.
4. Inspect schema and all recent migrations.
5. Inspect public DTOs.
6. Inspect media processing paths.
7. Inspect component sizes/boundaries.
8. Inspect CSS ownership and duplication.
9. Inspect tests and CI.
10. Search for:
   - duplicate MIME maps,
   - duplicate FFmpeg runners,
   - oversized components/routes,
   - silent catches,
   - unrestricted status text,
   - raw public DB objects,
   - nested interactive markup,
   - dead homepage code,
   - direct DOM construction that should be React,
   - `setTimeout(..., 0)` lint workarounds,
   - stale TODO/FIXME comments,
   - unused files.

Then produce a final score table for all eleven quality categories.

### Final pass criteria

- Every category >= 9.0.
- Weighted average >= 9.0.
- No High findings.
- No Medium findings.
- Current-head CI is green.
- Production build succeeds.
- Docker build succeeds.
- Migrations apply cleanly from a representative previous schema state.
- Public/private feedback regression suite passes.
- Accessibility audit passes.
- The refactor PR is coherent enough that a senior engineer unfamiliar with the project can understand the architecture without historical knowledge.

If the final audit fails any criterion, reopen the applicable remediation item and continue the hourly cycle.

---

# 6. Hourly Automation Runbook

Each hourly run should do **one** of these things only:

1. If the current remediation item has unresolved QA findings:
   - work only on those findings,
   - push fixes,
   - run validation,
   - request another adversarial QA pass.

2. If the current remediation item has not yet been implemented:
   - implement it,
   - add tests,
   - push,
   - run validation,
   - submit to QA.

3. If the current remediation item has QA >= 9.0:
   - mark it complete in this file/PR checklist,
   - select the next incomplete item,
   - begin that item only.

4. If all items are complete:
   - perform Final QA Audit,
   - if final score >= 9.0 in every category and CI is green, mark the project complete and stop the recurring automation,
   - otherwise reopen the failed item/category.

### Never do this

- Do not skip an item because the code "seems okay."
- Do not combine unrelated refactors merely to save time.
- Do not move on after an 8.9.
- Do not lower the rubric to declare success.
- Do not merge around failing CI.
- Do not mask architectural debt with comments.
- Do not convert warnings into ignores unless the underlying behavior is objectively correct and documented.
- Do not make unrelated visual/product changes during refactoring.

---

# 7. Progress Tracker

Update this checklist only after the independent/adversarial QA gate passes at >= 9.0 for the current item.

- [ ] Q9-01 Preserve privacy in public-feedback migration
- [ ] Q9-02 Fix nested interactive markup
- [ ] Q9-03 Atomic homepage media + feedback synchronization
- [ ] Q9-04 Queue timeline generation
- [ ] Q9-05 One canonical homepage implementation
- [ ] Q9-06 Componentize homepage
- [ ] Q9-07 Decompose FeedbackReview
- [ ] Q9-08 Structured CSS architecture
- [ ] Q9-09 Shared upload services
- [ ] Q9-10 Shared FFmpeg/FFprobe execution
- [ ] Q9-11 Canonical video/media domain model
- [ ] Q9-12 Database domain constraints
- [ ] Q9-13 Public feedback privacy/abuse hardening
- [ ] Q9-14 Robust rate limiting
- [ ] Q9-15 Public API data minimization
- [ ] Q9-16 Accessibility pass
- [ ] Q9-17 Explicit async state machines
- [ ] Q9-18 Formatting/conventions
- [ ] Q9-19 Public feedback test coverage
- [ ] Q9-20 Observability/operational safety
- [ ] Q9-21 Dead-code/duplication cleanup
- [ ] Final QA audit: all categories >= 9.0

---

# 8. Definition of Done

This effort is complete only when:

- [ ] Every Q9 item is checked.
- [ ] Final QA scores every category >= 9.0.
- [ ] No High or Medium issue remains.
- [ ] CI is green on the final reviewed commit.
- [ ] The main branch has one clear homepage implementation.
- [ ] Critical public-feedback behavior is covered by tests.
- [ ] CSS and component ownership are clear.
- [ ] Heavy media work is asynchronous.
- [ ] Public/private data behavior is explicit and regression-tested.
- [ ] The final PR can be reviewed without needing historical context to understand why the system is structured the way it is.
