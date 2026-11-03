/**
 * Guess or Splash — TOEIC-oriented word bank
 * Each entry: word, two English clue sentences, optional Korean gloss for final hint
 */
const WORD_BANK = [
  {
    word: "backpack",
    clues: [
      "You use this to carry books and other things.",
      "Students often take it to school.",
    ],
    meaning: "배낭",
  },
  {
    word: "deadline",
    clues: [
      "This is the latest time by which something must be finished.",
      "Workers often rush to finish a project before this day.",
    ],
    meaning: "마감일",
  },
  {
    word: "interview",
    clues: [
      "A formal meeting where someone answers questions for a job.",
      "Many applicants prepare carefully before this important event.",
    ],
    meaning: "면접",
  },
  {
    word: "schedule",
    clues: [
      "A plan that shows when events or tasks will happen.",
      "Businesspeople check this to know their meetings for the day.",
    ],
    meaning: "일정",
  },
  {
    word: "customer",
    clues: [
      "A person who buys goods or services from a shop.",
      "Stores try hard to keep this person happy and coming back.",
    ],
    meaning: "고객",
  },
  {
    word: "budget",
    clues: [
      "A plan for how much money you can spend.",
      "Companies make this every year to control costs.",
    ],
    meaning: "예산",
  },
  {
    word: "contract",
    clues: [
      "A legal written agreement between two or more parties.",
      "Employees often sign this when they start a new job.",
    ],
    meaning: "계약",
  },
  {
    word: "employee",
    clues: [
      "A person who works for a company and receives a salary.",
      "Managers train this person to do their job well.",
    ],
    meaning: "직원",
  },
  {
    word: "invoice",
    clues: [
      "A document that lists products sold and asks for payment.",
      "Accounting teams send this to clients after a sale.",
    ],
    meaning: "청구서",
  },
  {
    word: "refund",
    clues: [
      "Money returned to you when you send a product back.",
      "Customers may request this if an item is damaged.",
    ],
    meaning: "환불",
  },
  {
    word: "shipment",
    clues: [
      "A load of goods that is sent from one place to another.",
      "Warehouses prepare this carefully before delivery trucks leave.",
    ],
    meaning: "화물 수송",
  },
  {
    word: "warranty",
    clues: [
      "A promise that a company will repair a product for free for a period.",
      "Buyers check this before purchasing expensive electronics.",
    ],
    meaning: "보증",
  },
  {
    word: "brochure",
    clues: [
      "A small booklet with pictures that advertises a product or place.",
      "Travel agencies give this to tourists with hotel information.",
    ],
    meaning: "브로슈어 / 안내 책자",
  },
  {
    word: "conference",
    clues: [
      "A large meeting where people discuss ideas in their field.",
      "Experts travel to this event to share research and network.",
    ],
    meaning: "회의 / 학회",
  },
  {
    word: "reservation",
    clues: [
      "An arrangement to keep a table, room, or seat for later.",
      "Diners often make this by phone before visiting a popular restaurant.",
    ],
    meaning: "예약",
  },
  {
    word: "applicant",
    clues: [
      "A person who formally asks for a job or a place at school.",
      "HR reviews this person's resume before calling for an interview.",
    ],
    meaning: "지원자",
  },
  {
    word: "negotiate",
    clues: [
      "To discuss something in order to reach an agreement.",
      "Buyers and sellers often do this to decide on a fair price.",
    ],
    meaning: "협상하다",
  },
  {
    word: "efficient",
    clues: [
      "Working well without wasting time, money, or energy.",
      "A good manager wants an office that is organized and this.",
    ],
    meaning: "효율적인",
  },
  {
    word: "postpone",
    clues: [
      "To decide that something will happen at a later time.",
      "If it rains heavily, organizers may do this to an outdoor event.",
    ],
    meaning: "연기하다",
  },
  {
    word: "inventory",
    clues: [
      "A complete list of items that a store currently has in stock.",
      "Managers count this regularly to know what needs to be reordered.",
    ],
    meaning: "재고",
  },
  {
    word: "colleague",
    clues: [
      "A person who works with you in the same organization.",
      "You might ask this person for help on a shared project.",
    ],
    meaning: "동료",
  },
  {
    word: "passenger",
    clues: [
      "A person who rides in a vehicle but is not the driver.",
      "Airports check this person's ticket and passport before boarding.",
    ],
    meaning: "승객",
  },
  {
    word: "advertise",
    clues: [
      "To tell the public about a product so they will buy it.",
      "Companies often do this on television, websites, and billboards.",
    ],
    meaning: "광고하다",
  },
  {
    word: "manufacture",
    clues: [
      "To make products in large amounts, usually in a factory.",
      "Car companies do this of vehicles for markets around the world.",
    ],
    meaning: "제조하다",
  },
  {
    word: "competent",
    clues: [
      "Having enough skill or knowledge to do something well.",
      "Employers look for this kind of worker who can handle tasks alone.",
    ],
    meaning: "유능한",
  },
  {
    word: "temporary",
    clues: [
      "Lasting for only a limited period of time, not permanent.",
      "Students may take this kind of job during summer vacation.",
    ],
    meaning: "일시적인",
  },
  {
    word: "acknowledge",
    clues: [
      "To accept or admit that something is true or exists.",
      "A good leader will do this of a mistake and then fix it.",
    ],
    meaning: "인정하다",
  },
  {
    word: "substantial",
    clues: [
      "Large in amount, size, or importance.",
      "The company made a this profit after launching a new product.",
    ],
    meaning: "상당한",
  },
  {
    word: "accommodate",
    clues: [
      "To provide a place to stay, or to adjust to someone's needs.",
      "Hotels do this of many guests during the holiday season.",
    ],
    meaning: "수용하다 / 편의를 제공하다",
  },
  {
    word: "commodity",
    clues: [
      "A raw material or product that can be bought and sold.",
      "Oil, gold, and wheat are common examples of this in trade.",
    ],
    meaning: "상품 / 원자재",
  },
];
