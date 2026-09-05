import iconAperture from "@/assets/icons/aperture.svg?raw";
import iconBolt from "@/assets/icons/bolt.svg?raw";
import iconBookmarkPlus from "@/assets/icons/bookmark-plus.svg?raw";
import iconBot from "@/assets/icons/bot.svg?raw";
import iconBrain from "@/assets/icons/brain.svg?raw";
import iconBriefcase from "@/assets/icons/briefcase.svg?raw";
import iconCctv from "@/assets/icons/cctv.svg?raw";
import iconChartNoAxesCombined from "@/assets/icons/chart-no-axes-combined.svg?raw";
import iconCode from "@/assets/icons/code.svg?raw";
import iconCoffee from "@/assets/icons/coffee.svg?raw";
import iconDollarSign from "@/assets/icons/dollar-sign.svg?raw";
import iconFingerprint from "@/assets/icons/fingerprint.svg?raw";
import iconGamepad2 from "@/assets/icons/gamepad2.svg?raw";
import iconGem from "@/assets/icons/gem.svg?raw";
import iconGlobe from "@/assets/icons/globe.svg?raw";
import iconHamburger from "@/assets/icons/hamburger.svg?raw";
import iconHeart from "@/assets/icons/heart.svg?raw";
import iconHouse from "@/assets/icons/house.svg?raw";
import iconMail from "@/assets/icons/mail.svg?raw";
import iconMapPin from "@/assets/icons/map-pin.svg?raw";
import iconMap from "@/assets/icons/map.svg?raw";
import iconMessageCircle from "@/assets/icons/message-circle.svg?raw";
import iconMusic from "@/assets/icons/music.svg?raw";
import iconNewspaper from "@/assets/icons/newspaper.svg?raw";
import iconPalette from "@/assets/icons/palette.svg?raw";
import iconPawPrint from "@/assets/icons/paw-print.svg?raw";
import iconPhone from "@/assets/icons/phone.svg?raw";
import iconPodcast from "@/assets/icons/podcast.svg?raw";
import iconPopcorn from "@/assets/icons/popcorn.svg?raw";
import iconRocket from "@/assets/icons/rocket.svg?raw";
import iconShield from "@/assets/icons/shield.svg?raw";
import iconShoppingBag from "@/assets/icons/shopping-bag.svg?raw";
import iconShoppingBasket from "@/assets/icons/shopping-basket.svg?raw";
import iconSkull from "@/assets/icons/skull.svg?raw";
import iconSparkles from "@/assets/icons/sparkles.svg?raw";
import iconStar from "@/assets/icons/star.svg?raw";
import iconTerminal from "@/assets/icons/terminal.svg?raw";
import iconTvMinimalPlay from "@/assets/icons/tv-minimal-play.svg?raw";
import iconWallet from "@/assets/icons/wallet.svg?raw";
import iconZap from "@/assets/icons/zap.svg?raw";

type IconChoice = {
  name: string;
  svg: string;
};

/**
 * The one list behind both the bookmark icon picker and the tab favicon picker, in the original's
 * order. A bookmark stores the `name`, so these strings are a persisted contract: renaming one
 * orphans every bookmark that used it.
 */
export const ICON_CHOICES = [
  {
    name: "Default",
    svg: iconBookmarkPlus
  },
  {
    name: "Basket",
    svg: iconShoppingBasket
  },
  {
    name: "Bolt",
    svg: iconBolt
  },
  {
    name: "Bot",
    svg: iconBot
  },
  {
    name: "Brain",
    svg: iconBrain
  },
  {
    name: "Chat",
    svg: iconMessageCircle
  },
  {
    name: "Camera",
    svg: iconAperture
  },
  {
    name: "CCTV",
    svg: iconCctv
  },
  {
    name: "Chart",
    svg: iconChartNoAxesCombined
  },
  {
    name: "Code",
    svg: iconCode
  },
  {
    name: "Coffee",
    svg: iconCoffee
  },
  {
    name: "Design",
    svg: iconPalette
  },
  {
    name: "Food",
    svg: iconHamburger
  },
  {
    name: "Gaming",
    svg: iconGamepad2
  },
  {
    name: "Gem",
    svg: iconGem
  },
  {
    name: "Heart",
    svg: iconHeart
  },
  {
    name: "Home",
    svg: iconHouse
  },
  {
    name: "Launch",
    svg: iconRocket
  },
  {
    name: "Mail",
    svg: iconMail
  },
  {
    name: "Map",
    svg: iconMap
  },
  {
    name: "Money",
    svg: iconDollarSign
  },
  {
    name: "Music",
    svg: iconMusic
  },
  {
    name: "News",
    svg: iconNewspaper
  },
  {
    name: "Paw",
    svg: iconPawPrint
  },
  {
    name: "Phone",
    svg: iconPhone
  },
  {
    name: "Pin",
    svg: iconMapPin
  },
  {
    name: "Podcast",
    svg: iconPodcast
  },
  {
    name: "Popcorn",
    svg: iconPopcorn
  },
  {
    name: "Security",
    svg: iconFingerprint
  },
  {
    name: "Shield",
    svg: iconShield
  },
  {
    name: "Shopping",
    svg: iconShoppingBag
  },
  {
    name: "Skull",
    svg: iconSkull
  },
  {
    name: "Sparkles",
    svg: iconSparkles
  },
  {
    name: "Star",
    svg: iconStar
  },
  {
    name: "Terminal",
    svg: iconTerminal
  },
  {
    name: "Video",
    svg: iconTvMinimalPlay
  },
  {
    name: "Wallet",
    svg: iconWallet
  },
  {
    name: "Web",
    svg: iconGlobe
  },
  {
    name: "Work",
    svg: iconBriefcase
  },
  {
    name: "Zap",
    svg: iconZap
  }
] as const satisfies readonly IconChoice[];

/** The closed set of stored icon names. */
export type IconName = (typeof ICON_CHOICES)[number]["name"];

/** The first choice doubles as the fallback, so what "no icon picked" looks like is decided once. */
const DEFAULT_CHOICE = ICON_CHOICES[0];

export const DEFAULT_ICON = DEFAULT_CHOICE.name;

export function iconByName(name: string) {
  return (ICON_CHOICES.find(entry => entry.name === name) ?? DEFAULT_CHOICE).svg;
}
