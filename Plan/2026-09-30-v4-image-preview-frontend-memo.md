# V4 image preview — Frontend implementation memo

**Status:** Alicia authorized construction in Pane 8.  
**Repository:** ExoCore-Desktop only.  
**Owner:** Ecki / Builder.  

## Goal

Make V4 render image attachments through the canonical same-origin URL when one exists, and improve the existing local compose preview without inventing unsupported backend URLs.

## Frozen frontend scope

### F1 — Canonical image source

- Add a same-origin `http/https` validator for image `contentUrl`, matching the security posture of audio content URLs.
- In `AttachmentImage`, resolve source in this order:
  1. validated canonical `attachment.contentUrl`;
  2. existing validated legacy `fileUri` fallback;
  3. existing failed-image card.
- Never render `file://`, foreign-origin/protocol-relative canonical URLs, or an unvalidated string.
- Keep ready-status filtering, fallback card, lightbox, filename and legacy `file_uri` behavior unchanged.

Primary files:
- `packages/app/src/features/chat/attachments/mediaUrls.ts`
- `packages/app/src/features/chat/attachments/AttachmentImage.tsx`

### F2 — Local compose image preview

- Preserve the existing object-URL thumbnail and current upload/error overlays.
- Make the thumbnail keyboard-accessible and open the existing `ImageLightbox` on activation.
- Keep remove action independent; preserve existing object-URL ownership/revocation in `useComposeAttachments`.
- Do not transfer compose object URLs into runtime state and do not add a second lifecycle owner in this checkpoint.

Primary file:
- `packages/app/src/features/chat/attachments/ComposeAttachmentItem.tsx`

### F3 — Contract documentation

- Update `ReactSheet.md` to document that canonical ready `attachments[]` presentation rows may provide `content_url` for images; keep the existing audio-only statement for legacy/session `attachments_meta` accurate.
- Add/update focused V4 tests for canonical contentUrl rendering, URL rejection/fallback, lightbox behavior and unchanged error fallback.

## Mandatory backend dependency disclosure

Historical user-upload images are `SessionAttachment` rows. Current backend projections expose `content_url` only for session audio, and `SessionAttachmentContentView` returns 404 for non-audio. Therefore a frontend-only change cannot make user-upload image thumbnails survive canonical replacement/reload.

Do not fabricate a session image URL and do not claim that this checkpoint fixes post-send/reload user-image history. Create a concise dependency spec under `Plan/spec/` for the ExoCore backend covering:

- authenticated same-origin serving of eligible session images;
- image MIME allowlist and inline/nosniff behavior;
- projection of `content_url` for ready/eligible session image rows;
- preservation of audio behavior and refusal of unsupported files;
- tests and ownership boundary.

The spec is a handoff artifact only; Pane 8 must not edit sibling ExoCore.

## Out of scope

- `generate_image` producer or automatic AI attachment publication;
- AGY `file://` ingestion;
- Collection / `bring_to_chat`;
- optimistic post-send object-URL lifecycle work;
- any ExoCore or Runtime source modification;
- visual redesign beyond preview/lightbox accessibility.

## Acceptance targets

1. A ready canonical image with only same-origin `contentUrl` renders thumbnail and lightbox.
2. A foreign/protocol-relative canonical URL is rejected; valid legacy `fileUri` remains the fallback.
3. With neither valid source, the existing failure card remains.
4. Compose thumbnail opens/closes the existing lightbox by pointer and keyboard without breaking remove/upload/error behavior.
5. Existing historical attachment and compose tests remain green; V4 typecheck/lint/build gates pass as applicable.
6. Backend limitation is recorded explicitly and not masked by frontend behavior.
