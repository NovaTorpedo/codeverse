import type { RecEvent, ToolAction } from '@codeverse/schema';

const TOOL_ACTIONS: Record<string, ToolAction> = {
  read_file: 'read',
  getsymbolsoverview: 'symbol',
  findsymbol: 'symbol',
  findreferencingsymbols: 'search',
  grep: 'search',
  search_files: 'search',
  codebase_search: 'search',
  glob: 'search',
  list_files: 'list',
  list_code_definition_names: 'symbol',
  write_file: 'write',
  write_to_file: 'write',
  apply_diff: 'write',
  insert_content: 'write',
  search_and_replace: 'write',
  execute_command: 'execute',
  spawn_subagent: 'subagent',
  start_subtask: 'subagent',
  new_task: 'subagent',
  use_skill: 'skill',
  switch_mode: 'mode',
  update_todo_list: 'todo',
  ask_followup_question: 'question',
};

export function toolAction(toolName: string | undefined): ToolAction {
  if (!toolName) return 'other';
  return TOOL_ACTIONS[toolName.toLowerCase()] ?? (/read/i.test(toolName) ? 'read' : /search|grep|find/i.test(toolName) ? 'search' : 'other');
}

const str = (v: unknown, max: number): string | undefined => {
  if (v === undefined || v === null) return undefined;
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > max ? s.slice(0, max) + '…' : s;
};

/** Copies a JSON-ish value keeping only plain data with depth, key and length caps. */
export function sanitizeParams(v: unknown, depth = 0): unknown {
  if (v === null || typeof v === 'number' || typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.length > 2000 ? v.slice(0, 2000) + '…' : v;
  if (depth > 4) return '[…]';
  if (Array.isArray(v)) return v.slice(0, 50).map((x) => sanitizeParams(x, depth + 1));
  if (typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>).slice(0, 40)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      out[k.slice(0, 80)] = sanitizeParams(val, depth + 1);
    }
    return out;
  }
  return undefined;
}

const KNOWN = new Set(['message', 'tool_use', 'tool_result', 'error', 'result']);

/** Normalises one raw Bob Shell stream-json object. Unknown event types are kept as 'unknown'. */
export function normalizeEvent(raw: Record<string, unknown>, seq: number, t: number): RecEvent {
  const type = typeof raw.type === 'string' && KNOWN.has(raw.type) ? (raw.type as RecEvent['type']) : 'unknown';
  const toolName = str(raw.tool_name ?? raw.toolName ?? raw.name, 120);
  const ev: RecEvent = { seq, t, type, lane: 'main', targets: [] };
  switch (type) {
    case 'message':
      ev.role = str(raw.role, 40);
      ev.content = str(raw.content, 20_000);
      ev.isReasoning = raw.isReasoning === true || raw.is_reasoning === true;
      break;
    case 'tool_use':
      ev.toolName = toolName;
      ev.toolId = str(raw.tool_id ?? raw.toolId ?? raw.id, 200);
      ev.action = toolAction(toolName);
      ev.parameters = (sanitizeParams(raw.parameters ?? raw.input ?? {}) as Record<string, unknown>) ?? {};
      break;
    case 'tool_result':
      ev.toolId = str(raw.tool_id ?? raw.toolId ?? raw.id, 200);
      ev.status = str(raw.status, 40);
      ev.output = str(raw.output, 20_000);
      ev.error = str(raw.error, 4000);
      break;
    case 'error':
      ev.severity = str(raw.severity, 40);
      ev.error = str(raw.message ?? raw.error, 4000);
      break;
    case 'result':
      ev.status = str(raw.status, 40);
      ev.content = str(raw.last_message, 20_000);
      break;
    default:
      ev.content = str(raw.type, 80);
  }
  return ev;
}

/** Explicit parent/agent id on an event, if the stream provides one. */
export function explicitLane(raw: Record<string, unknown>): string | undefined {
  for (const k of ['parent_tool_id', 'parent_tool_use_id', 'subagent_id', 'agent_id']) {
    const v = raw[k];
    if (typeof v === 'string' && v) return k.startsWith('parent') ? `sub:${v}` : `agent:${v}`;
  }
  return undefined;
}
