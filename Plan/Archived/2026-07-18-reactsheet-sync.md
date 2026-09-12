# Spec: Sync and Clean ReactSheet_Reorganized.md in ExoCore Backend

This document specifies the synchronization and clean-up of the backend repository's `ReactSheet_Reorganized.md` copy.

## Required Action for Backend Agent

To keep both repositories in sync, please overwrite the backend file `D:\Alicia\ExoCore_Project\ExoCore\ReactSheet_Reorganized.md` with the exact contents of the frontend file `D:\Alicia\ExoCore_Project\ExoCore-Desktop\ReactSheet_Reorganized.md`.

### Rationale
1. **Memory refactoring sync**: The backend copy was outdated and still referenced the legacy `UserPortrait` and `TriggeredNote` endpoints. It has now been updated to use the new unified `MemoryPlasmid` (`/api/memory/plasmids/`) schema.
2. **Catalog & Endpoint configurations**: Added sections 5.5, 5.6, 5.7, and 5.8 for the new P1-11 Catalog, Endpoints, Model Entries, and Config Roles APIs.
3. **No Verbose Comments**: Removed unnecessary text explanations, keeping only paths, parameters, schemas, and error structures, as requested by the user.

## Backend Validation Updates (`core/serializers.py`)
To support multiple registered main models, the backend agent must update `RoleConfigSerializer` and `RoleRecordSerializer`:
1. **RoleRecordSerializer** (`core/serializers.py` around line 364):
   Add an optional `style_shadow` field:
   ```python
   style_shadow = serializers.CharField(max_length=150, required=False, allow_null=True, allow_blank=True)
   ```
2. **RoleConfigSerializer** (`core/serializers.py` around line 371):
   * Relax uniqueness constraint: Do NOT check `len(role_names) != len(set(role_names))` globally. Instead, only enforce that the helper/support roles (`general_sub_agent`, `vision_helper`, `grounding`, `image_gen`) are unique.
   * Allow multiple entries with `role === "main"`.
   * Ensure that all required helper/support roles are still present.

