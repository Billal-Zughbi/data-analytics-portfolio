// Site content, sourced from Billal's BI & Analytics resume.
// Phone number and street-level location are intentionally left off the public site.

export type Experience = {
  role: string;
  company: string;
  location: string;
  period: string;
  highlights: string[];
};

export type Project = {
  slug: string;
  title: string;
  period: string;
  summary: string;
  stack: string[];
  repoPath: string;
};

export const profile = {
  name: "Billal Zughbi",
  title: "Business Intelligence & Analytics Engineer",
  location: "Baltimore, MD",
  email: "bzughbi1@gmail.com",
  github: "https://github.com/Billal-Zughbi",
  repo: "https://github.com/Billal-Zughbi/data-analytics-portfolio",
  summary:
    "Business Intelligence and Analytics Engineer with 3.5 years of experience building enterprise reporting and data solutions across an 8-business-unit manufacturing organization. I build Power BI and SQL solutions that surface business insights, replace manual processes, standardize reporting, and connect enterprise data at scale, with hands-on experience in Snowflake, Microsoft Fabric, Python, data modeling and ETL/ELT.",
  stats: [
    { value: "15+", label: "enterprise Power BI dashboards" },
    { value: "200+", label: "stakeholders served" },
    { value: "25%", label: "reduction in defect rates" },
    { value: "~90 hrs", label: "manual scheduling removed monthly" },
  ],
};

export const experience: Experience[] = [
  {
    role: "Analytics Engineer",
    company: "Arconic",
    location: "Lancaster, PA",
    period: "Jan 2023 – Present",
    highlights: [
      "Designed and deployed 15+ enterprise Power BI dashboards for 200+ stakeholders across operations, finance, and executive leadership, replacing legacy spreadsheet reporting with a centralized reporting layer for core KPIs.",
      "Analyzed manufacturing and product-quality data to identify key drivers of quality failures, informing process improvements that reduced defect rates by 25% and annual customer claims by $80K.",
      "Built a SQL data model consolidating $12M in capital spend and forecast data, improving visibility into departmental spending and identifying $200K+ in potentially redundant expenditures.",
      "Automated resource-planning workflows in SQL and Power BI by translating business rules and operational constraints into reporting logic, eliminating approximately 90 hours of manual scheduling each month.",
      "Standardized ETL workflows across 8 business units by establishing common naming conventions, schema definitions, and transformation logic.",
      "Integrated Snowflake and Microsoft Fabric lakehouse data into Power BI reporting models, reducing direct queries against legacy IBM AS/400 and Microsoft Access systems.",
    ],
  },
  {
    role: "Data Analytics Intern",
    company: "Arconic",
    location: "Lancaster, PA",
    period: "May 2022 – Aug 2022",
    highlights: [
      "Automated collection and transformation of legacy customer-service data with Power Automate, creating a refreshable reporting dataset that cut monthly preprocessing time by 40%.",
      "Built a Power BI and Power Apps attendance-tracking platform for 750+ hourly employees, standardizing data capture and KPI logic.",
      "Wrote technical documentation and user guides that standardized onboarding and troubleshooting for citizen development teams.",
    ],
  },
];

export const education = {
  school: "The College of New Jersey",
  location: "Ewing, NJ",
  degree: "Bachelor of Science in Computer Science",
  period: "December 2022",
};

export const projects: Project[] = [
  {
    slug: "apple-health-analytics",
    title: "Apple Health Analytics Dashboard",
    period: "2025",
    summary:
      "A Python pipeline that streams a multi-gigabyte Apple Health XML export, normalizes 40 health metrics across devices and years, and publishes a privacy-safe star schema for a Power BI dashboard on cardiovascular, activity, mobility and environmental trends.",
    stack: ["Python", "ElementTree", "Pandas", "Power BI", "DAX", "Star schema"],
    repoPath: "projects/apple-health-analytics",
  },
];

export const skills: { group: string; items: string[] }[] = [
  { group: "Business Intelligence", items: ["Power BI", "DAX", "Power Query (M)", "Excel", "Row-Level Security"] },
  {
    group: "Data & Engineering",
    items: ["SQL", "Snowflake", "Microsoft Fabric", "SQL Server", "Python", "ETL/ELT", "Data Modeling", "Star Schema"],
  },
  { group: "Automation & Development", items: ["Power Automate", "Power Apps", "Git", "Azure DevOps"] },
];
