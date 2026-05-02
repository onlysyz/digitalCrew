# Test Coverage Report

**Date:** 2026-05-02
**Test Framework:** Vitest + React Testing Library
**Total Tests:** 588 across 11 test files

## Overall Coverage

| Metric | Current | Target |
|--------|---------|--------|
| Statements | 39.79% (536/1347) | - |
| Branches | 26.93% (282/1047) | - |
| Functions | 40.73% (189/464) | - |
| **Lines** | **40.71%** (504/1238) | - |

## By File

| File | % Lines | Status |
|------|---------|--------|
| api.ts | 98.66% | ✅ Excellent |
| SystemLogs.tsx | 96.82% | ✅ Excellent |
| chatStore.ts | 96.42% | ✅ Excellent |
| knowledgeStore.ts | 63.63% | ⚠️ Partial |
| agentStore.ts | 87.16% | ✅ |
| SetupWizard.tsx | 88.99% | ✅ Above 85% target |
| ChatPanel.tsx | 39.47% | ❌ Below 70% |
| All other files | 0% | Not tested |

## Test Files

| Test File | Tests |
|-----------|-------|
| SetupWizard.test.tsx | 114 |
| ChatPanel.test.tsx | 127 |
| (9 other test files) | 347 |
| **Total** | **588** |

## Notes

### SetupWizard.tsx
- **Target:** 85%+
- **Achieved:** 88.99% lines
- Status: ✅ Met target

### ChatPanel.tsx
- **Target:** 70%+
- **Achieved:** 39.47% lines
- Status: ❌ Below target
- **Reason:** SSE/streaming architecture uses internal component state (`isStreaming`, `assignedAgents`, SSE event handlers) that cannot be controlled from external tests without refactoring

### Untested Components (0%)
- App.tsx, main.tsx
- AgentCard.tsx
- Sidebar.tsx, TopBar.tsx
- AgentModal.tsx, AgentEditModal.tsx
- Overview.tsx, Settings.tsx, AuditCenter.tsx
- HelpSupport.tsx, KnowledgeBase.tsx
- taskStore.ts

## Recommendations

1. **ChatPanel:** Refactor to expose internal state via test hooks, or mock SSE endpoints to reach 70% target
2. **Next priority:** Add tests for untested page components (Overview, Settings, KnowledgeBase)
3. **Infrastructure:** Consider adding component-level integration tests for Sidebar, TopBar
