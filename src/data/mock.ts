export interface Product {
  id: string;
  slug: string;
  name: string;
  designer: string;
  designerSlug: string;
  price: number;
  category: "Outerwear" | "Tops" | "Bottoms" | "Bags" | "Accessories";
  gender: "Women" | "Men" | "Unisex";
  colors: string[];
  sizes: string[];
  status: "Active" | "Inactive";
  description: string;
}

export const products: Product[] = [
  {
    id: "p-001",
    slug: "asymmetric-coat",
    name: "Asymmetric Coat",
    designer: "Y/PROJECT",
    designerSlug: "y-project",
    price: 1450,
    category: "Outerwear",
    gender: "Unisex",
    colors: ["Ink", "Bone"],
    sizes: ["XS", "S", "M", "L"],
    status: "Active",
    description:
      "A sculptural double-breasted coat built around an off-center seam. Tailored from heavy Italian wool with raw inner edges.",
  },
  {
    id: "p-002",
    slug: "draped-hoodie",
    name: "Draped Hoodie",
    designer: "LEMAIRE",
    designerSlug: "lemaire",
    price: 480,
    category: "Tops",
    gender: "Unisex",
    colors: ["Ash", "Sand"],
    sizes: ["S", "M", "L", "XL"],
    status: "Active",
    description: "Oversized hoodie with a gravity-cut shoulder and brushed cotton interior.",
  },
  {
    id: "p-003",
    slug: "silk-structure-shirt",
    name: "Silk Structure Shirt",
    designer: "Rick Owens",
    designerSlug: "rick-owens",
    price: 620,
    category: "Tops",
    gender: "Women",
    colors: ["Obsidian"],
    sizes: ["XS", "S", "M"],
    status: "Active",
    description: "Bias-cut silk shirt with architectural shoulder line and concealed placket.",
  },
  {
    id: "p-004",
    slug: "contour-jacket",
    name: "Contour Jacket",
    designer: "1017 ALYX 9SM",
    designerSlug: "alyx",
    price: 1250,
    category: "Outerwear",
    gender: "Men",
    colors: ["Onyx"],
    sizes: ["S", "M", "L"],
    status: "Active",
    description: "Industrial-weight jacket finished with the signature rollercoaster hardware.",
  },
  {
    id: "p-005",
    slug: "double-waist-jeans",
    name: "Double Waist Jeans",
    designer: "Y/PROJECT",
    designerSlug: "y-project",
    price: 630,
    category: "Bottoms",
    gender: "Unisex",
    colors: ["Raw Indigo"],
    sizes: ["28", "30", "32", "34"],
    status: "Active",
    description: "Signature double-waistband jean in selvedge denim.",
  },
  {
    id: "p-006",
    slug: "wire-bag",
    name: "Wire Bag",
    designer: "TOTEME",
    designerSlug: "toteme",
    price: 890,
    category: "Bags",
    gender: "Women",
    colors: ["Bone", "Cognac"],
    sizes: ["One Size"],
    status: "Inactive",
    description: "Sculpted leather bag with hand-formed wire frame and detachable strap.",
  },
];

export const productBySlug = (slug: string) =>
  products.find((p) => p.slug === slug) ?? products[0];

export interface Designer {
  slug: string;
  name: string;
  location: string;
  slogan: string;
  bio: string;
  followers: number;
  collections: number;
  productsCount: number;
  memberSince: string;
  featuredIn: number;
}

export const designers: Designer[] = [
  {
    slug: "y-project",
    name: "Y/PROJECT",
    location: "Paris, France",
    slogan: "Architecture of the asymmetric.",
    bio: "A Paris-based studio building garments around the tension between tailoring and deconstruction. Each season is a continuation of a single conversation about how clothing holds the body.",
    followers: 184200,
    collections: 12,
    productsCount: 86,
    memberSince: "2021",
    featuredIn: 14,
  },
  {
    slug: "lemaire",
    name: "LEMAIRE",
    location: "Paris, France",
    slogan: "Quiet luxury, drawn slowly.",
    bio: "Studio of restrained line and patient material. Garments designed to age into the wearer.",
    followers: 132000,
    collections: 9,
    productsCount: 64,
    memberSince: "2022",
    featuredIn: 9,
  },
  {
    slug: "rick-owens",
    name: "Rick Owens",
    location: "Paris, France",
    slogan: "Glamour in the ruins.",
    bio: "An ongoing study of brutalist romance.",
    followers: 421000,
    collections: 24,
    productsCount: 142,
    memberSince: "2020",
    featuredIn: 22,
  },
  {
    slug: "alyx",
    name: "1017 ALYX 9SM",
    location: "Milan, Italy",
    slogan: "Hardware as language.",
    bio: "Industrial precision applied to ready-to-wear.",
    followers: 198000,
    collections: 11,
    productsCount: 72,
    memberSince: "2021",
    featuredIn: 12,
  },
  {
    slug: "toteme",
    name: "TOTEME",
    location: "Stockholm, Sweden",
    slogan: "Wardrobe as architecture.",
    bio: "Considered essentials, made to be returned to.",
    followers: 256000,
    collections: 14,
    productsCount: 98,
    memberSince: "2022",
    featuredIn: 10,
  },
];

export const designerBySlug = (slug: string) =>
  designers.find((d) => d.slug === slug) ?? designers[0];

export interface Order {
  id: string;
  customer: string;
  total: number;
  status: "Processing" | "Shipped" | "Delivered" | "Returned";
  date: string;
  items: number;
}

export const adminOrders: Order[] = [
  { id: "PWN-10241", customer: "A. Vogt", total: 1450, status: "Shipped", date: "2026-06-28", items: 1 },
  { id: "PWN-10240", customer: "M. Klein", total: 2330, status: "Processing", date: "2026-06-28", items: 3 },
  { id: "PWN-10239", customer: "L. Marchetti", total: 480, status: "Delivered", date: "2026-06-27", items: 1 },
  { id: "PWN-10238", customer: "S. Iqbal", total: 1870, status: "Delivered", date: "2026-06-27", items: 2 },
  { id: "PWN-10237", customer: "K. Tanaka", total: 620, status: "Returned", date: "2026-06-26", items: 1 },
];

export const customerOrders = [
  { id: "PWN-10212", date: "2026-06-18", total: 1450, status: "In transit", items: [{ name: "Asymmetric Coat", designer: "Y/PROJECT" }] },
  { id: "PWN-10184", date: "2026-05-30", total: 480, status: "Delivered", items: [{ name: "Draped Hoodie", designer: "LEMAIRE" }] },
  { id: "PWN-10122", date: "2026-04-12", total: 1510, status: "Delivered", items: [{ name: "Contour Jacket", designer: "1017 ALYX 9SM" }, { name: "Wire Bag", designer: "TOTEME" }] },
];

export const revenueSeries = [12, 18, 16, 24, 28, 22, 31, 36, 33, 41, 47, 52];
export const monthsShort = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

export const dnaSegments = [
  { label: "Architectural", value: 32 },
  { label: "Brutalist Romance", value: 24 },
  { label: "Quiet Luxury", value: 18 },
  { label: "Avant Tailoring", value: 14 },
  { label: "Future Heritage", value: 12 },
];

export const colorTrends = [
  { label: "Bone", value: 28 },
  { label: "Obsidian", value: 22 },
  { label: "Oxblood", value: 18 },
  { label: "Charcoal", value: 16 },
  { label: "Sand", value: 10 },
  { label: "Ink", value: 6 },
];
