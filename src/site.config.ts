// Central place for everything personal on the site — edit here, not in the components.

export const site = {
  name: 'Dmytro Zahorodnii',
  handle: 'dmytrozahor',
  role: 'Full-stack Java Developer',
  company: { name: 'EnBW', url: 'https://www.enbw.com' },
  tagline: 'Full-stack Java development and mathematics — building software for the energy transition.',
  location: 'Karlsruhe, Germany',
  description:
    'Personal site of Dmytro Zahorodnii, Full-stack Java Developer at EnBW. Articles on mathematics, programming and more.',

  // Pictures: drop your files into public/img/ and point these at them,
  // e.g. avatar: '/img/profile.jpg', banner: '/img/banner.jpg', portrait: '/img/about.jpg'.
  // Until then the GitHub avatar and a purple gradient banner are used.
  avatar: 'https://avatars.githubusercontent.com/u/39193746?v=4',
  banner: '',
  portrait: '',

  // Used for the "Edit on GitHub" / "Discuss on GitHub" links on every post.
  repo: { owner: 'dmytrozahor', name: 'dmitrijza', branch: 'main' },

  socials: [
    { label: 'GitHub', href: 'https://github.com/dmytrozahor', icon: 'github' },
    // { label: 'LinkedIn', href: 'https://www.linkedin.com/in/<your-handle>', icon: 'linkedin' },
    // { label: 'Email', href: 'mailto:you@example.com', icon: 'mail' },
    { label: 'RSS', href: '/rss.xml', icon: 'rss' },
  ],

  projects: [
    {
      name: 'Fides',
      href: 'https://github.com/FidesDE',
      description: 'Robust real property management and trading platform.',
      tags: ['real estate', 'platform'],
      featured: true,
    },
    {
      name: 'BULP',
      href: 'https://github.com/dmytrozahor/BULP',
      description: 'Evidence-based lexicon for exploring the history and regional variation of Ukrainian word forms.',
      tags: ['Ukrainian', 'NLP', 'corpus'],
      featured: false,
    },
    {
      name: 'jminima',
      href: 'https://github.com/dmytrozahor/jminima',
      description: 'Minimalistic declarative JVM instrumentation library on top of ASM.',
      tags: ['jvm', 'bytecode'],
      featured: false,
    },
    {
      name: 'keiko-plugin-inspector',
      href: 'https://github.com/dmytrozahor/keiko-plugin-inspector',
      description: 'Bukkit/Spigot/Bungee plugin inspector with runtime connectivity and file access control.',
      tags: ['security', 'minecraft'],
      featured: false,
    },
  ],
};

export type Project = (typeof site.projects)[number];

// Article categories. The key is what you put in an article's front-matter: `category: mathematics`.
// Rename `title` / `description` freely; changing a key also changes its URL (/articles/category/<key>/).
export const categories = {
  mathematics: {
    kicker: 'Field notes · 01',
    subtitle: 'Proofs, structures & the maths behind the code',
    illustration: 'math',
    title: 'Mathematics',
    description: 'Proofs, algorithms and the maths behind the code: number theory, linear algebra, probability.',
    icon: 'sigma',
  },
  programming: {
    kicker: 'Field guide · 02',
    subtitle: 'Full-stack Java, the JVM & distributed systems',
    illustration: 'network',
    title: 'Programming',
    description: 'Full-stack Java: the JVM, Spring, concurrency, frontend, architecture and tooling.',
    icon: 'code',
  },
  personal: {
    kicker: 'Essays · 03',
    subtitle: 'Engineering practice, AI & the craft',
    illustration: 'orbit',
    title: 'Beyond Code',
    description: 'Essays beyond code: engineering practice, AI, career and learning.',
    icon: 'spark',
  },
} as const;

export type Category = keyof typeof categories;
export const categoryKeys = Object.keys(categories) as [Category, ...Category[]];
