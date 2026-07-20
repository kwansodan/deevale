export type StageKbEntry = {
  // One-liner shown under the active stage ("what's happening now").
  summary: string
  // Expandable plain-English explainer (PRD C9 knowledge base).
  learnMore: string
}

export const STAGE_KB: Record<string, StageKbEntry> = {
  name_reservation: {
    summary: "We're checking your proposed names with the ORC and reserving the best available one.",
    learnMore:
      "The Office of the Registrar of Companies keeps a register of every business name in Ghana. " +
      "We search it for conflicts, then reserve your name — the reservation holds it for you for " +
      "about 30 days while incorporation is prepared.",
  },
  incorporation: {
    summary: "Your company documents are being prepared and filed with the Registrar.",
    learnMore:
      "Incorporation creates your company as a legal person. The ORC issues a Certificate of " +
      "Incorporation (your company's birth certificate), Form 3 (its official profile), and " +
      "registers your constitution. All three land in your document vault here.",
  },
  gipc_registration: {
    summary: "We're registering your foreign investment with the Ghana Investment Promotion Centre.",
    learnMore:
      "Every company with foreign participation registers with GIPC. Two things happen first: " +
      "(1) you open a Ghana corporate bank account, and (2) the foreign equity is transferred in — " +
      "cash transfers generate a Bank of Ghana confirmation letter through your bank, while " +
      "equipment or goods use their customs import declaration as proof. We then assemble the " +
      "document pack (Certificate of Incorporation, constitution, Form 3, beneficial ownership " +
      "profile, proof of equity, GIPC forms), file it, and track it to your GIPC certificate. " +
      "The certificate is what lets you obtain work permits and repatriate profits later.",
  },
  tax_registration: {
    summary: "We're registering your company with the GRA for its tax identification number.",
    learnMore:
      "The Ghana Revenue Authority issues your company TIN — you need it to invoice, open some " +
      "bank accounts, and bid for contracts. Non-Ghanaian directors also get individual " +
      "non-citizen TINs issued against their passports; we handle both.",
  },
  ssnit_registration: {
    summary: "We're setting up your employer account with SSNIT.",
    learnMore:
      "SSNIT is Ghana's national pension scheme. Registering as an employer lets you enrol staff " +
      "and remit their monthly contributions. If you're not hiring yet, we still register the " +
      "account so it's ready when you do.",
  },
  business_operating_permit: {
    summary: "We're applying for your operating permit with the local assembly.",
    learnMore:
      "Every business premises needs a Business Operating Permit from its Metropolitan, Municipal " +
      "or District Assembly (MMDA). It renews annually — we'll remind you before it lapses.",
  },
  completed: {
    summary: "All registrations are complete — your business is fully set up!",
    learnMore:
      "Your certificates live in the document vault. Next up: annual returns, tax filings and " +
      "permit renewals — your compliance calendar tracks every deadline.",
  },
}
