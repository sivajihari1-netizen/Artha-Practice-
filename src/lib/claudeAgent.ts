import Anthropic from "@anthropic-ai/sdk";

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

/** True once ANTHROPIC_API_KEY is set — agents fall back to deterministic mock logic until then, same stub-mode pattern as sendEmail/sendWhatsAppMessage. */
export const claudeConfigured = !!anthropic;

export type ClaudeAgentTool = {
  name: string;
  description: string;
  input_schema: Anthropic.Tool["input_schema"];
  handler: (input: any) => Promise<unknown> | unknown;
};

export type ClaudeAgentResult =
  | { actionTaken: true; toolName: string; toolInput: Record<string, unknown>; toolResult: unknown }
  | { actionTaken: false };

/**
 * Bounded ReAct-style tool-use loop for the narrow, single-decision agents in
 * src/lib/agents.ts. The model may call any read-only tool freely, but the
 * loop treats the first call to `actionToolName` as the agent's final
 * decision — that tool actually performs the side effect (sending a WhatsApp
 * reminder, recording a staff-review flag), so once it's called there's
 * nothing left to decide. If the model finishes without ever calling it,
 * that's a deliberate "no action needed" — matches the old mocked decide()
 * functions returning null.
 */
export async function runClaudeAgent(params: {
  system: string;
  userMessage: string;
  tools: ClaudeAgentTool[];
  actionToolName: string;
  maxRounds?: number;
}): Promise<ClaudeAgentResult> {
  if (!anthropic) throw new Error("ANTHROPIC_API_KEY not configured");
  const { system, userMessage, tools, actionToolName, maxRounds = 4 } = params;

  const toolSpecs: Anthropic.Tool[] = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userMessage }];

  for (let round = 0; round < maxRounds; round++) {
    const response = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 1024,
      output_config: { effort: "low" },
      system,
      tools: toolSpecs,
      messages,
    });

    if (response.stop_reason === "refusal") {
      return { actionTaken: false };
    }

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    const actionCall = toolUses.find((c) => c.name === actionToolName);
    if (actionCall) {
      const tool = tools.find((t) => t.name === actionToolName)!;
      const toolResult = await tool.handler(actionCall.input);
      return {
        actionTaken: true,
        toolName: actionToolName,
        toolInput: actionCall.input as Record<string, unknown>,
        toolResult,
      };
    }

    if (toolUses.length === 0) {
      return { actionTaken: false };
    }

    messages.push({ role: "assistant", content: response.content });
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const call of toolUses) {
      const tool = tools.find((t) => t.name === call.name);
      const result = tool ? await tool.handler(call.input) : { error: `Unknown tool ${call.name}` };
      toolResults.push({ type: "tool_result", tool_use_id: call.id, content: JSON.stringify(result) });
    }
    messages.push({ role: "user", content: toolResults });
  }

  return { actionTaken: false };
}
