// ─── NCERT Chapter Map ─────────────────────────────────────────────────────────
// Canonical NCERT chapter names for Bihar Board Class 10 and Class 12.
// Used to normalize raw chapter_name values from Firebase questions.

type SubjectChapters = Record<string, string[]>;

const CLASS10_CHAPTERS: SubjectChapters = {
  maths: [
    "Real Numbers",
    "Polynomials",
    "Pair of Linear Equations in Two Variables",
    "Quadratic Equations",
    "Arithmetic Progressions",
    "Triangles",
    "Coordinate Geometry",
    "Introduction to Trigonometry",
    "Some Applications of Trigonometry",
    "Circles",
    "Areas Related to Circles",
    "Surface Areas and Volumes",
    "Statistics",
    "Probability",
  ],
  science: [
    "Chemical Reactions and Equations",
    "Acids, Bases and Salts",
    "Metals and Non-metals",
    "Carbon and its Compounds",
    "Life Processes",
    "Control and Coordination",
    "How do Organisms Reproduce",
    "Heredity",
    "Light – Reflection and Refraction",
    "Human Eye and Colourful World",
    "Electricity",
    "Magnetic Effects of Electric Current",
    "Our Environment",
  ],
  social: [
    // History
    "The Rise of Nationalism in Europe",
    "Nationalism in India",
    "The Making of a Global World",
    "The Age of Industrialisation",
    "Print Culture and the Modern World",
    // Geography
    "Resources and Development",
    "Forest and Wildlife Resources",
    "Water Resources",
    "Agriculture",
    "Minerals and Energy Resources",
    "Manufacturing Industries",
    "Lifelines of National Economy",
    // Civics
    "Power Sharing",
    "Federalism",
    "Democracy and Diversity",
    "Gender, Religion and Caste",
    "Popular Struggles and Movements",
    "Political Parties",
    "Outcomes of Democracy",
    "Challenges to Democracy",
    // Economics
    "Development",
    "Sectors of the Indian Economy",
    "Money and Credit",
    "Globalisation and the Indian Economy",
    "Consumer Rights",
  ],
  english: [
    // First Flight
    "A Letter to God",
    "Nelson Mandela: Long Walk to Freedom",
    "Two Stories about Flying",
    "From the Diary of Anne Frank",
    "Glimpses of India",
    "Mijbil the Otter",
    "Madam Rides the Bus",
    "The Sermon at Benares",
    "The Proposal",
    // Footprints Without Feet
    "A Triumph of Surgery",
    "The Thief's Story",
    "The Midnight Visitor",
    "A Question of Trust",
    "Footprints Without Feet",
    "The Making of a Scientist",
    "The Necklace",
    "Bholi",
    "The Book that Saved the Earth",
    // Language
    "Grammar",
    "Writing Skills",
    "Comprehension",
    "Vocabulary",
    "Poetry",
    "Prose",
  ],
  hindi: [
    // Kshitij 2
    "सूरदास",
    "तुलसीदास",
    "देव",
    "जयशंकर प्रसाद",
    "सूर्यकान्त त्रिपाठी 'निराला'",
    "नागार्जुन",
    "गिरिजा कुमार माथुर",
    "ऋतुराज",
    "मंगलेश डबराल",
    // Kritika 2
    "माता का अँचल",
    "जॉर्ज पंचम की नाक",
    "साना-साना हाथ जोड़ि",
    "एही ठैयाँ झुलनी हेरानी हो रामा",
    "मैं क्यों लिखता हूँ",
    // Grammar
    "व्याकरण",
    "शब्द-भंडार",
    "साहित्य",
    "Comprehension",
    "बोधप्रश्न",
  ],
  sanskrit: [
    // Shemushi 2
    "शुचिपर्यावरणम्",
    "बुद्धिर्बलवती सदा",
    "व्यायामः सर्वदा पथ्यः",
    "शिशुलालनम्",
    "जननी तुल्यवत्सला",
    "सुभाषितानि",
    "सौहार्दं प्रकृतेः शोभा",
    "विचित्रः साक्षी",
    "सूक्तयः",
    // Grammar
    "शब्दरूप",
    "धातुरूप",
    "व्याकरण",
    "प्रत्यय",
    "समास",
    "संधि",
    "वाक्य रचना",
    "Comprehension",
  ],
};

const CLASS12_CHAPTERS: SubjectChapters = {
  physics: [
    "Electric Charges and Fields",
    "Electrostatic Potential and Capacitance",
    "Current Electricity",
    "Moving Charges and Magnetism",
    "Magnetism and Matter",
    "Electromagnetic Induction",
    "Alternating Current",
    "Electromagnetic Waves",
    "Ray Optics and Optical Instruments",
    "Wave Optics",
    "Dual Nature of Radiation and Matter",
    "Atoms",
    "Nuclei",
    "Semiconductor Electronics",
  ],
  chemistry: [
    "The Solid State",
    "Solutions",
    "Electrochemistry",
    "Chemical Kinetics",
    "Surface Chemistry",
    "General Principles and Processes of Isolation of Elements",
    "The p-Block Elements",
    "The d and f Block Elements",
    "Coordination Compounds",
    "Haloalkanes and Haloarenes",
    "Alcohols, Phenols and Ethers",
    "Aldehydes, Ketones and Carboxylic Acids",
    "Amines",
    "Biomolecules",
  ],
  biology: [
    "Reproduction in Organisms",
    "Sexual Reproduction in Flowering Plants",
    "Human Reproduction",
    "Reproductive Health",
    "Principles of Inheritance and Variation",
    "Molecular Basis of Inheritance",
    "Evolution",
    "Human Health and Disease",
    "Strategies for Enhancement in Food Production",
    "Microbes in Human Welfare",
    "Biotechnology: Principles and Processes",
    "Biotechnology and its Applications",
    "Organisms and Populations",
    "Ecosystem",
    "Biodiversity and Conservation",
    "Environmental Issues",
  ],
  maths: [
    "Relations and Functions",
    "Inverse Trigonometric Functions",
    "Matrices",
    "Determinants",
    "Continuity and Differentiability",
    "Application of Derivatives",
    "Integrals",
    "Application of Integrals",
    "Differential Equations",
    "Vector Algebra",
    "Three Dimensional Geometry",
    "Linear Programming",
    "Probability",
  ],
  social: [
    // History — Themes in Indian History III
    "Bricks, Beads and Bones",
    "Kings, Farmers and Towns",
    "Kinship, Caste and Class",
    "Thinkers, Beliefs and Buildings",
    "Through the Eyes of Travellers",
    "Bhakti-Sufi Traditions",
    "An Imperial Capital: Vijayanagara",
    "Peasants, Zamindars and the State",
    "Kings and Chronicles",
    "Colonialism and the Countryside",
    "Rebels and the Raj",
    "Colonial Cities",
    "Mahatma Gandhi and the Nationalist Movement",
    "Understanding Partition",
    "Framing the Constitution",
    // Political Science
    "The Cold War Era",
    "The End of Bipolarity",
    "US Hegemony in World Politics",
    "Alternative Centres of Power",
    "Contemporary South Asia",
    "International Organisations",
    "Security in the Contemporary World",
    "Environment and Natural Resources",
    "Globalisation",
    "Era of One-party Dominance",
    "Nation Building and Its Problems",
    "Politics of Planned Development",
    "India's External Relations",
    "Challenges to and Restoration of the Congress System",
    "Crisis of the Constitutional Order",
    "Rise of Popular Movements",
    "Regional Aspirations",
    "Recent Developments in Indian Politics",
  ],
  hindi: [
    // Aroh 2
    "हरिवंश राय बच्चन",
    "आलोक धन्वा",
    "कुँवर नारायण",
    "रघुवीर सहाय",
    "शमशेर बहादुर सिंह",
    "सूर्यकान्त त्रिपाठी 'निराला'",
    "तुलसीदास",
    "फ़िराक़ गोरखपुरी",
    "उमाशंकर जोशी",
    // Vitan 2
    "सिल्वर वेडिंग",
    "जूझ",
    "अतीत में दबे पाँव",
    "डायरी के पन्ने",
    // Grammar
    "व्याकरण",
    "निबंध",
    "पत्र लेखन",
    "साहित्य",
    "Comprehension",
  ],
  english: [
    // Flamingo
    "The Last Lesson",
    "Lost Spring",
    "Deep Water",
    "The Rattrap",
    "Indigo",
    "Poets and Pancakes",
    "The Interview",
    "Going Places",
    // Flamingo Poetry
    "My Mother at Sixty-Six",
    "An Elementary School Classroom in a Slum",
    "Keeping Quiet",
    "A Thing of Beauty",
    "A Roadside Stand",
    "Aunt Jennifer's Tigers",
    // Vistas
    "The Third Level",
    "The Tiger King",
    "Journey to the End of the Earth",
    "The Enemy",
    "Should Wizard Hit Mommy",
    "On the Face of It",
    "Evans Tries an O-level",
    "Memories of Childhood",
    // Language
    "Grammar",
    "Writing Skills",
    "Comprehension",
    "Vocabulary",
    "Poetry",
    "Prose",
  ],
};

// ─── Normalize helper ──────────────────────────────────────────────────────────

/**
 * Strip leading chapter-number patterns like:
 *   "Chapter 1", "Ch 1", "Ch-1", "1.", "01.", "1 -", "1: ", "Unit 1"
 * Also trim whitespace.
 */
function stripChapterNumber(raw: string): string {
  return raw
    .replace(/^(chapter|ch\.?|unit)\s*[-.]?\s*\d+\s*[-.:)]\s*/i, "")
    .replace(/^\d{1,2}[.):-]\s*/, "")
    .trim();
}

/**
 * Generate keyword tokens from a string for fuzzy matching.
 * Splits on non-alphanumeric chars, lowercases, and filters short words.
 */
function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9\u0900-\u097f]+/)
    .filter((t) => t.length > 2);
}

/**
 * Score how well rawTokens overlap with canonicalTokens.
 * Returns a number 0–1 (1 = full overlap).
 */
function overlapScore(rawTokens: string[], canonTokens: string[]): number {
  if (rawTokens.length === 0 || canonTokens.length === 0) return 0;
  const rawSet  = new Set(rawTokens);
  const overlap = canonTokens.filter((t) => rawSet.has(t)).length;
  return overlap / Math.max(rawTokens.length, canonTokens.length);
}

/**
 * Normalize a raw chapter string against the NCERT chapter list for a given
 * subject and class. Returns the canonical name when confident, or the
 * cleaned-up raw name otherwise.
 *
 * @param subject   Subject key e.g. "maths", "physics", "social"
 * @param classId   "10" | "12"
 * @param raw       Raw chapter_name / chapter value from Firebase
 */
export function normalizeChapter(subject: string, classId: string, raw: string): string {
  if (!raw || raw === "General" || raw === "AI Generated") return raw;

  const map     = classId === "12" ? CLASS12_CHAPTERS : CLASS10_CHAPTERS;
  const canon   = map[subject];
  if (!canon || canon.length === 0) return raw;

  const cleaned     = stripChapterNumber(raw);
  const cleanedLower = cleaned.toLowerCase();

  // 1. Exact match (case-insensitive)
  const exact = canon.find((c) => c.toLowerCase() === cleanedLower);
  if (exact) return exact;

  // 2. Canonical chapter starts-with or contains the cleaned name
  const startsWith = canon.find((c) => c.toLowerCase().startsWith(cleanedLower) && cleanedLower.length >= 5);
  if (startsWith) return startsWith;

  // 3. Cleaned name starts-with a canonical chapter
  const rawStartsWith = canon.find(
    (c) => cleanedLower.startsWith(c.toLowerCase()) && c.length >= 5
  );
  if (rawStartsWith) return rawStartsWith;

  // 4. Token overlap (fuzzy)
  const rawTokens = tokenize(cleaned);
  let bestScore = 0;
  let bestMatch = "";
  for (const c of canon) {
    const score = overlapScore(rawTokens, tokenize(c));
    if (score > bestScore) {
      bestScore = score;
      bestMatch = c;
    }
  }

  // Only accept if overlap is strong enough (≥ 0.45)
  if (bestScore >= 0.45) return bestMatch;

  // 5. Return cleaned (number-stripped) original
  return cleaned || raw;
}

/**
 * Return the ordered list of NCERT chapter names for a subject+class,
 * useful for sorting the chapter-select screen in textbook order.
 */
export function getCanonicalChapters(subject: string, classId: string): string[] {
  const map = classId === "12" ? CLASS12_CHAPTERS : CLASS10_CHAPTERS;
  return map[subject] ?? [];
}
