// @ts-nocheck
import { Router } from "express";
import { genai } from "../lib/gemini";

const router = Router();

function extractJsonObjects(text: string): Record<string, unknown>[] {
  const objects: Record<string, unknown>[] = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (text[i] === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        const slice = text.slice(start, i + 1)
          .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")
          .replace(/,(\s*[}\]])/g, "$1");
        try { objects.push(JSON.parse(slice)); } catch { /* skip */ }
        start = -1;
      }
    }
  }
  return objects;
}

const JEE_TOPICS: Record<string, string[]> = {
  physics: [
    "Kinematics and Projectile Motion", "Laws of Motion and Friction",
    "Work, Energy and Power", "Rotational Mechanics and Angular Momentum",
    "Gravitation", "Simple Harmonic Motion", "Waves and Sound",
    "Thermodynamics and Kinetic Theory", "Electrostatics and Electric Field",
    "Capacitance", "Current Electricity and Ohm's Law",
    "Magnetic Effects of Current and Biot-Savart Law",
    "Electromagnetic Induction and Faraday's Law",
    "Alternating Current and LC Circuits", "Ray Optics and Refraction",
    "Wave Optics and Interference", "Dual Nature of Matter and Photoelectric Effect",
    "Atoms and Bohr Model", "Nuclear Physics", "Semiconductor Electronics",
  ],
  chemistry: [
    "Mole Concept and Stoichiometry", "Atomic Structure and Quantum Numbers",
    "Chemical Bonding (VSEPR, Hybridization)", "Gaseous State",
    "Chemical Thermodynamics", "Chemical Equilibrium", "Ionic Equilibrium and pH",
    "Electrochemistry", "Chemical Kinetics", "Solutions and Colligative Properties",
    "Surface Chemistry", "Solid State", "p-Block Elements",
    "d and f Block Elements", "Coordination Compounds",
    "General Organic Chemistry and Isomerism", "Hydrocarbons",
    "Haloalkanes and Haloarenes", "Alcohols, Phenols and Ethers",
    "Aldehydes, Ketones and Carboxylic Acids", "Amines",
    "Biomolecules", "Polymers",
  ],
  maths: [
    "Complex Numbers and Quadratic Equations", "Sequences and Series (AP/GP/HP)",
    "Matrices and Determinants", "Permutations and Combinations",
    "Binomial Theorem", "Limits, Continuity and Differentiability",
    "Applications of Derivatives", "Indefinite and Definite Integration",
    "Differential Equations", "Coordinate Geometry - Straight Lines",
    "Circles", "Parabola, Ellipse and Hyperbola",
    "3D Geometry and Direction Cosines", "Vectors and Cross Products",
    "Trigonometric Functions and Identities", "Inverse Trigonometry",
    "Probability and Bayes Theorem", "Statistics",
  ],
};

const NEET_TOPICS: Record<string, string[]> = {
  physics: [
    "Physical World and Measurement", "Kinematics", "Laws of Motion",
    "Work, Energy and Power", "Motion of System of Particles",
    "Gravitation", "Properties of Bulk Matter", "Thermodynamics",
    "Behaviour of Perfect Gas and Kinetic Theory", "Oscillations and Waves",
    "Electrostatics", "Current Electricity", "Magnetic Effects of Current and Magnetism",
    "Electromagnetic Induction and Alternating Currents",
    "Electromagnetic Waves", "Optics", "Dual Nature of Matter and Radiation",
    "Atoms and Nuclei", "Electronic Devices",
  ],
  chemistry: [
    "Some Basic Concepts of Chemistry", "Structure of Atom",
    "Classification of Elements and Periodicity", "Chemical Bonding and Molecular Structure",
    "States of Matter", "Thermodynamics", "Equilibrium",
    "Redox Reactions", "Hydrogen", "s-Block Elements",
    "p-Block Elements", "Organic Chemistry – Basic Principles",
    "Hydrocarbons", "Environmental Chemistry", "Solid State",
    "Solutions", "Electrochemistry", "Chemical Kinetics",
    "Surface Chemistry", "d and f Block Elements",
    "Coordination Compounds", "Haloalkanes and Haloarenes",
    "Alcohols, Phenols and Ethers", "Aldehydes, Ketones and Acids",
    "Amines", "Biomolecules", "Polymers", "Chemistry in Everyday Life",
  ],
  biology: [
    "Cell: The Unit of Life and Cell Organelles",
    "Biomolecules – Proteins, Lipids, Carbohydrates, Nucleic Acids",
    "Cell Division – Mitosis and Meiosis",
    "Genetics – Mendelian Inheritance and Chromosomal Theory",
    "Molecular Basis of Inheritance – DNA Replication and Transcription",
    "Evolution and Natural Selection",
    "Human Digestive System and Nutrition",
    "Human Respiratory System and Gas Exchange",
    "Human Circulatory System and Blood Groups",
    "Human Excretory System and Kidney Function",
    "Nervous System and Reflex Actions",
    "Endocrine System and Hormones",
    "Locomotion and Skeletal System",
    "Plant Morphology and Anatomy",
    "Transport in Plants – Osmosis and Transpiration",
    "Mineral Nutrition in Plants",
    "Photosynthesis and Calvin Cycle",
    "Respiration in Plants",
    "Plant Growth Regulators and Phytohormones",
    "Sexual Reproduction in Plants",
    "Reproduction in Animals",
    "Ecosystem Structure and Nutrient Cycles",
    "Biodiversity and Conservation",
    "Biotechnology – PCR, Recombinant DNA",
    "Microbes in Human Welfare",
    "Health, Disease and Immunity",
  ],
};

function pickTopics(bank: string[], count: number): string {
  const shuffled = [...bank].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length)).join(", ");
}

router.post("/generate-mock-questions", async (req, res) => {
  try {
    const { examType, subject, section, count } = req.body as {
      examType: "jee" | "neet";
      subject: string;
      section: "A" | "B";
      count: number;
    };

    if (!examType || !subject || !count || count < 1) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const topicBank = examType === "jee"
      ? JEE_TOPICS[subject] ?? JEE_TOPICS.physics
      : NEET_TOPICS[subject] ?? NEET_TOPICS.biology;

    const topics = pickTopics(topicBank, 5);
    const examName = examType === "jee" ? "JEE Main" : "NEET";
    const isNumerical = section === "B";
    const isNEET = examType === "neet";

    let prompt: string;

    if (isNumerical) {
      prompt = `You are an expert JEE Main question setter for ${subject.toUpperCase()} with 10+ years of NTA paper-setting experience.

Generate EXACTLY ${count} JEE Main NUMERICAL ANSWER TYPE (Section B) questions covering: ${topics}.

Strictly follow NTA JEE Main 2022-2025 Numerical Type pattern:
- Answer is a non-negative integer (0-9) or decimal rounded to 2 decimal places
- No options — purely numerical
- Difficulty: 60% medium, 40% hard (matching actual JEE Main Session paper difficulty)
- Question types: derive a value, calculate a result, find n/coefficient/ratio
- Use $...$ for inline math and $$...$$ for display equations (KaTeX)
- Based on NCERT Class 11-12 + JEE advanced concepts
- Answer must be unique and deterministic — no ambiguity

Return ONLY a valid JSON array. No markdown. No explanation.

[
  {
    "english": "A block of mass $m = 2$ kg rests on a frictionless incline at $30°$...",
    "hindi": "एक $m = 2$ kg का ब्लॉक $30°$ के घर्षण-रहित आनत तल पर...",
    "options": [],
    "optionsHindi": [],
    "answerIndex": -1,
    "section": "B",
    "correctNumerical": "5"
  }
]`;
    } else if (isNEET) {
      prompt = `You are an expert NTA NEET question setter for ${subject.toUpperCase()} with deep knowledge of NEET 2020-2025 papers.

Generate EXACTLY ${count} NEET MCQ questions covering high-weightage topics: ${topics}.

Strictly follow NTA NEET official pattern:
- 100% based on NCERT Class 11 & 12 ${subject} textbooks (NEET is strictly NCERT-based)
- Question types: factual recall (30%), conceptual understanding (40%), application/diagram-based (30%)
- Include 1-2 assertion-reason or match-the-column type questions (as in recent NEET papers)
- Difficulty: 50% medium (direct NCERT), 30% conceptual, 20% application-based
- Distractors must be from NCERT content (closely related facts that students commonly confuse)
- Avoid trick questions — focus on genuine conceptual clarity

STRICT RULES:
- Each question has EXACTLY 4 options (only 1 correct)
- answerIndex: 0=A, 1=B, 2=C, 3=D
- Use $...$ for inline math, $$...$$ for equations (KaTeX)
- "hindi": Hindi translation of the question
- "optionsHindi": same 4 options in Hindi
- "section": "A"
- "correctNumerical": null

Return ONLY a valid JSON array. No markdown. No code fences.

[
  {
    "english": "Which of the following is the site of ribosome synthesis in eukaryotic cells?",
    "hindi": "यूकेरियोटिक कोशिकाओं में राइबोसोम संश्लेषण का स्थल कौन सा है?",
    "options": ["Nucleolus", "Nucleus", "Endoplasmic Reticulum", "Golgi Apparatus"],
    "optionsHindi": ["न्यूक्लियोलस", "केंद्रक", "अंतर्प्रद्रव्यी जालिका", "गॉल्जी उपकरण"],
    "answerIndex": 0,
    "section": "A",
    "correctNumerical": null
  }
]`;
    } else {
      // JEE Main Section A MCQ
      prompt = `You are an expert NTA JEE Main question setter for ${subject.toUpperCase()} with 10+ years of NTA paper-setting experience.

Generate EXACTLY ${count} JEE Main Section A MCQ questions covering: ${topics}.

Strictly follow NTA JEE Main 2022-2025 MCQ pattern:
- Mix of question types as per actual JEE Main: conceptual (30%), numerical-based MCQ (40%), statement/assertion-reason (15%), match-the-column/diagram (15%)
- Difficulty: 40% medium, 60% hard (JEE Main standard — not trivial, not impossible)
- Based on NCERT Class 11-12 + standard JEE reference level
- All 4 options must be plausible — distractors should target common JEE misconceptions
- Include at least 1 question involving multi-step reasoning or calculation
- Only 1 correct option from 4

STRICT RULES:
- Each question has EXACTLY 4 options (only 1 correct)
- answerIndex: 0=A, 1=B, 2=C, 3=D
- Use $...$ for inline math, $$...$$ for display equations (KaTeX)
- "hindi": Hindi translation of the question
- "optionsHindi": same 4 options in Hindi
- "section": "A"
- "correctNumerical": null

Return ONLY a valid JSON array. No markdown. No code fences.

[
  {
    "english": "An electron is accelerated through a potential difference of $V$ volts...",
    "hindi": "एक इलेक्ट्रॉन को $V$ वोल्ट के विभवांतर से त्वरित किया जाता है...",
    "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
    "optionsHindi": ["विकल्प A", "विकल्प B", "विकल्प C", "विकल्प D"],
    "answerIndex": 1,
    "section": "A",
    "correctNumerical": null
  }
]`;
    }

    const response = await genai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        maxOutputTokens: 16384,
        temperature: 0.6,
        responseMimeType: "application/json",
      },
    });

    const rawText = (response.text ?? "").trim();
    let raw = rawText;
    raw = raw.replace(/^```json\s*/, "").replace(/\s*```$/, "").trim();

    let parsed: unknown;
    let parseError = "";
    try {
      parsed = JSON.parse(raw);
    } catch (e1) {
      parseError = String(e1);
      const match = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (match) {
        let cleaned = match[0]
          .replace(/\\\n/g, "\\n").replace(/\\\t/g, "\\t")
          .replace(/\\"/g, '\\"').replace(/\\'/g, "'")
          .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")
          .replace(/,(\s*[}\]])/g, "$1");
        try {
          parsed = JSON.parse(cleaned);
          parseError = "";
        } catch (e2) {
          parseError += " | fallback: " + String(e2);
          parsed = null;
        }
      } else {
        parsed = null;
      }
    }

    let questions: unknown[];
    if (Array.isArray(parsed)) {
      questions = parsed;
    } else if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      questions = [parsed];
    } else {
      questions = [];
    }

    if (questions.length === 0 && rawText.includes("{") && rawText.includes("}")) {
      questions = extractJsonObjects(rawText);
    }

    if (questions.length === 0) {
      console.error("generate-mock: empty questions. parseError:", parseError, "raw preview:", rawText.slice(0, 200));
      return res.status(500).json({ error: "AI returned no questions", detail: parseError || "empty array" });
    }

    const cleaned = (questions as Record<string, unknown>[])
      .map((q) => ({
        english:          String(q.english          ?? ""),
        hindi:            String(q.hindi            ?? ""),
        options:          Array.isArray(q.options)          ? (q.options          as unknown[]).map(String) : [],
        optionsHindi:     Array.isArray(q.optionsHindi)     ? (q.optionsHindi     as unknown[]).map(String) : [],
        answerIndex:      typeof q.answerIndex === "number" ? q.answerIndex       : -1,
        section:          String(q.section          ?? section),
        correctNumerical: q.correctNumerical != null ? String(q.correctNumerical) : null,
      }))
      .filter((q) => q.english.length > 5);

    res.json(cleaned);
  } catch (err: unknown) {
    console.error("generate-mock error:", err);
    res.status(500).json({ error: "Question generation failed", detail: String(err) });
  }
});

export default router;
