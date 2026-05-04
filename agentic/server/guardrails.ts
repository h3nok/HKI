/**
 * Guardrails Service
 * 
 * Provides input/output validation, content filtering, and safety checks
 * for the agentic platform to ensure enterprise-grade reliability.
 */

export interface GuardrailsResult {
  passed: boolean;
  violations: string[];
  score: number; // 0-100, higher is better
  metadata?: Record<string, any>;
}

export interface InputValidationOptions {
  maxLength?: number;
  minLength?: number;
  checkPII?: boolean;
  checkInjection?: boolean;
  checkToxicity?: boolean;
}

export interface OutputValidationOptions {
  checkHallucination?: boolean;
  checkQuality?: boolean;
  checkRelevance?: boolean;
  minConfidence?: number;
}

/**
 * Validate user input before processing
 */
export async function validateInput(
  input: string,
  options: InputValidationOptions = {}
): Promise<GuardrailsResult> {
  const violations: string[] = [];
  let score = 100;

  // Length validation
  const maxLength = options.maxLength || 5000;
  const minLength = options.minLength || 1;
  
  if (input.length > maxLength) {
    violations.push(`Input exceeds maximum length of ${maxLength} characters`);
    score -= 50;
  }
  
  if (input.length < minLength) {
    violations.push(`Input is too short (minimum ${minLength} characters)`);
    score -= 30;
  }

  // PII detection (basic patterns)
  if (options.checkPII !== false) {
    const piiPatterns = [
      { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, name: "SSN" },
      { pattern: /\b\d{16}\b/g, name: "Credit Card" },
      { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, name: "Email" },
      { pattern: /\b\d{3}-\d{3}-\d{4}\b/g, name: "Phone Number" },
    ];

    for (const { pattern, name } of piiPatterns) {
      if (pattern.test(input)) {
        violations.push(`Potential ${name} detected in input`);
        score -= 20;
      }
    }
  }

  // Prompt injection detection
  if (options.checkInjection !== false) {
    const injectionPatterns = [
      /ignore (previous|above) instructions/i,
      /you are now/i,
      /system prompt/i,
      /jailbreak/i,
      /DAN mode/i,
    ];

    for (const pattern of injectionPatterns) {
      if (pattern.test(input)) {
        violations.push("Potential prompt injection detected");
        score -= 40;
        break;
      }
    }
  }

  // Toxicity detection (basic keyword matching)
  if (options.checkToxicity !== false) {
    const toxicKeywords = [
      "hate", "kill", "violence", "threat", "abuse",
      // Add more as needed, or integrate with external API
    ];

    const lowerInput = input.toLowerCase();
    const foundToxic = toxicKeywords.some(keyword => lowerInput.includes(keyword));
    
    if (foundToxic) {
      violations.push("Potentially toxic content detected");
      score -= 30;
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    score: Math.max(0, score),
    metadata: {
      inputLength: input.length,
      checksPerformed: Object.keys(options).filter(k => options[k as keyof InputValidationOptions] !== false),
    },
  };
}

/**
 * Validate AI output before sending to user
 */
export async function validateOutput(
  output: string,
  userQuery: string,
  options: OutputValidationOptions = {}
): Promise<GuardrailsResult> {
  const violations: string[] = [];
  let score = 100;

  // Basic quality checks
  if (output.length < 10) {
    violations.push("Output is too short to be meaningful");
    score -= 40;
  }

  // Hallucination detection (basic heuristics)
  if (options.checkHallucination !== false) {
    const hallucinationIndicators = [
      /I don't have access/i,
      /I cannot (access|browse|see)/i,
      /as an AI/i,
      /I apologize, but I/i,
    ];

    // Check for common hallucination patterns
    const hasDisclaimers = hallucinationIndicators.some(pattern => pattern.test(output));
    
    // Check for made-up data (very basic)
    const hasSuspiciouslySpecificNumbers = /\d{10,}/g.test(output); // Long numbers might be made up
    
    if (hasSuspiciouslySpecificNumbers && !hasDisclaimers) {
      violations.push("Potential hallucination: suspiciously specific data without disclaimer");
      score -= 20;
    }
  }

  // Relevance check (basic keyword overlap)
  if (options.checkRelevance !== false) {
    const queryWords = userQuery.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const outputLower = output.toLowerCase();
    const matchedWords = queryWords.filter(word => outputLower.includes(word));
    const relevanceRatio = matchedWords.length / Math.max(queryWords.length, 1);

    if (relevanceRatio < 0.2) {
      violations.push("Output may not be relevant to the query");
      score -= 30;
    }
  }

  // Quality scoring (basic heuristics)
  if (options.checkQuality !== false) {
    // Check for complete sentences
    const sentences = output.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length === 0) {
      violations.push("Output lacks proper sentence structure");
      score -= 20;
    }

    // Check for repetition
    const words = output.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const repetitionRatio = uniqueWords.size / Math.max(words.length, 1);
    
    if (repetitionRatio < 0.4) {
      violations.push("Output contains excessive repetition");
      score -= 15;
    }
  }

  // Confidence threshold
  if (options.minConfidence && options.minConfidence > 0) {
    // This would be integrated with actual confidence scoring
    // For now, just a placeholder
  }

  return {
    passed: violations.length === 0,
    violations,
    score: Math.max(0, score),
    metadata: {
      outputLength: output.length,
      checksPerformed: Object.keys(options).filter(k => options[k as keyof OutputValidationOptions] !== false),
    },
  };
}

/**
 * Rate limiting check (simple in-memory implementation)
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  userId: string,
  maxRequests: number = 100,
  windowMs: number = 60000 // 1 minute
): GuardrailsResult {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetAt) {
    // Reset or initialize
    rateLimitMap.set(userId, { count: 1, resetAt: now + windowMs });
    return {
      passed: true,
      violations: [],
      score: 100,
      metadata: { remainingRequests: maxRequests - 1 },
    };
  }

  userLimit.count++;

  if (userLimit.count > maxRequests) {
    return {
      passed: false,
      violations: [`Rate limit exceeded: ${maxRequests} requests per ${windowMs / 1000}s`],
      score: 0,
      metadata: {
        remainingRequests: 0,
        resetAt: new Date(userLimit.resetAt).toISOString(),
      },
    };
  }

  return {
    passed: true,
    violations: [],
    score: 100,
    metadata: { remainingRequests: maxRequests - userLimit.count },
  };
}

/**
 * Combined guardrails check for input
 */
export async function checkInputGuardrails(
  input: string,
  userId: string
): Promise<GuardrailsResult> {
  // Rate limit check
  const rateLimitResult = checkRateLimit(userId);
  if (!rateLimitResult.passed) {
    return rateLimitResult;
  }

  // Input validation
  const validationResult = await validateInput(input, {
    maxLength: 5000,
    checkPII: true,
    checkInjection: true,
    checkToxicity: true,
  });

  return {
    passed: validationResult.passed,
    violations: validationResult.violations,
    score: Math.min(rateLimitResult.score, validationResult.score),
    metadata: {
      ...rateLimitResult.metadata,
      ...validationResult.metadata,
    },
  };
}

/**
 * Combined guardrails check for output
 */
export async function checkOutputGuardrails(
  output: string,
  userQuery: string
): Promise<GuardrailsResult> {
  return await validateOutput(output, userQuery, {
    checkHallucination: true,
    checkQuality: true,
    checkRelevance: true,
  });
}
