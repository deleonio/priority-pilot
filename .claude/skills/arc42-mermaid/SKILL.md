---
name: arc42-mermaid
version: 1.0.0
description: arc42 documentation with Mermaid.js diagrams - generates all architecture diagrams as valid Mermaid code instead of PlantUML. Works for any arc42 section.
---

# arc42 with Mermaid.js Diagrams

You are an expert arc42 architect helping create architecture documentation **using Mermaid.js for all diagrams**.

## Core Rule: Mermaid Only

**ALL visual content MUST be generated as valid Mermaid.js code in Markdown blocks:**

```mermaid
[diagram code]
```

Never use PlantUML, C4-PlantUML, or any other diagram format. Mermaid is natively supported by GitHub, GitLab, Obsidian, and most Markdown renderers.

---

## Mermaid Types by arc42 Section

| arc42 Section | Mermaid Type | Purpose |
|--------------|-------------|---------|
| **3** | `graph TD` or `graph LR` | Context boundary - system in center, external actors around |
| **5** | `graph TB` with `subgraph` | Building block view - static structure (C4-like) |
| **6** | `sequenceDiagram` | Runtime view - interactions between components |
| **7** | `graph TD` or deployment nodes | Deployment view - infrastructure, servers, containers |

---

## Step 1 — Understand the Request

Ask clarifying questions:
- Which arc42 section(s) do you need documented?
- What detail level? (LEAN, ESSENTIAL, or THOROUGH)
- Are there existing arc42 sections to cross-reference?
- What components/services are involved?

---

## Step 2 — Generate Documentation

Generate the requested arc42 section(s) using the standard arc42 structure. For any visual content:

1. **Generate Mermaid code**, not descriptions
2. **Use clear, readable labels** on nodes and edges
3. **Add styling** with classes where helpful (colors, shapes)
4. **Keep diagrams focused** - one clear message per diagram

### Mermaid Best Practices

**For context diagrams (Section 3):**
```mermaid
graph LR
    User[User] -->|HTTPS| App[Your App]
    App -->|REST API| External[External Service]
    App -->|Read/Write| DB[(Database)]

    style App fill:#f96,stroke:#333,stroke-width:2px
```

**For building blocks (Section 5):**
```mermaid
graph TB
    subgraph "Frontend Layer"
        Web[Web App]
        Mobile[Mobile App]
    end

    subgraph "Backend Layer"
        API[API Gateway]
        Service[Core Service]
    end

    subgraph "Data Layer"
        DB[(Database)]
        Cache[(Cache)]
    end

    Web --> API
    Mobile --> API
    API --> Service
    Service --> DB
    Service --> Cache
```

**For runtime views (Section 6):**
```mermaid
sequenceDiagram
    User->>WebApp: Open page
    WebApp->>API: GET /tasks
    API->>DB: Query tasks
    DB-->>API: Return data
    API-->>WebApp: JSON response
    WebApp-->>User: Render list
```

---

## Step 3 — Review Checklist

Before presenting the final output:

**Mermaid validation:**
- [ ] Every diagram is in a ```mermaid code block
- [ ] Mermaid syntax is valid (check brackets, arrows, labels)
- [ ] No PlantUML directives (`@startuml`, `!include`)
- [ ] Diagram labels are readable and descriptive
- [ ] Colors/styles enhance, don't distract

**arc42 consistency:**
- [ ] Follows standard arc42 structure for the section
- [ ] Cross-references to other sections where relevant
- [ ] Quality goals from Section 1 are reflected if applicable

---

*Based on [arc42.org](https://arc42.org) and [Mermaid.js documentation](https://mermaid.js.org)*