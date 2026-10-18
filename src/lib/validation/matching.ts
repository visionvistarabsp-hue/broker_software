import { z } from "zod";

export const matchLeadToPropertiesInputSchema = z.object({
  leadId: z.string().uuid("Invalid lead ID"),
  minScore: z.coerce.number().int().min(0).max(100).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type MatchLeadToPropertiesInput = z.infer<
  typeof matchLeadToPropertiesInputSchema
>;