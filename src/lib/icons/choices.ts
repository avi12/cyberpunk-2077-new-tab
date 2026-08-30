import {
  Aperture,
  Bolt,
  BookmarkPlus,
  Bot,
  Brain,
  Briefcase,
  Cctv,
  ChartNoAxesCombined,
  Code,
  Coffee,
  DollarSign,
  Fingerprint,
  Gamepad2,
  Gem,
  Globe,
  Hamburger,
  Heart,
  House,
  Mail,
  Map,
  MapPin,
  MessageCircle,
  Music,
  Newspaper,
  Palette,
  PawPrint,
  Phone,
  Podcast,
  Popcorn,
  Rocket,
  Shield,
  ShoppingBag,
  ShoppingBasket,
  Skull,
  Sparkles,
  Star,
  Terminal,
  TvMinimalPlay,
  Wallet,
  Zap
} from "./nodes";
import type { IconNode } from "./types";

export type IconChoice = {
  name: string;
  node: IconNode;
};

/**
 * The one list behind both the bookmark icon picker and the tab favicon picker, in the original's
 * order. A bookmark stores the `name`, so these strings are a persisted contract: renaming one
 * orphans every bookmark that used it.
 */
export const ICON_CHOICES: IconChoice[] = [
  {
    name: "Default",
    node: BookmarkPlus
  },
  {
    name: "Basket",
    node: ShoppingBasket
  },
  {
    name: "Bolt",
    node: Bolt
  },
  {
    name: "Bot",
    node: Bot
  },
  {
    name: "Brain",
    node: Brain
  },
  {
    name: "Chat",
    node: MessageCircle
  },
  {
    name: "Camera",
    node: Aperture
  },
  {
    name: "CCTV",
    node: Cctv
  },
  {
    name: "Chart",
    node: ChartNoAxesCombined
  },
  {
    name: "Code",
    node: Code
  },
  {
    name: "Coffee",
    node: Coffee
  },
  {
    name: "Design",
    node: Palette
  },
  {
    name: "Food",
    node: Hamburger
  },
  {
    name: "Gaming",
    node: Gamepad2
  },
  {
    name: "Gem",
    node: Gem
  },
  {
    name: "Heart",
    node: Heart
  },
  {
    name: "Home",
    node: House
  },
  {
    name: "Launch",
    node: Rocket
  },
  {
    name: "Mail",
    node: Mail
  },
  {
    name: "Map",
    node: Map
  },
  {
    name: "Money",
    node: DollarSign
  },
  {
    name: "Music",
    node: Music
  },
  {
    name: "News",
    node: Newspaper
  },
  {
    name: "Paw",
    node: PawPrint
  },
  {
    name: "Phone",
    node: Phone
  },
  {
    name: "Pin",
    node: MapPin
  },
  {
    name: "Podcast",
    node: Podcast
  },
  {
    name: "Popcorn",
    node: Popcorn
  },
  {
    name: "Security",
    node: Fingerprint
  },
  {
    name: "Shield",
    node: Shield
  },
  {
    name: "Shopping",
    node: ShoppingBag
  },
  {
    name: "Skull",
    node: Skull
  },
  {
    name: "Sparkles",
    node: Sparkles
  },
  {
    name: "Star",
    node: Star
  },
  {
    name: "Terminal",
    node: Terminal
  },
  {
    name: "Video",
    node: TvMinimalPlay
  },
  {
    name: "Wallet",
    node: Wallet
  },
  {
    name: "Web",
    node: Globe
  },
  {
    name: "Work",
    node: Briefcase
  },
  {
    name: "Zap",
    node: Zap
  }
];

export function iconByName(name: string): IconNode {
  const choice = ICON_CHOICES.find(entry => entry.name === name);

  return choice ? choice.node : ICON_CHOICES[0].node;
}
