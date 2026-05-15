// @ts-nocheck
import { Router } from "express";
import { genai } from "../lib/gemini";

const router = Router();

// ─── Topic banks ──────────────────────────────────────────────────────────────

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

// ─── Route ────────────────────────────────────────────────────────────────────

router.post("/api/generate-mock-questions", async (req, res) => {
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

    let prompt: string;

    if (isNumerical) {
      // JEE Section B – Numerical Answer Type
      prompt = `You are an expert ${examName} question setter specializing in ${subject.toUpperCase()}.

Generate EXACTLY ${count} JEE Main Session-level NUMERICAL ANSWER TYPE questions covering these topics: ${topics}.

Rules:
- Each question requires a specific numerical answer (integer 0-9 or decimal ≤ 2 places)
- Difficulty: Medium to Hard (matching actual JEE Main difficulty)
- Use $...$ for inline math and $$...$$ for display math (LaTeX/KaTeX format)
- Provide a brief Hindi translation of each question
- Answer must be deterministic — no ambiguity
- Do NOT generate MCQ — these are numerical type only

Return ONLY a valid JSON array. No markdown. No explanation.

[
  {
    "english": "A block of mass $2$ kg is released from rest on a frictionless incline making angle $30°$...",
    "hindi": "एक $2$ kg द्रव्यमान का ब्लॉक...",
    "options": [],
    "optionsHindi": [],
    "answerIndex": -1,
    "section": "B",
    "correctNumerical": "5"
  }
]`;
    } else {
      // MCQ questions (Section A for JEE, all for NEET)
      const difficultyLine = examType === "jee"
        ? "Difficulty: Mix of Medium and Hard (60% medium, 40% hard). Only 1 correct option."
        : "Difficulty: Mix of Easy, Medium, and Hard (NCERT-based). 1 correct option from 4.";

      prompt = `You are an expert ${examName} question setter specializing in ${subject.toUpperCase()}.

Generate EXACTLY ${count} ${examName}-level MCQ questions covering these high-yield topics: ${topics}.

${difficultyLine}

Rules:
- Questions must match the actual ${examName} pattern and style
- Use $...$ for inline math and $$...$$ for display math (KaTeX/LaTeX compatible)
- Each question has EXACTLY 4 options (A, B, C, D)
- Provide Hindi translations for both question and options
- answerIndex: 0=A, 1=B, 2=C, 3=D
- Vary question types: conceptual, numerical calculation, assertion-reason style
- Avoid trivial or definition-only questions

Return ONLY a valid JSON array. No markdown. No code fences. No explanation.

[
  {
    "english": "An electron is moving with velocity $v$ in a magnetic field $B$...",
    "hindi": "एक इलेक्ट्रॉन वेग $v$ से चुंबकीय क्षेत्र $B$ में गति कर रहा है...",
    "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
    "optionsHindi": ["विकल्प A", "विकल्प B", "विकल्प C", "विकल्प D"],
    "answerIndex": 1,
    "section": "A",
    "correctNumerical": null
  }
]`;
    }

    const response = await genai.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        maxOutputTokens: 8192,
        temperature: 0.7,
        responseMimeType: "application/json",
      },
    });

    const raw = (response.text ?? "").trim();
    let questions: unknown[];
    try {
      questions = JSON.parse(raw);
    } catch {
      const match = raw.match(/\[[\s\S]*\]/);
      questions = match ? JSON.parse(match[0]) : [];
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(500).json({ error: "AI returned no questions" });
    }

    // Validate and clean
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
