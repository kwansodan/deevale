export interface ServiceStep {
  name: string
  description: string
  duration: string
}

export interface ServiceFaq {
  question: string
  answer: string
}

export interface ServiceTable {
  caption: string
  headers: string[]
  rows: string[][]
}

export interface ServiceItem {
  slug: string
  category: "Entity Incorporation" | "Regulatory & Compliance"
  title: string
  shortTitle: string
  heroBadge: string
  metaTitle: string
  metaDescription: string
  keywords: string
  snippet: string
  agency: string
  statutoryAct: string
  timeline: string
  indicativeFeeMinor: number
  entityCode?: string
  deliverables: string[]
  whoNeedsThis: string[]
  requirements: string[]
  steps: ServiceStep[]
  table: ServiceTable
  faqs: ServiceFaq[]
}

export const SERVICES: ServiceItem[] = [
  {
    slug: "company-limited-by-shares",
    category: "Entity Incorporation",
    title: "Company Limited by Shares (LTD) Registration in Ghana",
    shortTitle: "Company Limited by Shares (LTD)",
    heroBadge: "Companies Act 2019 (Act 992) • ORC Incorporation",
    metaTitle: "Company Limited by Shares Registration Ghana | ORC Incorporation - Deevale GH",
    metaDescription:
      "Statutory incorporation for a Company Limited by Shares (LTD) in Ghana under Act 992. Includes ORC name reservation, Form 3, Form 4, Constitution, and Certificate of Incorporation.",
    keywords:
      "company limited by shares ghana, register ltd company ghana, orc company registration, act 992 incorporation accra, business registration ghana cost",
    snippet:
      "A Company Limited by Shares (LTD) is Ghana's primary commercial vehicle under Act 992. It limits shareholder liability to unpaid share capital and requires at least two directors (minimum one ordinarily resident in Ghana), a qualified company secretary, and an independent ICAG auditor.",
    agency: "Office of the Registrar of Companies (ORC)",
    statutoryAct: "Companies Act, 2019 (Act 992)",
    timeline: "5 to 10 business days",
    indicativeFeeMinor: 179500,
    entityCode: "company_limited_by_shares",
    deliverables: [
      "Official ORC Business Name Reservation Certificate",
      "Official Certificate of Incorporation",
      "Certified True Copy of Form 3 (Statement of Particulars)",
      "Certified True Copy of Form 4 (Director & Secretary Consents)",
      "Registered Company Constitution (Regulations)",
      "Corporate Tax Identification Number (GRA Corporate TIN)",
    ],
    whoNeedsThis: [
      "Startups and commercial technology ventures raising venture capital or outside investment",
      "General trading, consulting, engineering, fintech, and commercial service enterprises",
      "Companies seeking corporate limited liability separation between founders and business debts",
      "Enterprises requiring commercial bank credit lines, corporate accounts, and government tenders",
    ],
    requirements: [
      "Proposed company name (plus 2 alternative choices)",
      "Ghana Card for Ghanaian directors/shareholders (or international passport for foreign nationals)",
      "Registered physical office address in Ghana with GhanaPost GPS digital code",
      "Minimum 2 Directors (at least one ordinarily resident in Ghana)",
      "1 Qualified Company Secretary and 1 ICAG-licensed Statutory Auditor",
      "Stated capital amount and initial share distribution percentage",
    ],
    steps: [
      {
        name: "Name Search & Reservation",
        description: "Submit proposed corporate name to ORC for availability check and 60-day reservation.",
        duration: "1-2 Days",
      },
      {
        name: "Officer KYC & Consent Execution",
        description: "Execute Form 4 statutory declarations for directors, secretary, and auditor.",
        duration: "2-3 Days",
      },
      {
        name: "Form 3 & Constitution Filing",
        description: "Submit certified particulars and pay statutory 0.5% stated capital stamp duty.",
        duration: "3-5 Days",
      },
      {
        name: "Certificate Issuance & Tax Setup",
        description: "Receive Certificate of Incorporation and register for corporate TIN with GRA.",
        duration: "2-3 Days",
      },
    ],
    table: {
      caption: "Company Limited by Shares (LTD) Statutory Setup Snapshot",
      headers: ["Statutory Metric", "Statutory Requirement", "Deevale GH Coverage"],
      rows: [
        ["Governing Statute", "Companies Act, 2019 (Act 992)", "100% Compliant Filing"],
        ["Minimum Directors", "2 (at least 1 ordinarily resident in Ghana)", "Resident director advisory provided"],
        ["Company Secretary", "Mandatory professional qualification", "Deevale GH Corporate Secretarial included"],
        ["Statutory Auditor", "Mandatory ICAG-licensed Chartered Accountant", "Licensed ICAG Auditor engagement"],
        ["Registered Address", "Physical address with digital GPS code", "Virtual Office Atlantic Tower option"],
        ["Issuance Output", "Certificate of Incorporation & Form 3 Profile", "Digital and original certified delivery"],
      ],
    },
    faqs: [
      {
        question: "How long does it take to register a Company Limited by Shares in Ghana?",
        answer:
          "With Deevale GH, the entire process takes 5 to 10 business days from the moment your identity documents and preferred company names are submitted.",
      },
      {
        question: "Can foreigners own 100% of a Company Limited by Shares?",
        answer:
          "Yes. Non-Ghanaian citizens can hold 100% equity, subject to complying with GIPC Act 865 foreign capital requirements.",
      },
      {
        question: "Can one person be a director and the secretary?",
        answer:
          "No. Section 211 of Act 992 strictly prohibits a sole director from simultaneously acting as the company secretary.",
      },
    ],
  },
  {
    slug: "sole-proprietorship",
    category: "Entity Incorporation",
    title: "Sole Proprietorship (Business Name) Registration in Ghana",
    shortTitle: "Sole Proprietorship",
    heroBadge: "Registration of Business Names Act 1962 (Act 151) • ORC Setup",
    metaTitle: "Sole Proprietorship Registration Ghana | Register Business Name - Deevale GH",
    metaDescription:
      "Fast sole proprietorship and business name registration in Ghana for Ghanaian entrepreneurs. Lowest cost, streamlined ORC filing, and instant corporate bankability.",
    keywords:
      "sole proprietorship registration ghana, register business name ghana, orc enterprise registration, cost of registering sole proprietorship ghana",
    snippet:
      "A Sole Proprietorship (Business Name) in Ghana is an unincorporated enterprise owned by a single Ghanaian citizen under Act 151. It offers the fastest setup and lowest government fee, but provides no legal separation between the owner's personal assets and business liabilities.",
    agency: "Office of the Registrar of Companies (ORC)",
    statutoryAct: "Registration of Business Names Act, 1962 (Act 151)",
    timeline: "3 to 5 business days",
    indicativeFeeMinor: 87000,
    entityCode: "sole_proprietorship",
    deliverables: [
      "Official ORC Business Name Registration Certificate (Form A)",
      "Certified True Copy of Statement of Particulars",
      "Personal TIN confirmation for business transactions",
    ],
    whoNeedsThis: [
      "Individual freelance consultants, tradespersons, and local retailers",
      "Single-owner boutique ventures testing initial market traction before incorporating an LTD",
      "Ghanaian citizens requiring a registered trading name for commercial bank account opening",
    ],
    requirements: [
      "Valid Ghana Card of the sole proprietor (Ghanaian citizenship mandatory)",
      "Two proposed business trade names",
      "Principal place of business address with GhanaPost GPS digital address",
      "Description of business nature and commercial sector",
    ],
    steps: [
      {
        name: "Name Availability Search",
        description: "Verify that your desired trade name is unique and not previously registered at ORC.",
        duration: "1 Day",
      },
      {
        name: "Form A Particulars Filing",
        description: "Submit proprietor particulars, Ghana Card details, and digital GPS address to ORC.",
        duration: "2-3 Days",
      },
      {
        name: "Certificate Collection",
        description: "Obtain official ORC Business Name Registration Certificate for commercial banking.",
        duration: "1 Day",
      },
    ],
    table: {
      caption: "Sole Proprietorship vs. Company Limited by Shares Comparison",
      headers: ["Feature", "Sole Proprietorship", "Company Limited by Shares (LTD)"],
      rows: [
        ["Legal Separation", "None (Owner personally liable)", "Full corporate veil protection"],
        ["Ownership Eligibility", "Ghanaian citizens only", "Ghanaian and foreign nationals"],
        ["Officers Required", "Proprietor only", "Minimum 2 Directors, Secretary, Auditor"],
        ["Government Filing Fee", "~GHS 120", "~GHS 295 + 0.5% Stamp Duty"],
        ["Annual ORC Renewal", "Mandatory annual renewal", "Mandatory Annual Return + Audited Accounts"],
      ],
    },
    faqs: [
      {
        question: "Can a foreigner register a sole proprietorship in Ghana?",
        answer:
          "No. Ghanaian law reserves sole proprietorships exclusively for Ghanaian citizens. Foreigners must incorporate a Company Limited by Shares or register an External Company.",
      },
      {
        question: "Can I convert a sole proprietorship into a limited liability company later?",
        answer:
          "Yes. You can incorporate a new Company Limited by Shares and assign the business assets, contracts, and trading name from the sole proprietorship.",
      },
    ],
  },
  {
    slug: "company-limited-by-guarantee",
    category: "Entity Incorporation",
    title: "Company Limited by Guarantee (NGO & Non-Profit) Registration in Ghana",
    shortTitle: "Company Limited by Guarantee (NGO)",
    heroBadge: "Companies Act 2019 (Act 992) • Non-Profit Entity",
    metaTitle: "Register NGO in Ghana | Company Limited by Guarantee - Deevale GH",
    metaDescription:
      "Statutory incorporation of non-profit foundations, charities, associations, and NGOs in Ghana. Act 992 compliant constitution, ORC approval, and tax-exempt structuring.",
    keywords:
      "register ngo in ghana, company limited by guarantee ghana, register charity accra, non profit organization registration ghana",
    snippet:
      "A Company Limited by Guarantee in Ghana is the legal entity designed for non-profit organizations, NGOs, foundations, and religious associations under Act 992. Members guarantee a specific sum in the event of winding up, and profits cannot be distributed as dividends.",
    agency: "Office of the Registrar of Companies (ORC)",
    statutoryAct: "Companies Act, 2019 (Act 992)",
    timeline: "7 to 14 business days",
    indicativeFeeMinor: 209500,
    entityCode: "company_limited_by_guarantee",
    deliverables: [
      "Official ORC Certificate of Incorporation",
      "Certified True Copy of Form 3 (Non-Profit Particulars)",
      "Form 4 Director & Officer Consents",
      "Registered Non-Profit Constitution (Regulations)",
      "Advisory on Social Welfare & GRA Tax Exemption Filings",
    ],
    whoNeedsThis: [
      "Charitable foundations, philanthropic endowments, and community initiatives",
      "Professional trade associations, alumni unions, and advocacy coalitions",
      "Faith-based organizations, churches, and religious ministries",
    ],
    requirements: [
      "Proposed organization name (must clearly reflect non-profit objects)",
      "Minimum 2 Directors (at least one ordinarily resident in Ghana)",
      "1 Qualified Company Secretary and 1 ICAG-licensed Auditor",
      "Executive summary of philanthropic or social objectives",
      "Ghana Card for local officers or passport for foreign nationals",
      "Guarantee sum committed by each subscriber (typically GHS 100)",
    ],
    steps: [
      {
        name: "Name Search & Reservation",
        description: "Submit and reserve non-profit name with the ORC.",
        duration: "1-2 Days",
      },
      {
        name: "Constitution & Object Drafting",
        description: "Draft bespoke non-profit Regulations excluding profit distribution clauses.",
        duration: "2-3 Days",
      },
      {
        name: "ORC Submission & Review",
        description: "Submit Form 3 and officer consents for Registrar scrutiny.",
        duration: "5-7 Days",
      },
      {
        name: "Certificate Collection",
        description: "Receive formal Certificate of Incorporation.",
        duration: "1-2 Days",
      },
    ],
    table: {
      caption: "Company Limited by Guarantee (NGO) Statutory Rules",
      headers: ["Statutory Rule", "Requirement", "Note"],
      rows: [
        ["Dividend Distribution", "Strictly prohibited", "All retained earnings must support objectives"],
        ["Minimum Directors", "2 Directors", "At least one ordinarily resident in Ghana"],
        ["Secretary Requirement", "Mandatory qualified Secretary", "Must meet Section 211 Act 992 rules"],
        ["Social Welfare License", "Recommended post-incorporation", "Required for donor fund grant eligibility"],
      ],
    },
    faqs: [
      {
        question: "Can an NGO in Ghana engage in revenue-generating activities?",
        answer:
          "Yes, provided all generated revenue is strictly reinvested into the organization's social objects and never distributed to members or directors.",
      },
      {
        question: "Are non-profits automatically exempt from taxes in Ghana?",
        answer:
          "No. Incorporation at ORC gives you legal corporate status. You must subsequently apply to the Ghana Revenue Authority (GRA) for formal tax exemption status.",
      },
    ],
  },
  {
    slug: "external-company",
    category: "Entity Incorporation",
    title: "External Company (Foreign Branch Office) Registration in Ghana",
    shortTitle: "External Company (Branch)",
    heroBadge: "Companies Act 2019 (Act 992 Part Twelve) • Foreign Branch",
    metaTitle: "External Company Registration Ghana | Foreign Branch Office - Deevale GH",
    metaDescription:
      "Register a branch office of your overseas corporation in Ghana under Act 992 Part Twelve. No GIPC minimum foreign capital requirement for parent company contracts.",
    keywords:
      "external company registration ghana, foreign branch office ghana, register foreign company branch accra, act 992 external company",
    snippet:
      "An External Company in Ghana is a registered local branch of an overseas parent corporation under Act 992 Part Twelve. It enables an international business to operate in Ghana without forming a separate subsidiary and is exempt from GIPC minimum foreign capital rules for parent contracts.",
    agency: "Office of the Registrar of Companies (ORC)",
    statutoryAct: "Companies Act, 2019 (Act 992 Part Twelve)",
    timeline: "10 to 15 business days",
    indicativeFeeMinor: 902500,
    entityCode: "external_company",
    deliverables: [
      "Official ORC Certificate of Registration of an External Company (Form 20)",
      "Certified True Copies of Parent Company Documents filed in Ghana",
      "Appointment of Local Manager & Process Agent documentation",
      "Corporate Tax Identification Number (TIN)",
    ],
    whoNeedsThis: [
      "Multinational enterprises executing discrete project contracts in Ghana",
      "Foreign engineering, construction, and oilfield service contractors",
      "Global entities testing the West African market prior to full subsidiary formation",
    ],
    requirements: [
      "Notarized/Apostilled Certificate of Incorporation and Charter from parent country",
      "Notarized copy of Parent Company Constitution/Articles",
      "Audited financial statements of the parent company for the preceding year",
      "Power of Attorney appointing a Local Manager resident in Ghana",
      "Physical registered office address in Ghana with GhanaPost GPS digital code",
    ],
    steps: [
      {
        name: "Document Notarization & Legalization",
        description: "Assemble and verify parent company certificates and notarized statutes.",
        duration: "3-5 Days",
      },
      {
        name: "Local Manager Appointment",
        description: "Appoint resident process agent and execute statutory declaration.",
        duration: "1-2 Days",
      },
      {
        name: "ORC Part Twelve Filing",
        description: "Submit Form 20 and statutory parent documents to ORC.",
        duration: "5-7 Days",
      },
      {
        name: "Registration Issuance",
        description: "Receive Certificate of Registration as an External Company.",
        duration: "2-3 Days",
      },
    ],
    table: {
      caption: "External Company vs. Ghanaian Subsidiary (LTD)",
      headers: ["Metric", "External Company (Branch)", "Ghanaian Subsidiary (LTD)"],
      rows: [
        ["Corporate Entity", "Extension of overseas parent", "Separate Ghanaian legal entity"],
        ["Parent Liability", "Parent company directly liable", "Parent liability strictly limited to shares"],
        ["GIPC Capital Rule", "Exempt for parent contracts", "Subject to $200k (JV) or $500k (100%)"],
        ["Filing Documents", "Requires parent corporate filings", "Uses newly drafted Ghanaian Form 3"],
      ],
    },
    faqs: [
      {
        question: "Does an external company have a board of directors in Ghana?",
        answer:
          "No. The branch operates under the governance of the parent company's board, represented locally by an appointed Local Manager resident in Ghana.",
      },
    ],
  },
  {
    slug: "gipc-registration",
    category: "Regulatory & Compliance",
    title: "GIPC Registration & Foreign Investor Compliance in Ghana",
    shortTitle: "GIPC Foreign Investor Registration",
    heroBadge: "GIPC Act 2013 (Act 865) • Foreign Direct Investment",
    metaTitle: "GIPC Registration Ghana | Foreign Capital & Expat Quotas - Deevale GH",
    metaDescription:
      "Statutory GIPC registration for foreign-owned companies in Ghana under Act 865. Bank of Ghana capital importation verification and automatic expatriate work quotas.",
    keywords:
      "gipc registration ghana, gipc minimum capital ghana, foreign investor registration accra, expatriate quotas ghana, doing business in ghana foreigner",
    snippet:
      "GIPC Registration is mandatory under Act 865 for any Ghanaian company with foreign equity. It confirms statutory foreign capital ($200k for joint ventures, $500k for wholly foreign-owned firms) through the Bank of Ghana and grants automatic expatriate work quotas and profit repatriation guarantees.",
    agency: "Ghana Investment Promotion Centre (GIPC)",
    statutoryAct: "Ghana Investment Promotion Centre Act, 2013 (Act 865)",
    timeline: "10 to 15 business days",
    indicativeFeeMinor: 1229500,
    deliverables: [
      "Official GIPC Certificate of Registration",
      "Bank of Ghana Capital Confirmation Letter",
      "Statutory Automatic Expatriate Quota Allocations",
      "Foreign Investment Guarantee and Repatriation Clearance",
    ],
    whoNeedsThis: [
      "Foreign founders and diaspora investors incorporating companies in Ghana",
      "Joint ventures pairing international equity with local Ghanaian partners",
      "Multinational firms requiring expatriate work permits and immigration visas",
    ],
    requirements: [
      "ORC Certificate of Incorporation and certified Form 3",
      "Bank of Ghana Electronic Confirmation of Inward Remittance letter",
      "Stated capital bank statement showing imported funds or customs valuation for machinery",
      "Comprehensive 3-year commercial business plan and financial projections",
      "SSNIT employer registration and GRA Tax Clearance Certificate",
    ],
    steps: [
      {
        name: "Capital Importation via BoG",
        description: "Wire foreign equity capital to local commercial bank and obtain BoG confirmation.",
        duration: "3-5 Days",
      },
      {
        name: "GIPC Application Preparation",
        description: "Assemble statutory forms, 3-year business plan, and tax profiles.",
        duration: "2-3 Days",
      },
      {
        name: "GIPC Filing & Appraisal",
        description: "Submit application to GIPC desk officers for statutory appraisal.",
        duration: "5-7 Days",
      },
      {
        name: "Certificate & Quota Issuance",
        description: "Receive formal GIPC Certificate and automatic expatriate work quota letters.",
        duration: "2-3 Days",
      },
    ],
    table: {
      caption: "GIPC Minimum Capital Tiers & Expatriate Quotas (Act 865)",
      headers: ["Structure Type", "Foreign Capital (USD)", "Ghanaian Equity", "Automatic Quotas"],
      rows: [
        ["Joint Venture", "$200,000", "Minimum 10%", "1 to 2 Quotas"],
        ["Wholly Foreign-Owned", "$500,000", "0%", "2 to 3 Quotas"],
        ["General Trading", "$1,000,000", "0% (Must hire 20+ Ghanaians)", "3 to 4 Quotas"],
      ],
    },
    faqs: [
      {
        question: "Can imported capital be withdrawn after GIPC registration?",
        answer:
          "Yes. The capital is not locked in escrow. Once verified by the Bank of Ghana and GIPC, the funds can be freely spent on business operations.",
      },
    ],
  },
  {
    slug: "gra-tax-tin-registration",
    category: "Regulatory & Compliance",
    title: "GRA Corporate Tax Registration & TIN Setup in Ghana",
    shortTitle: "GRA Tax & Corporate TIN",
    heroBadge: "Revenue Administration Act 2016 (Act 915) • Tax Onboarding",
    metaTitle: "GRA Corporate TIN & Tax Registration Ghana - Deevale GH",
    metaDescription:
      "Get your official corporate Tax Identification Number (TIN) and taxpayer registration with the Ghana Revenue Authority (GRA). CIT, VAT, WHT, and provisional assessments.",
    keywords:
      "gra tin registration ghana, corporate tax registration accra, register vat ghana, revenue administration act ghana, get company tin ghana",
    snippet:
      "GRA Corporate Tax Registration is required under the Revenue Administration Act (Act 915) for every newly formed company in Ghana. It yields an official Corporate Tax Identification Number (TIN), local Taxpayer Service Centre assignment, provisional income tax assessment, and VAT/WHT portal filing activation.",
    agency: "Ghana Revenue Authority (GRA)",
    statutoryAct: "Revenue Administration Act, 2016 (Act 915)",
    timeline: "3 to 5 business days",
    indicativeFeeMinor: 45000,
    deliverables: [
      "Official GRA Corporate Taxpayer Registration Certificate",
      "Corporate Tax Identification Number (Corporate TIN)",
      "Local Taxpayer Service Centre (TSC) assignment",
      "VAT & Withholding Tax Portal Activation Profile",
    ],
    whoNeedsThis: [
      "Newly registered companies needing a corporate TIN for commercial bank account activation",
      "Import/Export businesses requiring customs clearance on the ICUMS portal",
      "Companies engaging corporate suppliers or issuing withholding tax (WHT) credit certificates",
    ],
    requirements: [
      "ORC Certificate of Incorporation and certified Form 3",
      "Ghana Card PINs for all resident directors and shareholders",
      "Physical office tenancy agreement or utility bill with digital GhanaPost GPS address",
      "Estimated annual revenue forecast for provisional CIT assessment",
    ],
    steps: [
      {
        name: "Taxpayer Profile Assembly",
        description: "Collate ORC incorporation certificates, director Ghana Cards, and digital address.",
        duration: "1 Day",
      },
      {
        name: "Local TSC Lodgement",
        description: "Submit taxpayer application to the GRA Taxpayer Service Centre jurisdiction.",
        duration: "2-3 Days",
      },
      {
        name: "TIN & Portal Generation",
        description: "Obtain official corporate TIN and online portal credentials for returns.",
        duration: "1 Day",
      },
    ],
    table: {
      caption: "GRA Corporate Tax Types & Remittance Deadlines",
      headers: ["Tax Obligation", "Statutory Rate", "Filing Deadline"],
      rows: [
        ["Corporate Income Tax (CIT)", "Standard 25% on net taxable profit", "Annually within 4 months of financial year-end"],
        ["PAYE (Employee Income Tax)", "Graduated statutory PAYE bands", "Monthly by the 15th of the ensuing month"],
        ["Withholding Tax (WHT)", "3% (Goods), 7.5% - 15% (Services)", "Monthly by the 15th of the ensuing month"],
        ["Value Added Tax (VAT/NHIL/GETFund)", "Standard taxable supplies (21.9% effective)", "Monthly by the last working day of following month"],
      ],
    },
    faqs: [
      {
        question: "Is personal TIN the same as corporate TIN in Ghana?",
        answer:
          "No. For an individual, the Ghana Card PIN functions as a personal TIN. A company limited by shares is a distinct legal person and receives an official Corporate TIN from the GRA.",
      },
    ],
  },
  {
    slug: "ssnit-registration",
    category: "Regulatory & Compliance",
    title: "SSNIT Employer Registration & Pension Clearance in Ghana",
    shortTitle: "SSNIT Employer Registration",
    heroBadge: "National Pensions Act 2008 (Act 766) • Mandatory Pension Setup",
    metaTitle: "SSNIT Employer Registration Ghana | Pension Clearance - Deevale GH",
    metaDescription:
      "Mandatory SSNIT employer registration and pension clearance certificate processing in Ghana under Act 766. Tier 1 & Tier 2 employee onboarding and compliance management.",
    keywords:
      "ssnit employer registration ghana, ssnit clearance certificate, pension registration ghana, act 766 compliance accra, tier 1 tier 2 ssnit",
    snippet:
      "Under the National Pensions Act (Act 766), any business operating in Ghana with at least one employee must register as an employer with SSNIT. Employers are statutorily required to remit Tier 1 (13.5%) and Tier 2 (5%) contributions monthly by the 14th of the following month.",
    agency: "Social Security and National Insurance Trust (SSNIT)",
    statutoryAct: "National Pensions Act, 2008 (Act 766)",
    timeline: "3 to 5 business days",
    indicativeFeeMinor: 45000,
    deliverables: [
      "Official SSNIT Employer Registration Certificate and Employer Number",
      "Tier 1 Mandatory Social Security Enrollment Confirmation",
      "Private Tier 2 Pension Trustee Corporate Onboarding",
      "SSNIT Clearance Certificate Eligibility Documentation",
    ],
    whoNeedsThis: [
      "Any business entity employing local or foreign personnel in Ghana",
      "Companies bidding on public tenders or government procurement contracts",
      "Enterprises applying for commercial credit facilities or work permits",
    ],
    requirements: [
      "ORC Certificate of Incorporation and Form 3",
      "List of employees with valid SSNIT identification numbers and Ghana Cards",
      "Monthly payroll schedule showing basic salaries and pension deductions",
      "Company physical address and GhanaPost GPS location",
    ],
    steps: [
      {
        name: "Employer Data Verification",
        description: "Verify company registration and employee SSNIT numbers.",
        duration: "1 Day",
      },
      {
        name: "SSNIT Branch Lodgement",
        description: "File registration with the local SSNIT district branch office.",
        duration: "2-3 Days",
      },
      {
        name: "Employer Number Issuance",
        description: "Receive statutory Employer Number and portal setup.",
        duration: "1 Day",
      },
    ],
    table: {
      caption: "Statutory Pension Contribution Structure in Ghana (Act 766)",
      headers: ["Pension Tier", "Employee Deduction", "Employer Contribution", "Total Remittance"],
      rows: [
        ["Tier 1 (Mandatory Basic Scheme - SSNIT)", "5.5% of basic salary", "13.0% of basic salary", "13.5% paid to SSNIT (2.5% to NHIS)"],
        ["Tier 2 (Mandatory Occupational Pension)", "0% (Drawn from total 18.5%)", "Funded within employer total", "5.0% paid to licensed Private Trustee"],
        ["Total Combined Statutory Pension", "5.5%", "13.0%", "18.5% of gross monthly payroll"],
      ],
    },
    faqs: [
      {
        question: "What is the penalty for late SSNIT remittances?",
        answer:
          "Late payments attract a mandatory statutory compound penalty of 3% per month on the outstanding unpaid balance.",
      },
    ],
  },
  {
    slug: "business-operating-permit",
    category: "Regulatory & Compliance",
    title: "MMDA Business Operating Permit (BOP) in Accra, Ghana",
    shortTitle: "Business Operating Permit (BOP)",
    heroBadge: "Local Governance Act 2016 (Act 936) • Municipal Licensing",
    metaTitle: "Business Operating Permit Ghana | AMA & MMDA License - Deevale GH",
    metaDescription:
      "Obtain your official Business Operating Permit (BOP) from local district assemblies in Accra (AMA, Ayawaso, Tema). Premises inspection, fee computation, and annual sticker.",
    keywords:
      "business operating permit ghana, ama business permit accra, municipal trade license ghana, mmda permit renewal, act 936 local governance",
    snippet:
      "A Business Operating Permit (BOP) is a mandatory annual municipal license issued under the Local Governance Act (Act 936) by the local district or metropolitan assembly (such as the Accra Metropolitan Assembly - AMA). It authorizes a business to carry on commercial activities at a physical address.",
    agency: "Metropolitan, Municipal & District Assemblies (MMDAs / AMA)",
    statutoryAct: "Local Governance Act, 2016 (Act 936)",
    timeline: "5 to 10 business days",
    indicativeFeeMinor: 65000,
    deliverables: [
      "Official Municipal Business Operating Permit Certificate",
      "Statutory Annual Premises Inspection Clearance",
      "Official MMDA Window Sticker and Receipt",
    ],
    whoNeedsThis: [
      "All commercial establishments occupying physical offices, stores, or warehouses",
      "Companies requiring municipal clearance for branch signage and commercial operations",
      "Enterprises avoiding padlocking, premises closure, and municipal court summons",
    ],
    requirements: [
      "ORC Certificate of Incorporation and certified Form 3",
      "Physical tenancy agreement or landlord authorization letter",
      "GhanaPost GPS digital address of the premises",
      "Description of business activities and floor square footage",
    ],
    steps: [
      {
        name: "Assembly Jurisdictional Identification",
        description: "Determine whether premises fall under AMA, Ayawaso West, Tema, or Ga East.",
        duration: "1 Day",
      },
      {
        name: "Application & Rating Assessment",
        description: "Submit business particulars to municipal revenue officers for fee assessment.",
        duration: "2-3 Days",
      },
      {
        name: "Premises Inspection & Payment",
        description: "Coordinate environmental health inspection and remit assembly fee.",
        duration: "2-4 Days",
      },
      {
        name: "Permit & Sticker Issuance",
        description: "Receive formal Business Operating Permit certificate and annual sticker.",
        duration: "1 Day",
      },
    ],
    table: {
      caption: "Municipal Assembly Jurisdictions Across Greater Accra",
      headers: ["Assembly Area", "Key Business Districts", "Typical Inspection Focus"],
      rows: [
        ["Accra Metropolitan Assembly (AMA)", "Ridge, Osu, Central Business District, Jamestown", "Commercial zoning, signage, sanitation"],
        ["Ayawaso West Municipal", "Airport Residential, East Legon, Dzorwulu", "Office occupancy, traffic impact, parking"],
        ["Tema Metropolitan Assembly", "Tema Industrial Area, Harbour Zone, Free Zones", "Industrial safety, fire permits, heavy commercial"],
        ["La Dade-Kotopon Municipal", "Airport City, Cantonments, Labone", "Corporate headquarters, retail hubs, commercial leasing"],
      ],
    },
    faqs: [
      {
        question: "When does a Business Operating Permit expire?",
        answer:
          "BOPs expire annually on December 31st, regardless of when issued during the year. Renewal bills are typically distributed and settled between January and March.",
      },
    ],
  },
]
