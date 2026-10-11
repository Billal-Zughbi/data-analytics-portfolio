/**
 * Editable profile settings. Everything here is taken from Billal's résumé
 * (Billal_Zughbi_Resume_BI_Analytics.pdf). Edit this file, not the components,
 * to change site content.
 *
 * Deliberately left off the public site: phone number and anything more
 * precise than city-level location.
 */

export type Link = { label: string; href: string };

export type Role = {
  title: string;
  company: string;
  location: string;
  start: string; // display text, e.g. "January 2023"
  end: string;
  highlights: string[];
  tools: string[];
  /** Company logo under public/, shown next to the role. */
  logo?: string;
};

export const profile = {
  name: "Billal Zughbi",
  title: "Business Intelligence & Analytics Engineer",
  location: "Baltimore, MD",
  email: "bzughbi1@gmail.com",
  links: {
    linkedin: "https://www.linkedin.com/in/billal-zughbi/",
    github: "https://github.com/Billal-Zughbi",
    repository: "https://github.com/Billal-Zughbi/data-analytics-portfolio",
  },
  /**
   * Résumé download: a path under /public. The PDF must not contain a phone number.
   * Set to null to hide the button.
   */
  resumeUrl: "/Billal-Zughbi-Resume.pdf" as string | null,

  headline: "Power BI, SQL and the data models behind them.",
  intro:
    "I'm an analytics engineer at Arconic. I build SQL data models, ETL pipelines and Power BI dashboards, mostly to replace spreadsheet reporting and manual work. Below are my work history and some independent projects, with the code for each.",
  about: [
    "I'm a Business Intelligence and Analytics Engineer at Arconic, where I build enterprise reporting and data solutions across a company with 8 business units. My work spans Power BI and SQL models, ETL/ELT standardization, and integrating Snowflake and Microsoft Fabric lakehouse data into reporting.",
    // Written for the site; edit freely.
    "What I enjoy most about analytics is the detective work: taking a messy dataset, figuring out what is actually going on, and turning it into something people use to make decisions. Going forward, I want to keep growing on the analytics engineering side, building the data models and pipelines that bigger teams rely on, and doing more of the analysis behind the decisions themselves.",
  ],
  education: {
    school: "The College of New Jersey",
    location: "Ewing, NJ",
    degree: "Bachelor of Science in Computer Science",
    date: "December 2022",
  },
} as const;

export const experience: Role[] = [
  {
    title: "Analytics Engineer",
    company: "Arconic",
    logo: "/images/arconic-logo.png",
    location: "Lancaster, PA",
    start: "January 2023",
    end: "Present",
    highlights: [
      "Designed and deployed 15+ enterprise Power BI dashboards for 200+ stakeholders across operations, finance and executive leadership, replacing legacy spreadsheet reporting with a centralized reporting layer for core KPIs.",
      "Analyzed manufacturing and product-quality data to identify key drivers of quality failures, informing process improvements that reduced defect rates by 25% and annual customer claims by $80K.",
      "Built a SQL data model consolidating $12M in capital spend and forecast data, improving visibility into departmental spending and identifying $200K+ in potentially redundant expenditures.",
      "Automated resource-planning workflows in SQL and Power BI by translating business rules and operational constraints into reporting logic, eliminating approximately 90 hours of manual scheduling each month.",
      "Standardized ETL workflows across 8 business units by establishing common naming conventions, schema definitions and transformation logic across previously unit-specific pipelines.",
      "Integrated Snowflake and Microsoft Fabric lakehouse data into Power BI reporting models, reducing direct queries against legacy IBM AS/400 and Microsoft Access systems for enterprise reporting.",
    ],
    tools: ["Power BI", "DAX", "SQL", "Snowflake", "Microsoft Fabric", "ETL/ELT"],
  },
  {
    title: "Data Analytics Intern",
    company: "Arconic",
    logo: "/images/arconic-logo.png",
    location: "Lancaster, PA",
    start: "May 2022",
    end: "August 2022",
    highlights: [
      "Automated the collection and transformation of legacy customer-service data using Power Automate, creating a refreshable reporting dataset that reduced monthly preprocessing time by 40%.",
      "Built a Power BI and Power Apps attendance-tracking platform for 750+ hourly employees, standardizing data capture and KPI logic while reducing reliance on manual timecard audits.",
      "Developed technical documentation and user guides for analytics tools, creating standardized resources for onboarding and troubleshooting across citizen development teams.",
    ],
    tools: ["Power Automate", "Power BI", "Power Apps"],
  },
];

/** Professional results, quoted from the résumé. Shown with the Experience section. */
export const highlights = [
  { value: "15+", label: "enterprise Power BI dashboards" },
  { value: "200+", label: "stakeholders using them" },
  { value: "8", label: "business units on shared ETL standards" },
  { value: "~90 hrs", label: "of manual scheduling removed each month" },
];

export const skills: { group: string; note: string; items: string[] }[] = [
  {
    group: "Business intelligence",
    note: "Dashboards, measures and security",
    items: ["Power BI", "DAX", "Power Query (M)", "Row-Level Security", "Excel"],
  },
  {
    group: "Data & engineering",
    note: "Databases, pipelines and modeling",
    items: ["SQL", "Snowflake", "Microsoft Fabric", "SQL Server", "Python", "ETL/ELT", "Data modeling", "Star schema"],
  },
  {
    group: "Automation & development",
    note: "Automation and version control",
    items: ["Power Automate", "Power Apps", "Git", "Azure DevOps"],
  },
];

export const navigation: Link[] = [
  { label: "Projects", href: "/#projects" },
  { label: "Workflow", href: "/#workflow" },
  { label: "Experience", href: "/#experience" },
  { label: "Skills", href: "/#skills" },
  { label: "About", href: "/#about" },
  { label: "Contact", href: "/#contact" },
];
