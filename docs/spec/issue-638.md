# Issue 638: LLM Provider Interface

**Ziel**: Refactor `server/src/llm/mistral.ts` into provider-agnostic interface with multiple provider support.

## Vorbedingung

- Existing Mistral implementation in `server/src/llm/mistral.ts` works
- Test suite exists for Mistral-based features

## Schritte

1. Extract provider-agnostic interface: `PillarClassifier`, `ParseTaskParser`, `ActivityAdvisor` from `server/src/llm/index.ts`
2. Create `MistralProvider` class implementing interface with existing logic
3. Create `OpenRouterProvider` stub class with placebo implementations
4. Update env loading: `LLM_PROVIDER` env var selects provider (default: mistral)
5. Fallback to Mistral if `LLM_PROVIDER` unset or invalid

## Erwartetes Ergebnis

- Interface types exported from `server/src/llm/index.ts`
- `MistralProvider` implements interface with working classifier/parser/advisor
- `OpenRouterProvider` stub returns empty/placeholder results
- `process.env.LLM_PROVIDER` selects provider
- All existing tests pass without modification
