import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type, type Static } from "typebox";
import { ToolBase, type ToolExecutionContext } from "./base.js";
import type { BaseDetails, ToolRuntimeOptions } from "./types.js";

export const ASK_USER_TOOL_NAME = "askUser" as const;

const questionOptionSchema = Type.Object({
  label: Type.String({
    minLength: 1,
    description: "Concise display text (1-5 words). Append '(推荐)' when recommended.",
  }),
  description: Type.String({
    description: "Brief explanation of the option's trade-offs or implications.",
  }),
});

const questionSchema = Type.Object({
  question: Type.String({
    minLength: 1,
    description: "A specific, actionable question.",
  }),
  header: Type.String({
    minLength: 1,
    maxLength: 12,
    description: "Short category tag (max 12 characters).",
  }),
  options: Type.Array(questionOptionSchema, {
    minItems: 2,
    maxItems: 4,
    description:
      "2-4 meaningful options. Do not add an Other option; the client provides custom input.",
  }),
  multiSelect: Type.Optional(
    Type.Boolean({
      description: "Whether the user may select multiple options.",
    }),
  ),
});

export const askUserSchema = Type.Object({
  questions: Type.Array(questionSchema, {
    minItems: 1,
    maxItems: 4,
    description: "The 1-4 related questions to ask the user.",
  }),
});

export type AskUserInput = Static<typeof askUserSchema>;
export type AskUserQuestion = AskUserInput["questions"][number];
export type AskUserAnswers = Record<string, string[]>;

export type AskUserRequest = {
  toolCallId: string;
  questions: AskUserQuestion[];
};

export type AskUserHandler = (
  request: AskUserRequest,
  signal?: AbortSignal,
) => Promise<AskUserAnswers | undefined>;

export interface AskUserToolDetails extends BaseDetails {
  kind: "askUser";
  questions: Array<AskUserQuestion & { answers: string[] }>;
}

export class AskUserTool extends ToolBase<typeof askUserSchema, AskUserToolDetails> {
  readonly name = ASK_USER_TOOL_NAME;
  readonly label = "询问用户";
  readonly description = `Ask the user structured questions when their input materially changes
the next action. Use this for preferences, disambiguation, or choosing between valid approaches.

Do not use this tool when the answer can be inferred from context or for trivial decisions.
Ask 1-4 related questions at once. Each question must have 2-4 concise, distinct options. The
client automatically provides a custom-answer option, so never include an Other option yourself.
Put a recommended option first and append "(推荐)" to its label. Answers are returned as
JSON keyed by the exact question text.`;
  readonly parameters = askUserSchema;
  readonly executionMode = "sequential" as const;

  protected override checkParams(input: AskUserInput): Error | undefined {
    const questions = new Set<string>();
    for (const question of input.questions) {
      const text = question.question.trim();
      if (text === "") return new Error("Question text must not be blank");
      if (questions.has(text)) return new Error(`Duplicate question text: ${text}`);
      questions.add(text);

      const labels = new Set<string>();
      for (const option of question.options) {
        const label = option.label.trim();
        if (label === "") return new Error("Option labels must not be blank");
        if (labels.has(label)) return new Error(`Duplicate option label: ${label}`);
        labels.add(label);
      }
    }
    return undefined;
  }

  protected override async run(context: ToolExecutionContext<AskUserInput, AskUserToolDetails>) {
    const handler = this.options.requestUser;
    if (!handler) throw new Error("The connected client does not support interactive questions");

    const answers =
      (await handler(
        { toolCallId: context.toolCallId, questions: context.input.questions },
        context.signal,
      )) ?? {};
    const questions = context.input.questions.map((question) => ({
      ...question,
      answers: [...(answers[question.question] ?? [])],
    }));
    const answeredCount = questions.filter((question) => question.answers.length > 0).length;

    return this.buildResponse(
      [
        {
          type: "text",
          text: JSON.stringify({
            answers: Object.fromEntries(
              questions.map((question) => [question.question, question.answers]),
            ),
            ...(answeredCount === 0
              ? { note: "User dismissed the questions without answering." }
              : {}),
          }),
        },
      ],
      {
        kind: "askUser",
        msg: `询问 ${questions.length} 个问题`,
        questions,
      },
    );
  }
}

export function createAskUserTool(
  options: ToolRuntimeOptions,
): AgentTool<typeof askUserSchema, AskUserToolDetails> {
  return new AskUserTool(options);
}
