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
  title: "Analytics Engineer",
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

  headline: "From Raw Data to Business Decisions: Power BI, SQL, Python, and the Data Models Behind Them.",
  intro:
    "Hello there, and thanks for stopping by! I'm an Analytics Engineer at Arconic, where I spend my days building the SQL data models, ETL pipelines and Power BI dashboards that make everyone's life a little easier. Sometimes that's a leadership team that needs an answer before the end of the day, and sometimes it's a workflow that's been done by hand for years and finally doesn't have to be. Below you'll find my work history and a few independent projects, each with the code behind it. Feel free to reach out with any questions, or to connect with me on LinkedIn!",
  aboutTitle:
    "From dreams of becoming an MD to the reality of debugging SQL code and fan-out joins: how I found my career in Analytics Engineering.",
  // Personal story written with Annie for the site. Keep resume facts out of this section.
  about: [
    "For most of my life the plan was medicine, and I showed up at TCNJ on the pre-med track with a pretty clear picture of where the next decade was going. Then I signed up for an intro course in Java and problem solving, and a few weeks in I noticed I was staying up later on the programming homework than on anything for my science classes, simply because I wanted to see the thing finally run.",
    "Switching to computer science felt like a leap at the time, and like most of my classmates I assumed it would lead straight to software engineering. TCNJ didn't really have a path into data analytics, so I had no idea how much I'd enjoy it until an internship put me in front of databases that had been around since before I could walk and asked me to make sense of them. Figuring out why two reports disagreed, or why a total came out exactly double what it should have been, turned into my favorite kind of puzzle, and by the end of that summer I'd stopped thinking about software engineering altogether.",
    "Most of what I know now I taught myself, usually with a documentation page on one tab and a SQL query in the other, since there wasn't always someone down the hall to ask. I've come to like learning that way, and it's a big reason I still spend weekends building projects like the ones on this site.",
    "Someday I'd like to lead a team of analysts and engineers and be the person down the hall I sometimes wished I had. Until then I'll keep picking up whatever the work calls for next, lately a lot of Python and AI tooling. If any of this sounds like someone you'd want on your team, I'd love to hear from you.",
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
    items: ["Power Automate", "Power Apps", "Git", "GitHub", "Azure DevOps"],
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
