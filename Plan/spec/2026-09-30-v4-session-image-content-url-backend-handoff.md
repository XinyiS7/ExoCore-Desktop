# Session image `content_url` — ExoCore backend dependency handoff

**Status:** Handoff artifact only — **no ExoCore change is included or authorized by this document.**
**Origin:** `Plan/2026-09-30-v4-image-preview-frontend-memo.md` (V4 Desktop image preview checkpoint, Pane 8 / Ecki).
**Repositories:** authored in `ExoCore-Desktop`; the required implementation lives in `../ExoCore/` (owned by the backend agent / its acceptance counterpart).
**Baselines observed:** Desktop `de9c261`; ExoCore `c04814d` (read-only inspection; the backend worktree additionally carries unrelated uncommitted `Plan/` edits that this spec does not touch).

## 1. Problem

V4 Desktop now renders canonical `attachments[]` image rows through a validated same-origin
`content_url` when one is present (same-origin `http/https` only; otherwise the legacy
`file_uri` fallback; otherwise the failed-image card). This is a frontend-only reliability fix —
the frontend must never fabricate a session image URL.

Historical / compose user uploads are `SessionAttachment` rows. The current backend cannot
serve them to the frontend after canonical replacement or page reload:

1. `memory/message_attachments.py::_session_projection` emits `content_url` only when the MIME
   is `audio/*`; session image rows always project `content_url: null` (same for
   `_legacy_metadata`).
2. `agents/views.py::SessionAttachmentContentView`
   (`GET /api/agents/conversations/<pk>/attachments/<id>/content/`) accepts only `audio/*` and
   returns a stable 404 for every other MIME.

Consequence: a user-upload image whose provider `file_uri` is absent or expired degrades to the
filename fallback card after reload. The V4 image-preview checkpoint does **not** fix that and
makes no claim that it does; it only renders whatever eligible canonical URL the backend later
provides.

By contrast, canonical `message_attachment` images (e.g. tool-collection artifacts) are already
served correctly by `agents/views.py::MessageAttachmentContentView` with an inline-image
allowlist (`_INLINE_IMAGE_MIMES`), `X-Content-Type-Options: nosniff`, stable 404, and no
`storage_path` exposure. The requested change below brings session rows to the same posture.

## 2. Required backend contract

### R1 — Serve eligible session images (conversation-scoped, same-origin, stable 404)

Extend `SessionAttachmentContentView` (or an equivalent conversation-scoped endpoint at the same
route) to deliver eligible session images under the same guards as today's audio path:

- the attachment must belong to the conversation `pk`; cross-conversation, missing record,
  unreadable/absent file → the existing stable 404 body `{"error": "附件不存在"}`, never an
  existence leak;
- image MIME must be in the allowlist (R2); all non-audio, non-allowlisted files remain 404;
- response `Content-Type` is the stored canonical MIME;
- `Content-Disposition: inline; filename="<original_filename or display_name>"`;
- `X-Content-Type-Options: nosniff` (session audio today does not set it; the image path must);
- `Cache-Control: private` (parity with existing content endpoints);
- same-origin only through the existing deployment (nginx/proxy); no new public route, no CORS
  widening; authentication policy inherits the existing DRF configuration unchanged.

### R2 — Image MIME allowlist

Eligible: `image/png`, `image/jpeg`, `image/gif`, `image/webp` — mirror
`memory/message_attachments.py::_IMAGE_MIMES` so upload preprocess output and serving agree
(preprocess may legitimately retain an original PNG/JPEG/GIF/WebP when compression degrades).

Explicitly **not** eligible: `image/svg+xml` (active content) and every other MIME. A
non-allowlisted image must project `content_url: null` and stay 404 from the content endpoint —
never render as inline.

### R3 — Canonical projection for eligible session image rows

In `memory/message_attachments.py::_session_projection`, for session rows whose `kind` is
`image` and whose MIME is allowlisted, emit the existing same-origin route:

```text
content_url = "/api/agents/conversations/<conversation_id>/attachments/<attachment.id>/content/"
```

Requirements:

- `attachments_meta[].content_url` remains audio-only for now; this handoff does not ask to
  change the documented legacy semantics (ReactSheet carries the same statement). If the
  backend later wants parity there, it must be an explicit, separately accepted decision.
- Audio projection and audio playback behavior stay byte-identical.
- Rows that are not eligible (non-audio, non-allowlisted, abnormal) keep `content_url: null`.
- No new model fields or migration are required: `SessionAttachment` already stores
  `mime_type`, `file_size`, `storage_path`, `original_filename`.

### R4 — Preservation and refusal

- Existing audio behavior (list, content streaming, delete, cache-freeze protections) is
  unchanged.
- PDF/text/unknown files: `content_url: null`, content endpoint 404, no inline serving.
- `storage_path` must never appear in any HTTP response (list, detail, or content metadata).

## 3. Consumer-side facts (already landed in Desktop)

- `packages/app/src/features/chat/attachments/mediaUrls.ts::validatedImageContentUrl` accepts
  only same-origin `http/https`; foreign/protocol-relative/`file:`/`data:`/script values are
  rejected.
- `AttachmentImage` resolution order: validated canonical `contentUrl` → validated legacy
  `fileUri` → failed-image card. Absence of the new projection is already tolerated; no Desktop
  change is required to consume it.
- Focused Desktop evidence: `packages/app/src/test/v4_image_preview.test.tsx`.

## 4. Tests expected from the backend owner

Mirror the existing session-audio acceptance style
(`agents/tests/acceptance/test_audio_attachment_contract.py::AudioChatBoundaryAcceptanceTests::test_aud_b13_content_endpoint_streams_local_audio`,
`memory/tests/test_message_attachments.py::MessageAttachmentCoreTests::test_safe_images_inline_and_files_download_with_nosniff`):

1. ready allowlisted session image within the conversation → 200 with stored MIME, inline
   disposition, `nosniff`;
2. cross-conversation / missing file / non-allowlisted MIME / SVG → stable 404;
3. projection: eligible session image row carries the same-origin `content_url`; audio rows and
   `attachments_meta` audio-only semantics unchanged;
4. no `storage_path` in any response body;
5. the full existing session-audio focused set stays green.

## 5. Ownership boundary and handoff

- Implementation and tests belong to the ExoCore repository; the V4 Desktop checkpoint does not
  edit `../ExoCore` and will not fabricate URLs to compensate.
- After the backend ships R1–R3, a Desktop follow-up checkpoint (separate authorization) should
  verify end-to-end rendering of a historical user image after canonical reload; that verification
  is out of scope of the present checkpoint.
- Acceptance hooks: this document plus the Desktop consumer test above define the expected
  contract; any behavioral deviation (e.g. different route, disposition, or MIME set) needs an
  explicit contract update in `ReactSheet.md` before merging both sides.
