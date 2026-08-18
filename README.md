# Week 6 Multi-Agent App

A small Express chat application that routes user prompts to specialized agents using a single top-level orchestrator. The app keeps the shared LLM call logic centralized while splitting each specialist into its own file.

## Architecture

- `server.js` – main Express application entry point
- `agents/orchestrator.js` – top-level dispatcher that decides which agent should respond
- `agents/llm.js` – shared OpenAI/Raptor model call helper used by all agents
- `agents/navigator.js` – route, map, and navigation specialist
- `agents/treasureHunter.js` – clue and treasure search specialist
- `agents/captain.js` – final decision-maker for crew strategy
- `public/` – frontend client for sending chat messages

## Agent roles

### Navigator
Handles prompts about:
- routes
- maps
- directions
- travel planning
- distances and waypoints

### Treasure Hunter
Handles prompts about:
- treasure
- clues
- hidden items
- secrets
- island searches
- artifact hunts

### Captain
Handles prompts about:
- final decisions
- choosing where the crew should go
- leadership and strategy
- decisive recommendations

## Routing logic

The orchestrator uses keyword-based matching to pick the right specialist:

- `route`, `map`, `direction`, `travel` → Navigator
- `treasure`, `clue`, `hidden`, `search` → Treasure Hunter
- `captain`, `decide`, `choose`, `crew` → Captain

If the prompt is unclear, it defaults to Captain.

## Shared LLM flow

All agents call the same helper in `agents/llm.js`, which:
- normalizes chat history
- resolves the active provider config
- supports either OpenAI or Raptor Mini keys
- sends the request to the configured chat completions endpoint
- returns the model response

This keeps the application consistent while allowing each agent to use its own role-specific system prompt.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file with one of these options:
   ```bash
   OPENAI_API_KEY=your_key
   OPENAI_MODEL=gpt-4o-mini
   ```
   or
   ```bash
   RAPTOR_MINI_API_KEY=your_key
   RAPTOR_MINI_MODEL=raptor-mini
   ```
3. Start the app:
   ```bash
   npm start
   ```

## Usage

Open the app in a browser and send a prompt such as:
- "Find the quickest route from Paris to Berlin"
- "Search the island for hidden treasure clues"
- "Captain, choose where the crew should go next"

The server responds with both the selected agent and the final LLM-generated reply.

## Verification

The project includes Node tests for the routing and config behavior. Run:

```bash
node --test
```

This validates:
- route detection
- treasure detection
- captain detection
- default fallback behavior
- provider configuration selection
