# G045 Singleton Product Invariant — Authorized Documentation Rebaseline

> **Date:** 2026-09-29
> **Authority:** Alicia
> **Scope:** Documentation semantics and integrity record; no production source change in this rebaseline.

## Reason

ExoCore has exactly one canonical G045. Historical P2A/P2C wording that described multiple G045 rows or a G045 multi-select was generic implementation residue, not product behavior. Alicia authorized direct cleanup before the next construction phase.

Frozen product invariant:

- exactly one G045 exists in ExoCore;
- if that G045 has normal user-visible Chats, exactly one is Prime;
- its first normal user-visible Chat becomes Prime;
- Council is scheduled for retirement and excluded from Prime; optional WezBridge/AGY bridge containers are not Prime candidates and are not supported as the initial or only conversation;
- later selection transfers Prime exclusively;
- Prime cannot be cleared, and the current Prime must be transferred before deletion.

## Rebased documents

| Document | Original accepted SHA-256 | Current amended SHA-256 |
|---|---|---|
| `Plan/V4_Phase_2A_Agent_Hub_Profile_Detailed_Plan.md` | `3b05d08738ad7aa6d7734f74c3aabad8d811b603c8297e77810ca0b97a1bc07f` | `dc1766b9d322aa679f68fdf8a3c9c1e051894b1efadf9a30b3dacec661e598b6` |
| `Plan/V4_Phase_2A_Source_Scout.md` | `e0ac294b11a979d31a55c00c6fd24e4d9fb1156877f258e336e6b3f75dae8248` | `0279ffb90a37f08edbe362287949503e8142402b24c484c697036a79f9a7675e` |
| `Plan/P2C_Core_Shell_Settings_Source_Inventory.md` | `b901762110f9dae9085a3be76b5471b252e56366f009ec6748052850d6e5c298` | `a0fa16960ac9fa447f60e0ba28084970f12dd921183a977f8230fd2e6086c13a` |
| `Plan/V4_Phase_2C_Core_Shell_Account_Settings_Detailed_Plan.md` | `c72533fe1b1066f5b14793954c0e14f07d222b3b005ed279357df5caf265fa6c` | `598ee525ec8366b913015bb7843bf5af083feff903e5dbac123793cd1742edac` |
| `Plan/spec/2026-09-02-v4-b3-memory-search-filter-handoff.md` | `5363a36394ad3ea1f86e8e4c0e9d06c3329ab7941ff9442780cd6b0f80038177` | `fb5b432aa83c01fb5eb45cae5d2b836df53f8170f7872ec26d01b1d2402ad69a` |

Historical acceptance reports and baseline JSON files retain their original hashes as point-in-time evidence. The four amended P2A/P2C source documents carry inline 2026-09-29 authorization markers and point here; the B3 handoff's singular wording is listed in this table.

The documentation correction does not claim the Prime invariant is already implemented. Backend implementation remains Gate 0 of `Plan/Archived/2026-09-29-v4-agent-profile-prime-contract-handoff.md`.

## Test fixture follow-up

Historical Desktop tests containing two G045 fixtures must be normalized during the authorized companion construction. They are not a supported fallback branch.
