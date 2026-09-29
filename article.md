# I Built a Production Incident Agent With Hindsight

Production incidents are rarely difficult because the error message is impossible to understand. They are difficult because the useful context is scattered, and the team solving the incident often has to reconstruct what happened from scratch.

That was the problem I wanted to address with IncidentIQ: an AI production incident agent that can use what the team learned from previous incidents when analyzing a new one.

The important part of the idea is not simply asking an LLM, “What does this error mean?” The interesting part is giving the agent a memory of previous incidents: the error, root cause, solution, and outcome. When a similar incident appears later, that history becomes part of the analysis.

The project is a small full-stack application. The frontend is React with Vite. The backend is an Express server using SQLite for persistence. NVIDIA NIM provides the LLM analysis. The memory layer is represented by a dedicated `hindsight_memory` table and the workflow explicitly indexes resolved incidents so they can influence future analysis.

## The problem I started with

A typical production incident might arrive with something like:

```text
java.sql.SQLTransientConnectionException:
HikariPool-1 - Connection is not available
```

An engineer can investigate it, discover that the connection pool is exhausted, change the relevant configuration or application code, restart the affected pods, and confirm that the service has recovered.

The problem is what happens the next time a related failure occurs.

Without persistent incident knowledge, the second investigation can look almost identical to the first. Someone has to remember the previous root cause, find the old ticket or postmortem, understand what was changed, and decide whether the old solution still applies.

I wanted IncidentIQ to turn that previous resolution into usable context.

The intended learning loop is simple:

```text
Incident → Analyze → Resolve → Store Memory
                              ↓
New Incident → Recall Memory → Analyze with Context
```

That loop is the core of the application.

## How I structured the application

I kept the architecture deliberately small.

The React frontend talks to an Express API on port 3001. SQLite stores both incidents and the memory records. When an incident is analyzed, the backend first checks whether a previous memory record exists for the same error. If one exists, its root cause, solution, and outcome are included in the prompt sent to NVIDIA NIM.

The backend initializes two tables:

```js
db.run(`CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    error TEXT,
    service TEXT,
    environment TEXT,
    impact TEXT,
    logs TEXT,
    status TEXT,
    createdAt TEXT,
    resolvedAt TEXT,
    rootCause TEXT,
    solution TEXT,
    outcome TEXT
)`);

db.run(`CREATE TABLE IF NOT EXISTS hindsight_memory (
    id TEXT PRIMARY KEY,
    error TEXT,
    rootCause TEXT,
    solution TEXT,
    outcome TEXT,
    timestamp TEXT
)`);
```

I intentionally kept the memory schema close to the incident itself. A memory record is not just an opaque document. It contains the things an engineer actually wants to know when a similar failure happens again: what failed, why it failed, what was done, and what happened afterward.

This also makes the behavior easy to demonstrate and inspect.

## The first incident teaches the system

The frontend includes two demo scenarios because I wanted the learning behavior to be visible without needing a complicated external telemetry setup.

The first scenario represents an initial outage. The error is a HikariCP connection timeout from the payment gateway, with a stack trace showing that the application waited for a database connection.

After the incident is created, the engineer can select it and click **Analyze with AI & Hindsight**.

The backend retrieves the incident and looks for a previous memory:

```js
db.get(
  "SELECT * FROM hindsight_memory WHERE LOWER(error) = LOWER(?)",
  [incident.error],
  async (err, similarMemory) => {
    // ...
  }
);
```

For the first occurrence, there is no previous record. The LLM therefore receives the incident information without historical resolution context.

After the engineer investigates and resolves the incident, IncidentIQ asks for three pieces of knowledge:

- Root cause
- Solution applied
- Outcome

The backend then updates the incident and stores the same resolution in the memory table.

That is the point where the incident stops being only an incident record and becomes reusable knowledge.

## The second incident is where the idea becomes useful

The second demo scenario deliberately uses the same database connection error but a different service: `billing-service`.

This is important because I did not want the demonstration to depend on the service name being identical. The current implementation retrieves memory by matching the normalized error text, so the same error can recall the earlier resolution even when the service changes.

When the second incident is analyzed, the backend adds the previous resolution to the LLM prompt:

```js
if (similarMemory) {
  prompt += `
[HINDSIGHT MEMORY FOUND]:
A similar incident occurred previously.
Previous Root Cause: ${similarMemory.rootCause}
Previous Solution: ${similarMemory.solution}
Outcome: ${similarMemory.outcome}

Based on this memory, what is the likely cause and
what do you recommend? Explicitly state how the
historical memory influenced your recommendation
to reduce MTTR.`;
}
```

That changes the interaction.

The model is no longer looking only at the current error and logs. It has historical evidence from the team's previous resolution.

The frontend makes that visible with a **HINDSIGHT MEMORY FOUND** section. It shows the previous incident, root cause, resolution, outcome, and the similarity value returned by the application. The user can then see why the recommendation has historical context instead of treating the AI output as a black box.

For me, that visibility matters. If an agent claims that it “remembered” something, I want to be able to see what it remembered.

## Why I used NVIDIA NIM

For the reasoning layer, I used NVIDIA NIM rather than trying to make the memory system itself generate the final recommendation.

The backend calls NVIDIA's chat completions endpoint with the incident details and, when available, the historical memory. The configured model in the current implementation is:

```js
model: 'meta/llama-3.2-11b-vision-instruct',
messages: [{ role: 'user', content: prompt }],
max_tokens: 200,
temperature: 0.2
```

The separation is useful:

- SQLite stores the durable incident knowledge.
- The memory lookup supplies historical context.
- NVIDIA NIM performs the language-model analysis.
- React presents the result and the memory that influenced it.

This makes it easier to reason about what each part of the system is responsible for.

I also added a simple request limiter around the NVIDIA API. The current backend allows up to 35 requests in a rolling one-minute window. If the limit is reached, the application can still return the historical memory information instead of blindly continuing to make API requests.

That was a small implementation detail, but it is the kind of detail that becomes important when an AI demo moves from a local prototype toward something people might actually use.

## Building the UI around the incident workflow

I did not want the application to feel like a generic chatbot with an incident-management label attached to it.

The frontend has separate views for the dashboard, active incidents, Hindsight Memory, analytics, and settings. From the active incident view, the user can create an incident, inspect its logs, run AI analysis, review historical memory, and finally resolve the incident.

The resolution form is particularly important because it closes the learning loop:

```text
Create Incident
      ↓
Analyze
      ↓
Review Historical Memory
      ↓
Apply / Record Resolution
      ↓
Store Root Cause + Solution + Outcome
      ↓
Future Incident Can Recall It
```

There is also a dedicated memory view. Resolved incidents are shown with their stored root cause and resolution, while unresolved incidents are marked as pending indexing.

That gives the user a simple mental model: an unresolved incident is still an active investigation; a resolved incident can become part of the agent's accumulated knowledge.

## What I learned while building it

### 1. Memory is more useful when it changes the workflow

Adding a database called “memory” is not enough.

The useful behavior is the complete loop: capture a resolution, persist it, retrieve it later, and inject it into a new analysis. Without the final recall step, the memory is just storage.

### 2. AI output needs visible evidence

I did not want the application to simply display a paragraph from the LLM.

The interface exposes the previous incident, root cause, resolution, and outcome when memory is found. That makes it possible for an engineer to inspect the context behind the recommendation.

For operational tooling, that distinction matters. A recommendation is easier to evaluate when the user can see what information produced it.

### 3. A small memory model can be enough for a focused prototype

The current implementation does not try to model every possible piece of production telemetry.

It stores a focused set of fields:

```text
Error
Root Cause
Solution
Outcome
Timestamp
```

That is enough to demonstrate the learning behavior clearly. I would rather have a small memory loop that works end to end than a large schema that never reaches the demo.

### 4. Demo scenarios should prove the learning loop

The two built-in scenarios are not just sample data. They are there to make the product behavior obvious.

First outage: no previous memory.

Resolve it: the system stores what was learned.

Similar outage: historical memory appears and influences the analysis.

That sequence tells the story much faster than a dashboard full of charts.

### 5. I would separate the prototype memory layer from a production memory service

The current repository uses SQLite for the persistent memory implementation. It gives me a straightforward local development setup and makes the stored knowledge easy to inspect.

For a production version, I would replace or extend that layer with a dedicated Hindsight deployment, while keeping the same conceptual contract: remember useful incident knowledge, recall relevant experience, and use that experience during future reasoning.

The important design decision is not the table itself. It is treating memory as part of the agent's reasoning loop.

## What I would build next

There are several obvious directions from here.

First, I would replace exact error-string matching with semantic retrieval. Production errors are rarely identical character-for-character. A better system should recognize related stack traces, services, symptoms, and failure patterns.

Second, I would add richer incident metadata such as deployment version, recent infrastructure changes, affected components, and links to runbooks.

Third, I would store feedback about whether an AI recommendation actually helped. That would let the memory layer distinguish between resolutions that worked and suggestions that did not.

Finally, I would move the memory implementation from the local SQLite prototype to a dedicated Hindsight deployment and make the memory operations explicit in the agent architecture.

## Final thoughts

IncidentIQ started from a simple observation: production teams solve the same kinds of problems more than once, but the useful knowledge from those solutions is often difficult to retrieve at the moment it matters.

An AI incident agent becomes more interesting when it can remember that history.

The current implementation demonstrates the complete loop: incidents are created, analyzed with an LLM, resolved with structured root-cause information, stored as persistent memory, and recalled during a later analysis.

The most important part is not that the agent can answer an incident question.

It is that the next time the question looks familiar, the agent has something to remember.

That is the difference between an AI assistant that answers and an agent that can accumulate experience.
**Screenshots**
<img width="1865" height="917" alt="Screenshot 2026-09-29 224711" src="https://github.com/user-attachments/assets/daf23fbc-3e44-491e-9c71-60a93c8503e1" />

<img width="1851" height="942" alt="Screenshot 2026-09-29 224746" src="https://github.com/user-attachments/assets/6a614c5b-9364-4e25-abba-2a8fd5653599" />


## References

- [Hindsight documentation](https://hindsight.vectorize.io/)
- [Hindsight on GitHub](https://github.com/vectorize-io/hindsight)
- [IncidentIQ repository](https://github.com/Balakishore-16/microsofthackathon/tree/main/incidentiq-main)
- [NVIDIA NIM](https://www.nvidia.com/en-us/ai-data-science/products/nim/)
