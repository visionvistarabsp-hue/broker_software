import { matchLeadToPropertiesInputSchema } from "@/lib/validation/matching";

/** Minimal lead fields needed for matching (DB-free / easy to unit test). */
export interface LeadMatchInput {
  id: string;
  budgetMin?: number | null;
  budgetMax?: number | null;
  preferredLocation?: string | null;
  requirements?: string | null;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  createdAt?: Date | string;
}

/** Minimal property fields needed for matching. */
export interface PropertyMatchInput {
  id: string;
  title: string;
  price: number;
  city: string;
  locality?: string | null;
  type: string;
  listingType: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  area?: number | null;
  status: string;
  updatedAt: Date | string;
}

/** Result of matching a single lead against a single property. */
export interface MatchResult {
  propertyId: string;
  title: string;
  city: string;
  score: number; // 0-100
  matchReasons: string[];
  mismatches: string[];
  price: number;
  currency: string;
  available: boolean;
  lastUpdated: string;
}

/** Public contract for matchLeadToProperties. */
export interface MatchLeadToPropertiesParams {
  leadId: string;
  minScore?: number;
  limit?: number;
}

/** Output for a matched property under a lead. */
export interface MatchedProperty extends MatchResult {}

/**
 * Deterministic rule-based scoring of how well a lead matches each property.
 * Pure function: no side effects, no DB access. Callers inject lead + properties.
 *
 * Scoring (max 100):
 *   Budget fit        : 30  (within [budgetMin, budgetMax] = full;
 *                             within 20% above budgetMax = partial)
 *   Location match    : 25  (preferredLocation matches city/locality)
 *   Requirements match: 30  (keywords from free-text requirements vs property)
 *   Availability      : 15  (ACTIVE only; non-ACTIVE hard-excluded)
 *
 * Hard constraints: non-ACTIVE properties are excluded entirely.
 */
export function matchLeadToProperties(
  lead: LeadMatchInput,
  properties: PropertyMatchInput[],
  params: MatchLeadToPropertiesParams = { leadId: lead.id },
): MatchResult[] {
  const { minScore = 0, limit = 20 } = params;

  const budgetMax = lead.budgetMax ?? Number.POSITIVE_INFINITY;
  const budgetMin = lead.budgetMin ?? 0;
  const preferredLocation = (lead.preferredLocation ?? "").trim().toLowerCase();
  const requirements = (lead.requirements ?? "").trim();
  const reqKeywords = requirements
    .split(/\s+/)
    .map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter((w) => w.length >= 3);

  const propertyTypes = ["APARTMENT", "VILLA", "HOUSE", "PLOT", "COMMERCIAL", "OFFICE"];
  const listingTypes = ["SALE", "RENT", "LEASE"];

  const format = (v: number) => formatCurrency(v);

  const scored: MatchResult[] = properties
    .filter((p) => p.status === "ACTIVE")
    .map((property) => {
      const reasons: string[] = [];
      const mismatches: string[] = [];
      let score = 0;

      const price = property.price;
      const overBudgetTolerance = budgetMax * 1.2;

      // ----- Budget fit (30) -----
      if (price >= budgetMin && price <= budgetMax) {
        score += 30;
        reasons.push(
          `Price ${format(price)} is within your budget ${format(budgetMin)}\u2013${format(budgetMax)}.`,
        );
      } else if (price > budgetMax && price <= overBudgetTolerance) {
        score += 15;
        reasons.push(
          `Price ${format(price)} is slightly above your budget (up to ${format(budgetMax)}).`,
        );
      } else {
        mismatches.push(
          `Price ${format(price)} exceeds your maximum budget of ${format(budgetMax)}.`,
        );
      }

      // ----- Location match (25) -----
      const locationText = `${property.city} ${property.locality ?? ""}`.toLowerCase();
      const locMatch = preferredLocation && locationText.includes(preferredLocation);
      if (locMatch) {
        score += 25;
        reasons.push(
          `Located in ${property.city}${property.locality ? ", " + property.locality : ""}, matching your preferred location.`,
        );
      } else if (preferredLocation) {
        mismatches.push(
          `Not in your preferred location "${lead.preferredLocation}".`,
        );
      }

      // ----- Requirements match (30) -----
      let reqScore = 0;
      const reqReasons: string[] = [];
      const haystack = `${property.title} ${property.city} ${property.locality ?? ""} ${property.type} ${property.listingType}`.toLowerCase();

      const reqUpper = requirements.toUpperCase();
      const matchedType = propertyTypes.find((t) => reqUpper.includes(t));
      if (matchedType && property.type === matchedType) {
        reqScore += 10;
        reqReasons.push(`Matches your requested property type ${property.type}.`);
      }
      const matchedListing = listingTypes.find((t) => reqUpper.includes(t));
      if (matchedListing && property.listingType === matchedListing) {
        reqScore += 10;
        reqReasons.push(`Matches your requested listing type ${property.listingType}.`);
      }

      if (reqKeywords.length > 0) {
        const hits = reqKeywords.filter((k) => haystack.includes(k));
        reqScore += Math.floor((hits.length / reqKeywords.length) * 10);
        if (hits.length > 0) {
          reqReasons.push(`Requirement keywords matched: ${hits.join(", ")}.`);
        }
      }

      score += Math.min(reqScore, 30);
      reqReasons.forEach((r) => reasons.push(r));
      if (reqScore === 0 && requirements) {
        mismatches.push("No requirement keywords matched this property.");
      }

      // ----- Availability (15) -----
      score += 15;
      reasons.push("Property is currently active and available.");

      return {
        propertyId: property.id,
        title: property.title,
        city: property.city,
        score: Math.min(score, 100),
        matchReasons: reasons,
        mismatches,
        price,
        currency: "INR",
        available: property.status === "ACTIVE",
        lastUpdated: typeof property.updatedAt === "string" ? property.updatedAt : property.updatedAt.toISOString(),
      };
    })
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score || a.propertyId.localeCompare(b.propertyId))
    .slice(0, limit);

  return scored;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Parse and validate raw input for matchLeadToProperties.
 */
export function parseMatchLeadToPropertiesInput(
  input: unknown,
):
  | { success: true; data: MatchLeadToPropertiesParams }
  | { success: false; error: string } {
  const parsed = matchLeadToPropertiesInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors.map((e) => e.message).join("; ") };
  }
  return { success: true, data: parsed.data };
}

/**
 * Compute a lead's priority tier based on budget, urgency, and requirements.
 * Pure helper used by the CRM UI to surface hot leads.
 */
export function getLeadPriority(lead: LeadMatchInput): {
  tier: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  score: number;
  reasons: string[];
} {
  let score = 0;
  const reasons: string[] = [];

  // Budget size contribution (0-40)
  if (lead.budgetMax != null && lead.budgetMin != null) {
    const budgetSize = lead.budgetMax - lead.budgetMin;
    if (budgetSize >= 1000000) {
      score += 40;
      reasons.push("High-value budget (>= \u20B91,000,000).");
    } else if (budgetSize >= 500000) {
      score += 30;
      reasons.push("Mid-high budget (\u20B9500k\u2013\u20B91M).");
    } else if (budgetSize >= 100000) {
      score += 20;
      reasons.push("Moderate budget (\u20B9100k\u2013\u20B9500k).");
    } else {
      score += 10;
      reasons.push("Lower budget (< \u20B9100k).");
    }
  }

  // Explicit priority (0-30)
  switch (lead.priority) {
    case "URGENT":
      score += 30;
      reasons.push("Explicitly marked URGENT.");
      break;
    case "HIGH":
      score += 20;
      reasons.push("Priority marked HIGH.");
      break;
    case "MEDIUM":
      score += 10;
      reasons.push("Priority marked MEDIUM.");
      break;
    default:
      reasons.push("No explicit priority set.");
  }

  // Recency: created within last 7 days (0-20), within 30 days (0-10)
  if (lead.createdAt) {
    const createdAt = new Date(lead.createdAt).getTime();
    const daysSince = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
    if (!isNaN(daysSince)) {
      if (daysSince <= 7) {
        score += 20;
        reasons.push("Created within the last 7 days.");
      } else if (daysSince <= 30) {
        score += 10;
        reasons.push("Created within the last 30 days.");
      }
    }
  }

  // Has specific requirements text (0-10)
  if (lead.requirements?.trim()) {
    score += 10;
    reasons.push("Has specific property requirements.");
  }

  let tier: "LOW" | "MEDIUM" | "HIGH" | "URGENT" = "LOW";
  if (score >= 80) tier = "URGENT";
  else if (score >= 60) tier = "HIGH";
  else if (score >= 35) tier = "MEDIUM";

  return { tier, score: Math.min(score, 100), reasons };
}
