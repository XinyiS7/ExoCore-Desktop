# Handoff: Synchronize ReactSheet.md Section 10 Status in ExoCore

**Date:** 2026-09-13  
**Target Repository:** `../ExoCore` (Django backend)  
**Target File:** `../ExoCore/ReactSheet.md`  
**Author:** Alaric (ExoCore-Desktop Builder)

---

## 1. Context & Motivation

During Phase 2C Checkpoint CP C-4 construction and independent acceptance, the Tool Drawer and MCP Credential management endpoints were fully verified and integrated on the frontend (`exo-app`).

In `ExoCore`, these endpoints have already been delivered and verified (see `agents/tests/test_drawer_mcp_api.py` and `agents/migrations/0039_drawer_access_mcp_credentials.py`).

However, the backend repository copy of `ReactSheet.md` §10 still retains the obsolete pre-delivery notice:
```markdown
## 第十篇  Tool Drawer 与 MCP 凭证管理（Frozen / Backend Pending）

> 本篇是前后端施工契约，当前端点尚未实现。前端可以据此完成界面与 API wrapper，
> 但在后端交付前必须正确展示 unavailable/error，不得伪造保存成功。
```

This caused finding **C4-R1-F5** in Solaire's independent acceptance review.

---

## 2. Requested Change in `../ExoCore/ReactSheet.md`

In `../ExoCore/ReactSheet.md`, replace lines 750–753:

### Current Text:
```markdown
## 第十篇  Tool Drawer 与 MCP 凭证管理（Frozen / Backend Pending）

> 本篇是前后端施工契约，当前端点尚未实现。前端可以据此完成界面与 API wrapper，
> 但在后端交付前必须正确展示 unavailable/error，不得伪造保存成功。
```

### New Text:
```markdown
## 第十篇  Tool Drawer 与 MCP 凭证管理（Frozen）

> 本篇是前后端施工契约，后端接口已在 ExoCore 交付可用（参见 `agents/tests/test_drawer_mcp_api.py`）。
```

> [!IMPORTANT]
> Do NOT change any API shapes, URL paths, request/response formats, error envelope definitions, or table schemas. Only the section title and status notice are to be updated.
