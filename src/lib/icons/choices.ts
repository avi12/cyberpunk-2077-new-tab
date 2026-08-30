import aperture from "@/assets/icons/aperture.svg?raw";
import bolt from "@/assets/icons/bolt.svg?raw";
import bookmarkPlus from "@/assets/icons/bookmark-plus.svg?raw";
import bot from "@/assets/icons/bot.svg?raw";
import brain from "@/assets/icons/brain.svg?raw";
import briefcase from "@/assets/icons/briefcase.svg?raw";
import cctv from "@/assets/icons/cctv.svg?raw";
import chartNoAxesCombined from "@/assets/icons/chart-no-axes-combined.svg?raw";
import code from "@/assets/icons/code.svg?raw";
import coffee from "@/assets/icons/coffee.svg?raw";
import dollarSign from "@/assets/icons/dollar-sign.svg?raw";
import fingerprint from "@/assets/icons/fingerprint.svg?raw";
import gamepad2 from "@/assets/icons/gamepad2.svg?raw";
import gem from "@/assets/icons/gem.svg?raw";
import globe from "@/assets/icons/globe.svg?raw";
import hamburger from "@/assets/icons/hamburger.svg?raw";
import heart from "@/assets/icons/heart.svg?raw";
import house from "@/assets/icons/house.svg?raw";
import mail from "@/assets/icons/mail.svg?raw";
import mapPin from "@/assets/icons/map-pin.svg?raw";
import map from "@/assets/icons/map.svg?raw";
import messageCircle from "@/assets/icons/message-circle.svg?raw";
import music from "@/assets/icons/music.svg?raw";
import newspaper from "@/assets/icons/newspaper.svg?raw";
import palette from "@/assets/icons/palette.svg?raw";
import pawPrint from "@/assets/icons/paw-print.svg?raw";
import phone from "@/assets/icons/phone.svg?raw";
import podcast from "@/assets/icons/podcast.svg?raw";
import popcorn from "@/assets/icons/popcorn.svg?raw";
import rocket from "@/assets/icons/rocket.svg?raw";
import shield from "@/assets/icons/shield.svg?raw";
import shoppingBag from "@/assets/icons/shopping-bag.svg?raw";
import shoppingBasket from "@/assets/icons/shopping-basket.svg?raw";
import skull from "@/assets/icons/skull.svg?raw";
import sparkles from "@/assets/icons/sparkles.svg?raw";
import star from "@/assets/icons/star.svg?raw";
import terminal from "@/assets/icons/terminal.svg?raw";
import tvMinimalPlay from "@/assets/icons/tv-minimal-play.svg?raw";
import wallet from "@/assets/icons/wallet.svg?raw";
import zap from "@/assets/icons/zap.svg?raw";

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
    svg: bookmarkPlus
  },
  {
    name: "Basket",
    svg: shoppingBasket
  },
  {
    name: "Bolt",
    svg: bolt
  },
  {
    name: "Bot",
    svg: bot
  },
  {
    name: "Brain",
    svg: brain
  },
  {
    name: "Chat",
    svg: messageCircle
  },
  {
    name: "Camera",
    svg: aperture
  },
  {
    name: "CCTV",
    svg: cctv
  },
  {
    name: "Chart",
    svg: chartNoAxesCombined
  },
  {
    name: "Code",
    svg: code
  },
  {
    name: "Coffee",
    svg: coffee
  },
  {
    name: "Design",
    svg: palette
  },
  {
    name: "Food",
    svg: hamburger
  },
  {
    name: "Gaming",
    svg: gamepad2
  },
  {
    name: "Gem",
    svg: gem
  },
  {
    name: "Heart",
    svg: heart
  },
  {
    name: "Home",
    svg: house
  },
  {
    name: "Launch",
    svg: rocket
  },
  {
    name: "Mail",
    svg: mail
  },
  {
    name: "Map",
    svg: map
  },
  {
    name: "Money",
    svg: dollarSign
  },
  {
    name: "Music",
    svg: music
  },
  {
    name: "News",
    svg: newspaper
  },
  {
    name: "Paw",
    svg: pawPrint
  },
  {
    name: "Phone",
    svg: phone
  },
  {
    name: "Pin",
    svg: mapPin
  },
  {
    name: "Podcast",
    svg: podcast
  },
  {
    name: "Popcorn",
    svg: popcorn
  },
  {
    name: "Security",
    svg: fingerprint
  },
  {
    name: "Shield",
    svg: shield
  },
  {
    name: "Shopping",
    svg: shoppingBag
  },
  {
    name: "Skull",
    svg: skull
  },
  {
    name: "Sparkles",
    svg: sparkles
  },
  {
    name: "Star",
    svg: star
  },
  {
    name: "Terminal",
    svg: terminal
  },
  {
    name: "Video",
    svg: tvMinimalPlay
  },
  {
    name: "Wallet",
    svg: wallet
  },
  {
    name: "Web",
    svg: globe
  },
  {
    name: "Work",
    svg: briefcase
  },
  {
    name: "Zap",
    svg: zap
  }
] as const satisfies readonly IconChoice[];

/** The closed set of stored icon names. */
export type IconName = (typeof ICON_CHOICES)[number]["name"];

export function iconByName(name: string): string {
  const choice = ICON_CHOICES.find(entry => entry.name === name);

  return choice ? choice.svg : ICON_CHOICES[0].svg;
}
