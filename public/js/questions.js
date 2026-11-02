// The five metrics and the ten questions.
//
// PART A (5 questions) reads the LIFE-CYCLE STAGE. Each answer is a signal students can see for themselves
//   (reputation, recruiters, processes, faculty, salary direction) and each option "votes" for a stage.
// PART B (5 questions) finds the BOTTLENECK. One question per metric: a rating (strengths / weaknesses) and then
//   the specific causes behind it, some with a follow-up detail (which department, which sector, which cost).
//
// Answers:  { stage:{a1..a5:'intro'|'growth'|'mature'|'decline'|null}, ratings:{metric:1..5|null},
//             causes:{metric:[causeId]}, details:{causeId:value} }

export const METRICS = [
  { id: "salary", label: "Median salary (CTC)", short: "Salary", weight: 0.2, uses: "FT weighted salary · QS return on investment" },
  { id: "roi", label: "Return on investment", short: "ROI", weight: 0.2, uses: "QS return on investment & payback · FT value for money" },
  { id: "faculty", label: "Faculty with PhDs", short: "Faculty", weight: 0.2, uses: "QS thought leadership · FT faculty with doctorates" },
  { id: "research", label: "Research output per faculty", short: "Research", weight: 0.2, uses: "QS research impact · FT research rank" },
  { id: "diversity", label: "Diversity (women & international)", short: "Diversity", weight: 0.2, uses: "QS diversity · FT diversity criteria" },
];

export const STAGE_NAME = { intro: "Introduction", growth: "Growth", mature: "Maturity", decline: "Decline" };
export const STAGE_ORDER = ["intro", "growth", "mature", "decline"];
export const STAGE_CODE = Object.fromEntries(Object.entries(STAGE_NAME).map(([k, v]) => [v, k]));
// where each stage sits on the life-cycle curve (0..1), used by the live marker
export const STAGE_POS = { intro: 0.1, growth: 0.4, mature: 0.72, decline: 0.92 };

const opt = (v, label, sub) => ({ v, label, sub });

export const STAGE_QUESTIONS = [
  { id: "a1", signal: "Reputation",
    prompt: "When you tell people outside college where you study, what do they say?",
    options: [
      opt("intro", "“Never heard of it.”", "Most people have no idea"),
      opt("growth", "“Is that the new IIM? Sounds promising.”", "Known, and rising"),
      opt("mature", "“Great place, everyone knows it.”", "A settled, respected name"),
      opt("decline", "“It was better known a few years ago.”", "The shine is fading"),
    ] },
  { id: "a2", signal: "Recruiters",
    prompt: "Think about the companies that visit campus. How does that compare with 2–3 years ago?",
    options: [
      opt("intro", "Very few come, and most are visiting for the first time"),
      opt("growth", "More new companies show up every year"),
      opt("mature", "The same well-known names return every year"),
      opt("decline", "Some regular recruiters have stopped coming"),
    ] },
  { id: "a3", signal: "Processes",
    prompt: "How do everyday processes feel: timetables, exams, approvals, hostel, library?",
    options: [
      opt("intro", "Still being worked out as we go"),
      opt("growth", "Visibly better every term"),
      opt("mature", "Smooth and predictable"),
      opt("decline", "They used to work; now there are delays and backlogs"),
    ] },
  { id: "a4", signal: "Faculty",
    prompt: "What is happening with the faculty in your programme?",
    options: [
      opt("intro", "The team is still forming and many positions are open"),
      opt("growth", "New faculty keep joining and more courses are added"),
      opt("mature", "A stable team; little changes year to year"),
      opt("decline", "Experienced faculty are leaving and posts stay empty"),
    ] },
  { id: "a5", signal: "Salary direction",
    prompt: "Over the last 2–3 years, the offers students receive have been…",
    options: [
      opt("intro", "Too early to say: there is little placement history"),
      opt("growth", "Rising clearly each year"),
      opt("mature", "Roughly flat: the level has settled"),
      opt("decline", "Falling"),
    ] },
];

const levels = (a, b, c, d, e) => [a, b, c, d, e];

// causes: { id, label, detail?: { prompt, options[] } }
export const METRIC_QUESTIONS = [
  { id: "b1", metric: "salary",
    prompt: "How do the salary offers your seniors receive compare with the top IIMs (Ahmedabad, Bangalore, Calcutta)?",
    hint: "Think of the typical offer, not the highest one.",
    levels: levels("Far below", "Below", "Halfway", "Close", "On par"),
    causePrompt: "What holds offers back here?",
    causes: [
      { id: "s1", label: "A whole sector is missing from recruiters",
        detail: { prompt: "Which sector?", options: ["Consulting", "Investment banking & finance", "Product & technology", "FMCG & marketing", "Analytics & data", "Operations & supply chain"] } },
      { id: "s2", label: "Most offers are sales, operations or back-office roles" },
      { id: "s3", label: "A few students get top offers; the median stays low" },
      { id: "s4", label: "Students are under-prepared for premium roles",
        detail: { prompt: "Prepared in what?", options: ["Case and consulting interviews", "Finance and valuation", "Technical and analytics skills", "Interview and communication"] } },
      { id: "s5", label: "Recruiters are reluctant because of the campus location" },
      { id: "s6", label: "Recruiters pay less here than at similar IIMs for the same role" },
    ] },
  { id: "b2", metric: "roi",
    prompt: "How confident are you that the programme fee will be recovered within about 3 years of graduating?",
    hint: "Count the fee, living costs and the pay you realistically expect.",
    levels: levels("Not at all", "Doubtful", "Maybe", "Fairly", "Very"),
    causePrompt: "What weakens the payoff?",
    causes: [
      { id: "r1", label: "The fee is high compared with the pay on offer" },
      { id: "r2", label: "Loan repayments and interest take too much" },
      { id: "r3", label: "Costs beyond the fee add up",
        detail: { prompt: "Which cost hurts most?", options: ["Hostel and mess", "Travel to and from campus", "Books, laptops and tools", "Living costs near campus"] } },
      { id: "r4", label: "Few scholarships or fee-relief options" },
      { id: "r5", label: "Internships pay little or nothing" },
      { id: "r6", label: "Pay grows slowly after the first job" },
    ] },
  { id: "b3", metric: "faculty",
    prompt: "How much of your teaching comes from permanent faculty with PhDs, rather than visiting or adjunct faculty?",
    levels: levels("Almost none", "A few courses", "About half", "Most courses", "Almost all"),
    causePrompt: "What is wrong with the faculty side?",
    causes: [
      { id: "f1", label: "Too few permanent faculty in one department",
        detail: { prompt: "Which department?", options: ["Finance & accounting", "Marketing", "Operations & analytics", "HR & organisational behaviour", "Strategy & economics", "Computing & technology", "Communication & languages"] } },
      { id: "f2", label: "Visiting or adjunct faculty teach many courses",
        detail: { prompt: "Which courses?", options: ["Core courses", "Electives", "Skill labs and workshops"] } },
      { id: "f3", label: "Faculty leave, or posts stay vacant" },
      { id: "f4", label: "Faculty hold PhDs but the teaching is weak" },
      { id: "f5", label: "Faculty have little industry exposure or live projects" },
      { id: "f6", label: "Classes are too large for the faculty available" },
    ] },
  { id: "b4", metric: "research",
    prompt: "How visible is faculty research in your learning: their papers in class, research projects, student research roles?",
    levels: levels("Invisible", "Rarely", "Sometimes", "Often", "Everywhere"),
    causePrompt: "Why is research not showing up?",
    causes: [
      { id: "x1", label: "A heavy teaching load leaves faculty little research time" },
      { id: "x2", label: "Students get no chance to join research" },
      { id: "x3", label: "Weak access to research resources",
        detail: { prompt: "Which resource?", options: ["Journal databases (Scopus, EBSCO)", "Case databases", "Library collection", "Statistical software"] } },
      { id: "x4", label: "Few papers reach top journals" },
      { id: "x5", label: "Little funding or seed grants" },
      { id: "x6", label: "Few research seminars or visiting scholars" },
    ] },
  { id: "b5", metric: "diversity",
    prompt: "How diverse is your class: gender balance, and students or faculty from other regions and countries?",
    levels: levels("Not at all", "Slightly", "Moderately", "Quite", "Very"),
    causePrompt: "Where does diversity fall short?",
    causes: [
      { id: "d1", label: "Low share of women in the class" },
      { id: "d2", label: "Few international students or exchange partners" },
      { id: "d3", label: "Faculty come mostly from one region" },
      { id: "d4", label: "Students come mostly from one state or background" },
      { id: "d5", label: "Weak support for women: hostel, safety, mentoring" },
      { id: "d6", label: "Admission outreach reaches only a few regions" },
    ] },
];

export const QUESTIONS = [
  ...STAGE_QUESTIONS.map((q) => ({ ...q, kind: "stage", part: "A" })),
  ...METRIC_QUESTIONS.map((q) => ({ ...q, kind: "metric", part: "B" })),
];

export const CAUSES = Object.fromEntries(METRIC_QUESTIONS.map((q) => [q.metric, q.causes]));
export const CAUSE_BY_ID = Object.fromEntries(METRIC_QUESTIONS.flatMap((q) => q.causes.map((c) => [c.id, { ...c, metric: q.metric }])));

export const PROGRAMMES = ["Undergraduate (BBA/BMS)", "MBA / PGP", "Other programme"];
export const YEARS_OF_STUDY = ["1st", "2nd", "3rd", "4th or later"];
