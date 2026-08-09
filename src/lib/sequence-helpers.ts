import { Activity } from "@/lib/crm-types";

export type StepType =
  | "Ligação"
  | "Reunião"
  | "Videochamada"
  | "Email"
  | "WhatsApp"
  | "Instagram"
  | "LinkedIn"
  | "Outros";

export type StepUnit = "DAYS" | "WEEKS" | "MONTHS";

export type SequenceStepItem = {
  id: string;
  type: StepType;
  title: string;
  notes: string;
  emailTemplateId?: string;
  unitValue: number;
  unit: StepUnit;
  time: string;
};

export type SequenceSharing = "ONLY_ME" | "SPECIFIC_USERS" | "WORKSPACE";

export type SequenceItem = {
  id: string;
  name: string;
  description: string;
  skip_weekends: boolean;
  sharing?: SequenceSharing;
  tags: string[];
  user_id?: string;
  sequence_steps?: {
    id: string;
    step_type: string;
    day_offset: number;
    note: string;
    sort_order: number;
  }[];
};

export const STEP_TYPES: StepType[] = [
  "Ligação",
  "Reunião",
  "Videochamada",
  "Email",
  "WhatsApp",
  "Instagram",
  "LinkedIn",
  "Outros",
];

export const STEP_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Ligação":      { bg: "bg-blue-100",   text: "text-blue-700",   border: "border-blue-200" },
  "Reunião":      { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-200" },
  "Videochamada": { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-200" },
  "Email":        { bg: "bg-zinc-100",   text: "text-zinc-700",   border: "border-zinc-200" },
  "WhatsApp":     { bg: "bg-green-100",  text: "text-green-700",  border: "border-green-200" },
  "Instagram":    { bg: "bg-pink-100",   text: "text-pink-700",   border: "border-pink-200" },
  "LinkedIn":     { bg: "bg-sky-100",    text: "text-sky-700",    border: "border-sky-200" },
  "Outros":       { bg: "bg-zinc-100",   text: "text-zinc-700",   border: "border-zinc-200" },
};

export function getStepColors(type: string) {
  return STEP_TYPE_COLORS[type] || { bg: "bg-zinc-100", text: "text-zinc-700", border: "border-zinc-200" };
}

export function parseSequenceStepNote(note: string, dayOffset: number) {
  let title = "";
  let notes = "";
  let time = "";
  let unit: StepUnit = "DAYS";
  let unitValue = dayOffset;
  let emailTemplateId = "";

  try {
    const parsed = JSON.parse(note);
    title = parsed.title || "";
    notes = parsed.notes || "";
    time = parsed.time || "";
    unit = parsed.unit || "DAYS";
    unitValue = typeof parsed.unitValue === "number" ? parsed.unitValue : dayOffset;
    emailTemplateId = parsed.emailTemplateId || "";
  } catch {
    title = note || "";
  }

  return { title, notes, time, unit, unitValue, emailTemplateId };
}

/**
 * Calculates the exact scheduled date & time for each step in a sequence,
 * applying cumulative offsets and weekend skipping logic if enabled.
 */
export function calculateSequenceActivityDates(
  steps: SequenceStepItem[],
  skipWeekends: boolean,
  startDate: Date = new Date()
): Date[] {
  const resultDates: Date[] = [];
  let currentDate = new Date(startDate.getTime());

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    let offsetDays = 0;
    if (step.unit === "DAYS") {
      offsetDays = step.unitValue;
    } else if (step.unit === "WEEKS") {
      offsetDays = step.unitValue * 7;
    } else if (step.unit === "MONTHS") {
      offsetDays = step.unitValue * 30;
    }

    const targetDate = new Date(currentDate.getTime());
    targetDate.setDate(targetDate.getDate() + offsetDays);

    if (skipWeekends) {
      const dayOfWeek = targetDate.getDay(); // 0 = Sunday, 6 = Saturday
      if (dayOfWeek === 6) {
        // Saturday -> Monday (+2 days)
        targetDate.setDate(targetDate.getDate() + 2);
      } else if (dayOfWeek === 0) {
        // Sunday -> Monday (+1 day)
        targetDate.setDate(targetDate.getDate() + 1);
      }
    }

    if (step.time && step.time.trim() !== "") {
      const [hours, minutes] = step.time.split(":").map(Number);
      if (!isNaN(hours) && !isNaN(minutes)) {
        targetDate.setHours(hours, minutes, 0, 0);
      }
    }

    resultDates.push(targetDate);
    currentDate = targetDate;
  }

  return resultDates;
}

/**
 * Generates the preview subtext for a step (e.g. "1 dia após iniciar", "2 dias após concluir o passo 1").
 */
export function getStepPreviewSubtext(step: SequenceStepItem, stepIndex: number): string {
  const { unitValue, unit } = step;
  let unitStr = "";
  if (unit === "DAYS") unitStr = unitValue === 1 ? "dia" : "dias";
  else if (unit === "WEEKS") unitStr = unitValue === 1 ? "semana" : "semanas";
  else if (unit === "MONTHS") unitStr = unitValue === 1 ? "mês" : "meses";

  if (stepIndex === 0) {
    if (unitValue === 0) return "Assim que iniciar";
    return `${unitValue} ${unitStr} após iniciar`;
  } else {
    if (unitValue === 0) return `Assim que concluir o passo ${stepIndex}`;
    return `${unitValue} ${unitStr} após concluir o passo ${stepIndex}`;
  }
}

/**
 * Executes/enrolls a deal into a sequence: computes all activity dates and calls addActivity for each step.
 */
export async function enrollDealInSequence({
  dealId,
  sequence,
  addActivity,
  supabase,
}: {
  dealId: string;
  sequence: SequenceItem;
  addActivity: (activity: Omit<Activity, "id" | "createdAt" | "attachments" | "completed"> & { completed?: boolean }) => void;
  supabase?: any;
}): Promise<number> {
  const rawSteps = sequence.sequence_steps || [];
  const sortedRaw = [...rawSteps].sort((a, b) => a.sort_order - b.sort_order);

  const steps: SequenceStepItem[] = sortedRaw.map((step) => {
    const parsed = parseSequenceStepNote(step.note, step.day_offset);
    return {
      id: step.id,
      type: step.step_type as StepType,
      title: parsed.title,
      notes: parsed.notes,
      emailTemplateId: parsed.emailTemplateId,
      unitValue: parsed.unitValue,
      unit: parsed.unit,
      time: parsed.time,
    };
  });

  if (steps.length === 0) return 0;

  const dates = calculateSequenceActivityDates(steps, sequence.skip_weekends, new Date());

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const date = dates[i];

    addActivity({
      dealId,
      title: step.title.trim() || step.type,
      type: step.type,
      description: step.notes,
      date: date.toISOString(),
      completed: false,
    });
  }

  if (supabase) {
    try {
      await supabase.from("sequence_enrollments").insert({
        deal_id: dealId,
        sequence_id: sequence.id,
      });
    } catch (e) {
      console.warn("[Sequences] Could not record sequence enrollment:", e);
    }
  }

  return steps.length;
}
